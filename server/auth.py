import random
import string
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from .database import get_db_connection, hash_password
from .storage_manager import init_student_structure

auth_bp = Blueprint("auth", __name__)

def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Student Registration:
    Creates a new user and student profile with verification_status = 'Pending'.
    Initializes hierarchical directory for the student.
    """
    data = request.get_json() or {}
    enrollment_no = data.get("enrollment_no", "").strip().upper()
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    mobile = data.get("mobile", "").strip()
    branch = data.get("branch", "").strip()
    program = data.get("program", "B.Tech").strip()
    class_name = data.get("class_name", "").strip()
    section = data.get("section", "Section A").strip()
    semester = int(data.get("semester", 1))
    semester_year = data.get("semester_year", "1st Year").strip()
    dob = data.get("dob", "").strip()
    password = data.get("password", "").strip()

    required = [enrollment_no, full_name, email, mobile, branch, class_name, section, dob, password]
    if not all(required):
        return jsonify({"success": False, "message": "All registration fields and password are required."}), 400

    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check for existing user
    cursor.execute("SELECT id FROM users WHERE UPPER(identifier) = UPPER(?) OR LOWER(email) = LOWER(?)", (enrollment_no, email))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return jsonify({"success": False, "message": "An account with this Enrollment Number or Email already exists."}), 409

    pw_hash = hash_password(password)

    # Insert into users
    cursor.execute("""
    INSERT INTO users (role, identifier, name, email, mobile, password_hash)
    VALUES ('student', ?, ?, ?, ?, ?)
    """, (enrollment_no, full_name, email, mobile, pw_hash))

    # Insert into student_profiles with status 'Pending'
    cursor.execute("""
    INSERT INTO student_profiles (
        enrollment_no, full_name, dob, branch, program, class_name,
        section, semester, mobile, email, semester_year,
        photo_path, cgpa, attendance_pct, completeness_pct, verification_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '/static/images/avatars/default.svg', 0.0, 85.0, 30.0, 'Pending')
    """, (enrollment_no, full_name, dob, branch, program, class_name, section, semester, mobile, email, semester_year))

    conn.commit()
    conn.close()

    # Initialize hierarchical storage folder for this student
    init_student_structure(branch, section, enrollment_no)

    return jsonify({
        "success": True,
        "message": f"Registration successful for {full_name}! Your profile is pending faculty/admin verification before edit access is granted.",
        "enrollment_no": enrollment_no,
        "verification_status": "Pending"
    })

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    role = data.get("role", "").strip().lower()
    identifier = data.get("identifier", "").strip()
    password = data.get("password", "").strip()

    if not role or not identifier or not password:
        return jsonify({"success": False, "message": "Role, Identifier, and Password are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE role = ? AND UPPER(identifier) = UPPER(?)", (role, identifier))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({"success": False, "message": f"Invalid {('Enrollment Number' if role == 'student' else 'Employee ID')} or role."}), 401

    pw_hash = hash_password(password)
    if user["password_hash"] != pw_hash:
        conn.close()
        return jsonify({"success": False, "message": "Invalid password."}), 401

    user_info = {
        "id": user["id"],
        "role": user["role"],
        "identifier": user["identifier"],
        "name": user["name"],
        "email": user["email"],
        "mobile": user["mobile"]
    }

    # Fetch profile info and verification_status if student
    profile_info = {}
    if role == "student":
        cursor.execute("SELECT * FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (identifier,))
        prof = cursor.fetchone()
        if prof:
            profile_info = dict(prof)

    conn.close()

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": user_info,
        "profile": profile_info
    })

@auth_bp.route("/forgot-password/request-otp", methods=["POST"])
def request_otp():
    data = request.get_json() or {}
    role = data.get("role", "").strip().lower()
    identifier = data.get("identifier", "").strip()

    if not role or not identifier:
        return jsonify({"success": False, "message": "Role and identifier are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE role = ? AND UPPER(identifier) = UPPER(?)", (role, identifier))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({"success": False, "message": f"No account found with this {('Enrollment Number' if role == 'student' else 'Employee ID')}."}), 404

    mobile = user["mobile"]
    masked_mobile = f"+91 ******{mobile[-4:]}" if len(mobile) >= 4 else mobile

    otp = generate_otp()
    expires_at = (datetime.now() + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("UPDATE otp_tokens SET used = 1 WHERE UPPER(identifier) = UPPER(?)", (identifier,))
    cursor.execute("INSERT INTO otp_tokens (identifier, otp_code, expires_at, used) VALUES (?, ?, ?, 0)",
                   (user["identifier"], otp, expires_at))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"OTP successfully dispatched to linked mobile {masked_mobile}.",
        "masked_mobile": masked_mobile,
        "identifier": user["identifier"],
        "simulated_otp": otp,
        "valid_minutes": 5
    })

@auth_bp.route("/forgot-password/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip()
    otp_code = data.get("otp", "").strip()

    if not identifier or not otp_code:
        return jsonify({"success": False, "message": "Identifier and OTP code are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT * FROM otp_tokens 
    WHERE UPPER(identifier) = UPPER(?) AND otp_code = ? AND used = 0
    ORDER BY id DESC LIMIT 1
    """, (identifier, otp_code))
    token = cursor.fetchone()

    if not token:
        conn.close()
        return jsonify({"success": False, "message": "Invalid or expired OTP code."}), 400

    expires_at = datetime.strptime(token["expires_at"], "%Y-%m-%d %H:%M:%S")
    if datetime.now() > expires_at:
        conn.close()
        return jsonify({"success": False, "message": "OTP has expired. Please request a new one."}), 400

    conn.close()
    return jsonify({
        "success": True,
        "message": "OTP verified successfully. You may now reset your password."
    })

@auth_bp.route("/forgot-password/reset", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip()
    otp_code = data.get("otp", "").strip()
    new_password = data.get("new_password", "").strip()

    if not identifier or not otp_code or not new_password:
        return jsonify({"success": False, "message": "Identifier, OTP code, and new password are required."}), 400

    if len(new_password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT * FROM otp_tokens 
    WHERE UPPER(identifier) = UPPER(?) AND otp_code = ? AND used = 0
    ORDER BY id DESC LIMIT 1
    """, (identifier, otp_code))
    token = cursor.fetchone()

    if not token:
        conn.close()
        return jsonify({"success": False, "message": "Invalid or expired OTP authorization."}), 400

    expires_at = datetime.strptime(token["expires_at"], "%Y-%m-%d %H:%M:%S")
    if datetime.now() > expires_at:
        conn.close()
        return jsonify({"success": False, "message": "OTP has expired."}), 400

    new_hash = hash_password(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE UPPER(identifier) = UPPER(?)", (new_hash, identifier))
    cursor.execute("UPDATE otp_tokens SET used = 1 WHERE id = ?", (token["id"],))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Password reset successfully. You can now log in with your new password."
    })
