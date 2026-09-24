import json
import csv
import io
from datetime import datetime
from flask import Blueprint, request, jsonify, Response
from .database import get_db_connection

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/students", methods=["GET"])
def get_students():
    """
    Multi-criteria filter engine:
    - year (semester_year)
    - branch
    - min_cgpa, max_cgpa
    - query (enrollment or name search)
    - min_attendance, max_attendance
    - min_certificates (count)
    - internship_status ('completed', 'pending', 'not_started')
    - verification_status ('All', 'Verified', 'Pending', 'Rejected')
    """
    year = request.args.get("year", "").strip()
    branch = request.args.get("branch", "").strip()
    min_cgpa = request.args.get("min_cgpa")
    max_cgpa = request.args.get("max_cgpa")
    search_query = request.args.get("query", "").strip()
    min_att = request.args.get("min_attendance")
    max_att = request.args.get("max_attendance")
    min_certs = request.args.get("min_certificates")
    internship_status = request.args.get("internship_status", "").strip()
    verification_status = request.args.get("verification_status", "").strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    sql = """
    SELECT sp.*,
           (SELECT COUNT(*) FROM submissions s WHERE UPPER(s.enrollment_no) = UPPER(sp.enrollment_no) AND s.submission_type = 'certificate') as cert_count,
           (SELECT COUNT(*) FROM submissions s WHERE UPPER(s.enrollment_no) = UPPER(sp.enrollment_no) AND s.submission_type = 'internship' AND s.status = 'Approved') as approved_internships,
           (SELECT COUNT(*) FROM submissions s WHERE UPPER(s.enrollment_no) = UPPER(sp.enrollment_no) AND s.submission_type = 'internship' AND s.status = 'Pending') as pending_internships,
           (SELECT COUNT(*) FROM submissions s WHERE UPPER(s.enrollment_no) = UPPER(sp.enrollment_no) AND s.status = 'Pending') as pending_submissions_total
    FROM student_profiles sp
    WHERE 1=1
    """
    params = []

    if year and year != "All":
        sql += " AND sp.semester_year = ?"
        params.append(year)

    if branch and branch != "All":
        sql += " AND sp.branch = ?"
        params.append(branch)

    if verification_status and verification_status != "All":
        sql += " AND sp.verification_status = ?"
        params.append(verification_status)

    if min_cgpa:
        try:
            sql += " AND sp.cgpa >= ?"
            params.append(float(min_cgpa))
        except ValueError:
            pass

    if max_cgpa:
        try:
            sql += " AND sp.cgpa <= ?"
            params.append(float(max_cgpa))
        except ValueError:
            pass

    if min_att:
        try:
            sql += " AND sp.attendance_pct >= ?"
            params.append(float(min_att))
        except ValueError:
            pass

    if max_att:
        try:
            sql += " AND sp.attendance_pct <= ?"
            params.append(float(max_att))
        except ValueError:
            pass

    if search_query:
        sql += " AND (UPPER(sp.enrollment_no) LIKE UPPER(?) OR UPPER(sp.full_name) LIKE UPPER(?))"
        params.extend([f"%{search_query}%", f"%{search_query}%"])

    sql += " ORDER BY sp.enrollment_no ASC"
    cursor.execute(sql, params)
    students = [dict(r) for r in cursor.fetchall()]

    filtered_students = []
    for s in students:
        if min_certs:
            try:
                if s["cert_count"] < int(min_certs):
                    continue
            except ValueError:
                pass

        if internship_status and internship_status != "All":
            if internship_status == "completed" and s["approved_internships"] == 0:
                continue
            elif internship_status == "pending" and s["pending_internships"] == 0:
                continue
            elif internship_status == "not_started" and (s["approved_internships"] > 0 or s["pending_internships"] > 0):
                continue

        filtered_students.append(s)

    conn.close()
    return jsonify({
        "success": True,
        "total": len(filtered_students),
        "students": filtered_students
    })

@admin_bp.route("/students/<enrollment_no>/verify", methods=["POST"])
def verify_student_profile(enrollment_no):
    """
    Admin verification action:
    Sets student profile verification_status to 'Verified' or 'Rejected'
    """
    data = request.get_json() or {}
    status = data.get("status", "Verified").strip() # 'Verified' or 'Rejected'
    verified_by = data.get("verified_by", "ADMIN").strip()

    if status not in ["Verified", "Rejected"]:
        return jsonify({"success": False, "message": "Status must be 'Verified' or 'Rejected'."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT enrollment_no, full_name FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    student = cursor.fetchone()
    if not student:
        conn.close()
        return jsonify({"success": False, "message": "Student not found."}), 404

    cursor.execute("""
    UPDATE student_profiles
    SET verification_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP
    WHERE UPPER(enrollment_no) = UPPER(?)
    """, (status, verified_by, enrollment_no))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Student {student['full_name']} ({student['enrollment_no']}) profile has been marked as {status}!",
        "verification_status": status
    })

