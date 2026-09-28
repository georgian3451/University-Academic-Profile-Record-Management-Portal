import os
import json
from flask import Blueprint, request, jsonify, current_app
from .database import get_db_connection
from .storage_manager import save_uploaded_file, init_student_structure, is_allowed_file

student_bp = Blueprint("student", __name__)

def is_student_verified(enrollment_no: str, conn) -> bool:
    """Checks whether student profile has been verified by admin"""
    cursor = conn.cursor()
    cursor.execute("SELECT verification_status FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    row = cursor.fetchone()
    return bool(row and row["verification_status"] == "Verified")

def calculate_completeness(enrollment_no: str, conn) -> dict:
    """
    Calculates profile completeness percentage based on compulsory and optional sections:
    - Basic Details (12 compulsory fields including photo): 40%
    - Optional sections (9 categories, ~6.67% each = 60%):
        1. Social & Coding links
        2. Skills (Soft, Tech, Target roles)
        3. Semester Marks / SGPAs
        4. Certificates
        5. Hackathons
        6. Seminars / Events
        7. Workshops
        8. Projects
        9. Resume
    """
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    prof = cursor.fetchone()

    checklist = {
        "basic_details": False,
        "photo": False,
        "links": False,
        "skills": False,
        "marks": False,
        "certificates": False,
        "hackathons": False,
        "seminars": False,
        "workshops": False,
        "projects": False,
        "resume": False
    }

    if prof:
        compulsory_fields = [
            prof["enrollment_no"], prof["full_name"], prof["dob"], prof["branch"],
            prof["program"], prof["class_name"], prof["section"], prof["semester"],
            prof["mobile"], prof["email"], prof["semester_year"]
        ]
        checklist["basic_details"] = all(bool(f and str(f).strip()) for f in compulsory_fields)
        checklist["photo"] = bool(prof["photo_path"] and str(prof["photo_path"]).strip() and "default.svg" not in str(prof["photo_path"]))

    cursor.execute("SELECT category, data_json FROM student_extras WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    extras_rows = cursor.fetchall()
    extras_map = {row["category"]: json.loads(row["data_json"]) for row in extras_rows}

    links = extras_map.get("links", {})
    checklist["links"] = bool(links.get("linkedin") or links.get("github") or links.get("leetcode") or links.get("codeforces"))

    skills = extras_map.get("skills", {})
    checklist["skills"] = bool(
        (skills.get("technical_skills") and len(skills["technical_skills"]) > 0) or
        (skills.get("soft_skills") and len(skills["soft_skills"]) > 0)
    )

    cursor.execute("SELECT COUNT(*) FROM semester_marks WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    checklist["marks"] = cursor.fetchone()[0] > 0

    cursor.execute("SELECT COUNT(*) FROM submissions WHERE UPPER(enrollment_no) = UPPER(?) AND submission_type = 'certificate'", (enrollment_no,))
    checklist["certificates"] = cursor.fetchone()[0] > 0

    hackathons = extras_map.get("hackathons", [])
    checklist["hackathons"] = len(hackathons) > 0

    seminars = extras_map.get("seminars", {})
    checklist["seminars"] = bool(
        (seminars.get("organized") and len(seminars["organized"]) > 0) or
        (seminars.get("participated") and len(seminars["participated"]) > 0)
    )

    workshops = extras_map.get("workshops", [])
    checklist["workshops"] = len(workshops) > 0

    projects = extras_map.get("projects", [])
    checklist["projects"] = len(projects) > 0

    resume = extras_map.get("resumes", {})
    checklist["resume"] = bool(resume.get("filename"))

    score = 0.0
    if checklist["basic_details"]:
        score += 30.0
    if checklist["photo"]:
        score += 10.0
    
    optional_keys = ["links", "skills", "marks", "certificates", "hackathons", "seminars", "workshops", "projects", "resume"]
    pts_per_opt = 60.0 / len(optional_keys)
    for k in optional_keys:
        if checklist[k]:
            score += pts_per_opt

    percentage = min(100.0, round(score, 1))

    cursor.execute("UPDATE student_profiles SET completeness_pct = ? WHERE UPPER(enrollment_no) = UPPER(?)", (percentage, enrollment_no))
    conn.commit()

    return {
        "percentage": percentage,
        "checklist": checklist
    }

@student_bp.route("/profile", methods=["GET"])
def get_profile():
    enrollment_no = request.args.get("enrollment_no", "").strip()
    if not enrollment_no:
        return jsonify({"success": False, "message": "Enrollment Number is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    prof = cursor.fetchone()
    if not prof:
        conn.close()
        return jsonify({"success": False, "message": "Profile not found."}), 404

    profile_dict = dict(prof)

    # Fetch Extras
    cursor.execute("SELECT category, data_json FROM student_extras WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    extras = {r["category"]: json.loads(r["data_json"]) for r in cursor.fetchall()}

    # Fetch Semester Marks
    cursor.execute("SELECT * FROM semester_marks WHERE UPPER(enrollment_no) = UPPER(?) ORDER BY semester ASC", (enrollment_no,))
    marks = [dict(m) for m in cursor.fetchall()]

    # Fetch Submissions
    cursor.execute("SELECT * FROM submissions WHERE UPPER(enrollment_no) = UPPER(?) ORDER BY submitted_at DESC", (enrollment_no,))
    submissions = [dict(s) for s in cursor.fetchall()]

    # Fetch Requirements available for student's branch/year
    cursor.execute("""
    SELECT r.*, 
           (SELECT status FROM submissions s WHERE s.requirement_id = r.id AND UPPER(s.enrollment_no) = UPPER(?) LIMIT 1) as student_submission_status,
           (SELECT admin_comment FROM submissions s WHERE s.requirement_id = r.id AND UPPER(s.enrollment_no) = UPPER(?) LIMIT 1) as rejection_comment
    FROM requirements r
    WHERE (r.target_branch = 'All' OR r.target_branch = ?)
      AND (r.target_year = 'All' OR r.target_year = ?)
    ORDER BY r.deadline ASC
    """, (enrollment_no, enrollment_no, prof["branch"], prof["semester_year"]))
    requirements = [dict(r) for r in cursor.fetchall()]

    # Calculate live completeness
    completeness = calculate_completeness(enrollment_no, conn)
    profile_dict["completeness_pct"] = completeness["percentage"]
    profile_dict["checklist"] = completeness["checklist"]

    conn.close()

    return jsonify({
        "success": True,
        "profile": profile_dict,
        "verification_status": profile_dict.get("verification_status", "Pending"),
        "extras": extras,
        "marks": marks,
        "submissions": submissions,
        "requirements": requirements
    })

@student_bp.route("/basic-details", methods=["POST"])
def update_basic_details():
    data = request.get_json() or {}
    enrollment_no = data.get("enrollment_no", "").strip()

    conn = get_db_connection()

    # Verification Gate: unverified profiles cannot edit
    if not is_student_verified(enrollment_no, conn):
        conn.close()
        return jsonify({
            "success": False,
            "message": "Your profile is pending admin verification. Edit access will be granted once approved by administration."
        }), 403

    required_fields = [
        "enrollment_no", "full_name", "dob", "branch", "program",
        "class_name", "section", "semester", "mobile", "email", "semester_year"
    ]

    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        conn.close()
        return jsonify({
            "success": False,
            "message": f"All basic details fields are compulsory. Missing: {', '.join(missing)}"
        }), 400

    cursor = conn.cursor()
    init_student_structure(data["branch"], data["section"], enrollment_no)

    cursor.execute("""
    INSERT INTO student_profiles (
        enrollment_no, full_name, dob, branch, program, class_name,
        section, semester, mobile, email, semester_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(enrollment_no) DO UPDATE SET
        full_name = excluded.full_name,
        dob = excluded.dob,
        branch = excluded.branch,
        program = excluded.program,
        class_name = excluded.class_name,
        section = excluded.section,
        semester = excluded.semester,
        mobile = excluded.mobile,
        email = excluded.email,
        semester_year = excluded.semester_year
    """, (
        enrollment_no, data["full_name"], data["dob"], data["branch"],
        data["program"], data["class_name"], data["section"],
        int(data["semester"]), data["mobile"], data["email"], data["semester_year"]
    ))

    cursor.execute("UPDATE users SET name = ?, email = ?, mobile = ? WHERE UPPER(identifier) = UPPER(?)",
                   (data["full_name"], data["email"], data["mobile"], enrollment_no))

    conn.commit()
    completeness = calculate_completeness(enrollment_no, conn)
    conn.close()

    return jsonify({
        "success": True,
        "message": "Basic details updated successfully",
        "completeness": completeness
    })

@student_bp.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "No file uploaded."}), 400

    file = request.files["file"]
    enrollment_no = request.form.get("enrollment_no", "").strip()
    category = request.form.get("category", "other_uploaded_files").strip()

    if not enrollment_no:
        return jsonify({"success": False, "message": "Enrollment Number is required."}), 400

    conn = get_db_connection()

    # Verification Gate: unverified profiles cannot upload
    if not is_student_verified(enrollment_no, conn):
        conn.close()
        return jsonify({
            "success": False,
            "message": "Your profile is pending admin verification. Uploading files is locked until approved."
        }), 403

    if file.filename == "":
        conn.close()
        return jsonify({"success": False, "message": "No file selected."}), 400

    if not is_allowed_file(file.filename):
        conn.close()
        return jsonify({"success": False, "message": "File type not supported. Allowed: PDF, DOCX, JPG, PNG, WEBP, ZIP."}), 400

    cursor = conn.cursor()
    cursor.execute("SELECT branch, section FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    prof = cursor.fetchone()
    branch = prof["branch"] if prof else "General"
    section = prof["section"] if prof else "Section A"

    file_info = save_uploaded_file(branch, section, enrollment_no, category, file)

    if category == "basic_details" or request.form.get("is_photo") == "true":
        cursor.execute("UPDATE student_profiles SET photo_path = ? WHERE UPPER(enrollment_no) = UPPER(?)",
                       ("/" + file_info["file_path"], enrollment_no))
        conn.commit()

    elif category == "resume":
        resume_data = {
            "filename": file_info["original_name"],
            "file_path": file_info["file_path"],
            "uploaded_at": file_info.get("uploaded_at", "")
        }
        cursor.execute("""
        INSERT INTO student_extras (enrollment_no, category, data_json)
        VALUES (?, 'resumes', ?)
        ON CONFLICT(enrollment_no, category) DO UPDATE SET data_json = excluded.data_json
        """, (enrollment_no, json.dumps(resume_data)))
        conn.commit()

    completeness = calculate_completeness(enrollment_no, conn)
    conn.close()

    return jsonify({
        "success": True,
        "message": "File uploaded successfully",
        "file": file_info,
        "completeness": completeness
    })

@student_bp.route("/section/<category>", methods=["POST"])
def update_section(category):
    data = request.get_json() or {}
    enrollment_no = data.get("enrollment_no", "").strip()
    payload = data.get("data", {})

    if not enrollment_no:
        return jsonify({"success": False, "message": "Enrollment Number is required."}), 400

    conn = get_db_connection()

    # Verification Gate: unverified profiles cannot edit
    if not is_student_verified(enrollment_no, conn):
        conn.close()
        return jsonify({
            "success": False,
            "message": "Your profile is pending admin verification. Editing this section is locked until approved."
        }), 403

    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO student_extras (enrollment_no, category, data_json)
    VALUES (?, ?, ?)
    ON CONFLICT(enrollment_no, category) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
    """, (enrollment_no, category, json.dumps(payload)))
    conn.commit()

    completeness = calculate_completeness(enrollment_no, conn)
    conn.close()

    return jsonify({
        "success": True,
        "message": f"{category.capitalize()} updated successfully",
        "completeness": completeness
    })

@student_bp.route("/marks", methods=["POST"])
def add_marks():
    data = request.get_json() or {}
    enrollment_no = data.get("enrollment_no", "").strip()
    semester = int(data.get("semester", 1))
    sgpa = float(data.get("sgpa", 0.0))
    marksheet_file = data.get("marksheet_file", "")

    if not enrollment_no:
        return jsonify({"success": False, "message": "Enrollment Number is required."}), 400

    conn = get_db_connection()

    # Verification Gate
    if not is_student_verified(enrollment_no, conn):
        conn.close()
        return jsonify({
            "success": False,
            "message": "Your profile is pending admin verification. Adding marks is locked until approved."
        }), 403

    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO semester_marks (enrollment_no, semester, sgpa, marksheet_file)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(enrollment_no, semester) DO UPDATE SET sgpa = excluded.sgpa, marksheet_file = excluded.marksheet_file
    """, (enrollment_no, semester, sgpa, marksheet_file))

    cursor.execute("SELECT AVG(sgpa) FROM semester_marks WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    avg_cgpa = round(cursor.fetchone()[0] or 0.0, 2)
    cursor.execute("UPDATE student_profiles SET cgpa = ? WHERE UPPER(enrollment_no) = UPPER(?)", (avg_cgpa, enrollment_no))
    conn.commit()

    completeness = calculate_completeness(enrollment_no, conn)
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Semester {semester} marks saved successfully.",
        "cgpa": avg_cgpa,
        "completeness": completeness
    })

@student_bp.route("/submission", methods=["POST"])
def create_submission():
    data = request.get_json() or {}
    enrollment_no = data.get("enrollment_no", "").strip()
    requirement_id = data.get("requirement_id")
    submission_type = data.get("submission_type", "certificate")
    title = data.get("title", "").strip()
    issuer_or_org = data.get("issuer_or_org", "").strip()
    file_path = data.get("file_path", "").strip()
    file_name = data.get("file_name", "").strip()

    if not enrollment_no or not title:
        return jsonify({"success": False, "message": "Enrollment number and Title are required."}), 400

    conn = get_db_connection()

    # Verification Gate
    if not is_student_verified(enrollment_no, conn):
        conn.close()
        return jsonify({
            "success": False,
            "message": "Your profile is pending admin verification. Submitting documents is locked until approved."
        }), 403

    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO submissions (
        enrollment_no, requirement_id, submission_type, title, issuer_or_org, file_path, file_name, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
    """, (enrollment_no, requirement_id, submission_type, title, issuer_or_org, file_path, file_name))
    conn.commit()

    completeness = calculate_completeness(enrollment_no, conn)
    conn.close()

    return jsonify({
        "success": True,
        "message": "Submission submitted for faculty verification.",
        "completeness": completeness
    })

# ── ANNOUNCEMENTS (REQUIREMENTS + CAMPUS EVENTS) ─────────────────────────
@student_bp.route("/announcements", methods=["GET"])
def get_announcements():
    enrollment_no = request.args.get("enrollment_no", "").strip()
    conn = get_db_connection()
    cursor = conn.cursor()

    prof = None
    if enrollment_no:
        cursor.execute("SELECT branch, semester_year FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
        prof = cursor.fetchone()

    # Requirements announcements
    branch_val = prof["branch"] if prof else "All"
    year_val = prof["semester_year"] if prof else "All"

    cursor.execute("""
    SELECT id, title, description, target_branch, target_year, deadline, is_compulsory, created_at, 'Requirement' as announcement_type
    FROM requirements
    WHERE (target_branch = 'All' OR target_branch = ?)
      AND (target_year = 'All' OR target_year = ?)
    ORDER BY created_at DESC
    """, (branch_val, year_val))
    req_announcements = [dict(r) for r in cursor.fetchall()]

    # Events announcements
    cursor.execute("""
    SELECT id, title, description, event_type, organizer_type, organizer_name, date, venue, registration_link, created_at, 'Event' as announcement_type
    FROM events
    ORDER BY created_at DESC
    """)
    event_announcements = [dict(r) for r in cursor.fetchall()]

    conn.close()

    # Merge and sort by created_at DESC
    all_announcements = req_announcements + event_announcements
    all_announcements.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    return jsonify({
        "success": True,
        "announcements": all_announcements,
        "requirements_count": len(req_announcements),
        "events_count": len(event_announcements)
    })

# ── EVENTS (SEMINARS, WORKSHOPS, HACKATHONS) ─────────────────────────────
@student_bp.route("/events", methods=["GET"])
def get_events():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY date ASC, id DESC")
    events = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "events": events})

# ── FAQS ─────────────────────────────────────────────────────────────────
@student_bp.route("/faqs", methods=["GET"])
def get_faqs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM faqs ORDER BY category ASC, id ASC")
    faqs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "faqs": faqs})

# ── STUDENT QUERIES (RAISE A QUERY) ──────────────────────────────────────
@student_bp.route("/queries", methods=["GET", "POST"])
def manage_student_queries():
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json() or {}
        enrollment_no = data.get("enrollment_no", "").strip()
        category = data.get("category", "Other").strip()
        subject = data.get("subject", "").strip()
        description = data.get("description", "").strip()
        proof_file_path = data.get("proof_file_path", "").strip()
        proof_file_name = data.get("proof_file_name", "").strip()

        if not enrollment_no or not subject or not description:
            conn.close()
            return jsonify({"success": False, "message": "Enrollment number, category, subject, and description are required."}), 400

        cursor.execute("""
        INSERT INTO student_queries (enrollment_no, category, subject, description, proof_file_path, proof_file_name, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Open')
        """, (enrollment_no, category, subject, description, proof_file_path, proof_file_name))
        conn.commit()
        qid = cursor.lastrowid
        conn.close()
        return jsonify({"success": True, "message": "Your query has been submitted to the academic administration.", "query_id": qid})

    # GET queries for this student
    enrollment_no = request.args.get("enrollment_no", "").strip()
    if not enrollment_no:
        conn.close()
        return jsonify({"success": False, "message": "Enrollment number required"}), 400

    cursor.execute("SELECT * FROM student_queries WHERE UPPER(enrollment_no) = UPPER(?) ORDER BY id DESC", (enrollment_no,))
    queries = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "queries": queries})