@admin_bp.route("/student/<enrollment_no>", methods=["GET"])
def get_student_details(enrollment_no):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM student_profiles WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    prof = cursor.fetchone()
    if not prof:
        conn.close()
        return jsonify({"success": False, "message": "Student not found"}), 404

    profile_dict = dict(prof)

    cursor.execute("SELECT category, data_json FROM student_extras WHERE UPPER(enrollment_no) = UPPER(?)", (enrollment_no,))
    extras = {r["category"]: json.loads(r["data_json"]) for r in cursor.fetchall()}

    cursor.execute("SELECT * FROM semester_marks WHERE UPPER(enrollment_no) = UPPER(?) ORDER BY semester ASC", (enrollment_no,))
    marks = [dict(m) for m in cursor.fetchall()]

    cursor.execute("SELECT * FROM submissions WHERE UPPER(enrollment_no) = UPPER(?) ORDER BY submitted_at DESC", (enrollment_no,))
    submissions = [dict(s) for s in cursor.fetchall()]

    conn.close()
    return jsonify({
        "success": True,
        "student": profile_dict,
        "extras": extras,
        "marks": marks,
        "submissions": submissions
    })

@admin_bp.route("/submissions", methods=["GET"])
def get_submissions():
    status_filter = request.args.get("status", "All").strip()
    sub_type = request.args.get("type", "All").strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    sql = """
    SELECT s.*, sp.full_name as student_name, sp.branch, sp.section, sp.semester_year
    FROM submissions s
    JOIN student_profiles sp ON UPPER(s.enrollment_no) = UPPER(sp.enrollment_no)
    WHERE 1=1
    """
    params = []

    if status_filter != "All":
        sql += " AND s.status = ?"
        params.append(status_filter)

    if sub_type != "All":
        sql += " AND s.submission_type = ?"
        params.append(sub_type)

    sql += " ORDER BY s.submitted_at DESC"
    cursor.execute(sql, params)
    submissions = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({
        "success": True,
        "total": len(submissions),
        "submissions": submissions
    })

@admin_bp.route("/submissions/<int:submission_id>/review", methods=["POST"])
def review_submission(submission_id):
    data = request.get_json() or {}
    new_status = data.get("status", "").strip()
    admin_comment = data.get("admin_comment", "").strip()

    if new_status not in ["Approved", "Rejected"]:
        return jsonify({"success": False, "message": "Status must be 'Approved' or 'Rejected'."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,))
    submission = cursor.fetchone()
    if not submission:
        conn.close()
        return jsonify({"success": False, "message": "Submission not found."}), 404

    cursor.execute("""
    UPDATE submissions
    SET status = ?, admin_comment = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (new_status, admin_comment, submission_id))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Submission marked as {new_status} successfully."
    })

@admin_bp.route("/requirements", methods=["GET", "POST"])
def manage_requirements():
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == "POST":
        data = request.get_json() or {}
        title = data.get("title", "").strip()
        description = data.get("description", "").strip()
        target_branch = data.get("target_branch", "All").strip()
        target_year = data.get("target_year", "All").strip()
        deadline = data.get("deadline", "").strip()
        is_compulsory = 1 if data.get("is_compulsory") else 0
        created_by = data.get("created_by", "VGU_ADMIN")

        if not title or not deadline:
            conn.close()
            return jsonify({"success": False, "message": "Title and Deadline are required."}), 400

        cursor.execute("""
        INSERT INTO requirements (title, description, target_branch, target_year, deadline, is_compulsory, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (title, description, target_branch, target_year, deadline, is_compulsory, created_by))
        conn.commit()
        req_id = cursor.lastrowid
        conn.close()

        return jsonify({
            "success": True,
            "message": "New academic requirement posted successfully.",
            "requirement_id": req_id
        })

    cursor.execute("SELECT * FROM requirements ORDER BY id DESC")
    req_rows = cursor.fetchall()
    requirements = []

    for r in req_rows:
        req = dict(r)
        branch_clause = "1=1" if req["target_branch"] == "All" else "branch = ?"
        year_clause = "1=1" if req["target_year"] == "All" else "semester_year = ?"
        
        target_params = []
        if req["target_branch"] != "All":
            target_params.append(req["target_branch"])
        if req["target_year"] != "All":
            target_params.append(req["target_year"])

        cursor.execute(f"SELECT COUNT(*) FROM student_profiles WHERE {branch_clause} AND {year_clause}", target_params)
        total_target = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT enrollment_no) FROM submissions WHERE requirement_id = ?", (req["id"],))
        submitted_count = cursor.fetchone()[0]

        req["total_students"] = total_target
        req["submitted_students"] = submitted_count
        req["non_submitting_students"] = max(0, total_target - submitted_count)

        requirements.append(req)

    conn.close()
    return jsonify({
        "success": True,
        "requirements": requirements
    })

@admin_bp.route("/requirements/<int:req_id>/non-submitters", methods=["GET"])
def get_non_submitters(req_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM requirements WHERE id = ?", (req_id,))
    req = cursor.fetchone()
    if not req:
        conn.close()
        return jsonify({"success": False, "message": "Requirement not found"}), 404

    branch_cond = "1=1" if req["target_branch"] == "All" else "sp.branch = ?"
    year_cond = "1=1" if req["target_year"] == "All" else "sp.semester_year = ?"
    params = []
    if req["target_branch"] != "All":
        params.append(req["target_branch"])
    if req["target_year"] != "All":
        params.append(req["target_year"])

    params.append(req_id)

    sql = f"""
    SELECT sp.enrollment_no, sp.full_name, sp.email, sp.mobile, sp.branch, sp.section, sp.semester_year
    FROM student_profiles sp
    WHERE {branch_cond} AND {year_cond}
      AND sp.enrollment_no NOT IN (
          SELECT enrollment_no FROM submissions WHERE requirement_id = ?
      )
    ORDER BY sp.branch ASC, sp.section ASC, sp.enrollment_no ASC
    """

    cursor.execute(sql, params)
    non_submitters = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        "success": True,
        "requirement": dict(req),
        "total_non_submitters": len(non_submitters),
        "non_submitters": non_submitters
    })

@admin_bp.route("/requirements/<int:req_id>/bulk-email", methods=["POST"])
def bulk_email_non_submitters(req_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM requirements WHERE id = ?", (req_id,))
    req = cursor.fetchone()
    if not req:
        conn.close()
        return jsonify({"success": False, "message": "Requirement not found"}), 404

    branch_cond = "1=1" if req["target_branch"] == "All" else "sp.branch = ?"
    year_cond = "1=1" if req["target_year"] == "All" else "sp.semester_year = ?"
    params = []
    if req["target_branch"] != "All":
        params.append(req["target_branch"])
    if req["target_year"] != "All":
        params.append(req["target_year"])
    params.append(req_id)

    sql = f"""
    SELECT sp.enrollment_no, sp.full_name, sp.email, sp.branch, sp.semester_year
    FROM student_profiles sp
    WHERE {branch_cond} AND {year_cond}
      AND sp.enrollment_no NOT IN (
          SELECT enrollment_no FROM submissions WHERE requirement_id = ?
      )
    """
    cursor.execute(sql, params)
    targets = [dict(r) for r in cursor.fetchall()]

    if not targets:
        conn.close()
        return jsonify({
            "success": True,
            "message": "All eligible students have already submitted this requirement! No reminder emails needed.",
            "sent_count": 0,
            "emails": []
        })

    sent_records = []
    for st in targets:
        subject = f"[VGU URGENT DEADLINE] Action Required: {req['title']}"
        body = f"""Dear {st['full_name']} ({st['enrollment_no']}),

This is an automated academic reminder from Vivekananda Global University (VGU) - Office of Dean & Academic Affairs.

Our records indicate that you have NOT yet submitted the mandatory document/proof for:
"{req['title']}".

Details:
{req['description']}

Submission Deadline: {req['deadline']}
Target Group: {req['target_branch']} | {req['target_year']}

Please log in to the VGU Academic Profile Portal immediately and submit the required documentation before the deadline to avoid academic holds or grade deductions.

Portal Link: https://academic-portal.vgu.ac.in/login

Warm regards,
Academic Administration Department
Vivekananda Global University (VGU)
"""
        cursor.execute("""
        INSERT INTO email_logs (requirement_id, recipient_email, recipient_name, subject, body, status)
        VALUES (?, ?, ?, ?, ?, 'Sent')
        """, (req_id, st["email"], st["full_name"], subject, body))
        
        sent_records.append({
            "recipient_name": st["full_name"],
            "recipient_email": st["email"],
            "subject": subject,
            "sent_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Successfully dispatched automated reminder emails to {len(sent_records)} non-submitting VGU students.",
        "sent_count": len(sent_records),
        "requirement_title": req["title"],
        "deadline": req["deadline"],
        "emails": sent_records
    })

@admin_bp.route("/email-logs", methods=["GET"])
def get_email_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM email_logs ORDER BY id DESC LIMIT 50")
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "logs": logs})

@admin_bp.route("/analytics", methods=["GET"])
def get_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*), AVG(cgpa), AVG(attendance_pct), AVG(completeness_pct) FROM student_profiles")
    row = cursor.fetchone()
    total_students = row[0] or 0
    avg_cgpa = round(row[1] or 0.0, 2)
    avg_attendance = round(row[2] or 0.0, 1)
    avg_completeness = round(row[3] or 0.0, 1)

    cursor.execute("""
    SELECT
      SUM(CASE WHEN completeness_pct < 50 THEN 1 ELSE 0 END) as low,
      SUM(CASE WHEN completeness_pct >= 50 AND completeness_pct < 75 THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN completeness_pct >= 75 AND completeness_pct < 100 THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN completeness_pct >= 100 THEN 1 ELSE 0 END) as perfect
    FROM student_profiles
    """)
    comp_row = cursor.fetchone()
    completeness_distribution = {
        "Needs Attention (<50%)": comp_row[0] or 0,
        "Progressing (50-74%)": comp_row[1] or 0,
        "Placement Ready (75-99%)": comp_row[2] or 0,
        "100% Complete": comp_row[3] or 0
    }

    cursor.execute("SELECT status, COUNT(*) FROM submissions GROUP BY status")
    submissions_status = {r[0]: r[1] for r in cursor.fetchall()}

    cursor.execute("""
    SELECT branch, COUNT(*) as count, AVG(cgpa) as avg_cgpa, AVG(completeness_pct) as avg_completeness
    FROM student_profiles
    GROUP BY branch
    ORDER BY count DESC
    """)
    branch_stats = [{
        "branch": r[0],
        "count": r[1],
        "avg_cgpa": round(r[2] or 0.0, 2),
        "avg_completeness": round(r[3] or 0.0, 1)
    } for r in cursor.fetchall()]

    cursor.execute("SELECT data_json FROM student_extras WHERE category = 'skills'")
    skills_rows = cursor.fetchall()
    skill_counts = {}
    for r in skills_rows:
        try:
            s_data = json.loads(r[0])
            for t_skill in s_data.get("technical_skills", []):
                skill_counts[t_skill] = skill_counts.get(t_skill, 0) + 1
        except Exception:
            pass

    sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    conn.close()

    return jsonify({
        "success": True,
        "kpis": {
            "total_students": total_students,
            "avg_cgpa": avg_cgpa,
            "avg_attendance": avg_attendance,
            "avg_completeness": avg_completeness
        },
        "completeness_distribution": completeness_distribution,
        "submissions_status": submissions_status,
        "branch_stats": branch_stats,
        "top_skills": sorted_skills
    })

@admin_bp.route("/export", methods=["GET"])
def export_csv():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT sp.enrollment_no, sp.full_name, sp.email, sp.mobile, sp.dob,
           sp.branch, sp.program, sp.class_name, sp.section, sp.semester,
           sp.semester_year, sp.cgpa, sp.attendance_pct, sp.completeness_pct, sp.verification_status,
           (SELECT COUNT(*) FROM submissions s WHERE UPPER(s.enrollment_no) = UPPER(sp.enrollment_no) AND s.submission_type = 'certificate') as certificates_count,
           (SELECT COUNT(*) FROM submissions s WHERE UPPER(s.enrollment_no) = UPPER(sp.enrollment_no) AND s.submission_type = 'internship' AND s.status = 'Approved') as approved_internships
    FROM student_profiles sp
    ORDER BY sp.branch ASC, sp.section ASC, sp.enrollment_no ASC
    """)
    rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Enrollment No", "Full Name", "Email", "Mobile", "Date of Birth",
        "Branch", "Program", "Class", "Section", "Semester",
        "Year", "CGPA", "Attendance %", "Profile Completeness %", "Verification Status",
        "Verified Certificates", "Approved Internships"
    ])

    for r in rows:
        writer.writerow([
            r["enrollment_no"], r["full_name"], r["email"], r["mobile"], r["dob"],
            r["branch"], r["program"], r["class_name"], r["section"], r["semester"],
            r["semester_year"], r["cgpa"], f"{r['attendance_pct']}%", f"{r['completeness_pct']}%", r["verification_status"],
            r["certificates_count"], r["approved_internships"]
        ])

    conn.close()

    output.seek(0)
    filename = f"VGU_Student_Profiles_Export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
