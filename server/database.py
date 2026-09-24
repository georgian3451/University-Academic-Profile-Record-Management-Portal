import sqlite3
import os
import hashlib
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "academic_portal.db")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL, -- 'student' or 'admin'
        identifier TEXT UNIQUE NOT NULL, -- enrollment_no for student, employee_id for admin
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        mobile TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Student Profiles table (Basic Details compulsory fields + metrics + verification_status)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_profiles (
        enrollment_no TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        dob TEXT,
        branch TEXT NOT NULL,
        program TEXT NOT NULL,
        class_name TEXT NOT NULL,
        section TEXT NOT NULL,
        semester INTEGER NOT NULL,
        mobile TEXT NOT NULL,
        email TEXT NOT NULL,
        semester_year TEXT NOT NULL,
        photo_path TEXT,
        cgpa REAL DEFAULT 0.0,
        attendance_pct REAL DEFAULT 85.0,
        completeness_pct REAL DEFAULT 0.0,
        verification_status TEXT DEFAULT 'Pending', -- 'Pending', 'Verified', 'Rejected'
        verified_by TEXT,
        verified_at TIMESTAMP,
        FOREIGN KEY (enrollment_no) REFERENCES users (identifier)
    )
    """)

    # Student optional profile data
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_extras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_no TEXT NOT NULL,
        category TEXT NOT NULL, -- 'links', 'skills', 'hackathons', 'seminars', 'workshops', 'projects', 'resumes'
        data_json TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(enrollment_no, category),
        FOREIGN KEY (enrollment_no) REFERENCES users (identifier)
    )
    """)

    # Semester-wise SGPA and marksheet
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS semester_marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_no TEXT NOT NULL,
        semester INTEGER NOT NULL,
        sgpa REAL NOT NULL,
        marksheet_file TEXT,
        verified_status TEXT DEFAULT 'Approved',
        UNIQUE(enrollment_no, semester),
        FOREIGN KEY (enrollment_no) REFERENCES users (identifier)
    )
    """)

    # Requirements defined by Admin
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        target_branch TEXT DEFAULT 'All',
        target_year TEXT DEFAULT 'All',
        deadline TEXT NOT NULL,
        is_compulsory INTEGER DEFAULT 0,
        created_by TEXT DEFAULT 'VGU_ADMIN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Migration: add is_compulsory column if it doesn't exist (for existing databases)
    try:
        cursor.execute("ALTER TABLE requirements ADD COLUMN is_compulsory INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass  # Column already exists

    # Submissions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_no TEXT NOT NULL,
        requirement_id INTEGER,
        submission_type TEXT NOT NULL,
        title TEXT NOT NULL,
        issuer_or_org TEXT,
        file_path TEXT,
        file_name TEXT,
        status TEXT DEFAULT 'Pending',
        admin_comment TEXT DEFAULT '',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        FOREIGN KEY (enrollment_no) REFERENCES users (identifier),
        FOREIGN KEY (requirement_id) REFERENCES requirements (id)
    )
    """)

    # OTP Tokens for Password Recovery
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otp_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0
    )
    """)

    # Email Outbox / Audit Log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requirement_id INTEGER,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT DEFAULT 'Sent',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()

    # ── Migrations for existing databases ──────────────────────────────────
    # Add missing columns to student_profiles (existing DB may not have them)
    migrations_student_profiles = [
        "ALTER TABLE student_profiles ADD COLUMN verification_status TEXT DEFAULT 'Pending'",
        "ALTER TABLE student_profiles ADD COLUMN verified_by TEXT",
        "ALTER TABLE student_profiles ADD COLUMN verified_at TIMESTAMP",
        "ALTER TABLE student_profiles ADD COLUMN photo_path TEXT",
        "ALTER TABLE student_profiles ADD COLUMN cgpa REAL DEFAULT 0.0",
        "ALTER TABLE student_profiles ADD COLUMN attendance_pct REAL DEFAULT 85.0",
        "ALTER TABLE student_profiles ADD COLUMN completeness_pct REAL DEFAULT 0.0",
    ]
    for mig in migrations_student_profiles:
        try:
            cursor.execute(mig)
            conn.commit()
        except Exception:
            pass  # Column already exists

    conn.close()


def seed_sample_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if data already seeded
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0:
        conn.close()
        return

    default_pw = hash_password("pass123")

    # Seed Admins - VGU
    admins = [
        ("admin", "ADM-1001", "Dr. Rajesh Sharma", "dean.academics@vgu.ac.in", "9876543210", default_pw),
        ("admin", "ADM-1002", "Prof. Sunita Rao", "sunita.rao@vgu.ac.in", "9876543211", default_pw)
    ]
    cursor.executemany("INSERT INTO users (role, identifier, name, email, mobile, password_hash) VALUES (?, ?, ?, ?, ?, ?)", admins)

    # Seed Students across various branches and sections
    students = [
        ("student", "EN2023SE042", "Aman Verma", "aman.verma@vgu.ac.in", "9898981234", default_pw),
        ("student", "EN2023AI015", "Priya Sharma", "priya.sharma@vgu.ac.in", "9876501234", default_pw),
        ("student", "EN2023DS088", "Rohan Gupta", "rohan.gupta@vgu.ac.in", "9812345678", default_pw),
        ("student", "EN2022SE019", "Ananya Iyer", "ananya.iyer@vgu.ac.in", "9845612378", default_pw),
        ("student", "EN2022AI034", "Vikram Patel", "vikram.patel@vgu.ac.in", "9823456789", default_pw),
        ("student", "EN2024CS005", "Sneha Nair", "sneha.nair@vgu.ac.in", "9871234560", default_pw),
        ("student", "EN2023CS077", "Arjun Reddy", "arjun.reddy@vgu.ac.in", "9865432109", default_pw),
        ("student", "EN2023DS012", "Tanvi Mehta", "tanvi.mehta@vgu.ac.in", "9854321098", default_pw)
    ]
    cursor.executemany("INSERT INTO users (role, identifier, name, email, mobile, password_hash) VALUES (?, ?, ?, ?, ?, ?)", students)

    # Seed Student Profiles with verification_status ('Verified' or 'Pending')
    profiles = [
        # enrollment, name, dob, branch, prog, class, sec, sem, mob, email, year, photo, cgpa, att, completeness, verification_status
        ("EN2023SE042", "Aman Verma", "2003-05-14", "Software Engineering", "B.Tech", "SE-3A", "Section A", 6, "9898981234", "aman.verma@vgu.ac.in", "3rd Year", "/static/images/avatars/student1.svg", 8.85, 92.0, 92.0, "Verified"),
        ("EN2023AI015", "Priya Sharma", "2003-08-22", "AIML", "B.Tech", "AI-3A", "Section A", 6, "9876501234", "priya.sharma@vgu.ac.in", "3rd Year", "/static/images/avatars/student2.svg", 9.40, 96.5, 95.0, "Verified"),
        ("EN2023DS088", "Rohan Gupta", "2003-11-10", "Data Science", "B.Tech", "DS-3B", "Section B", 6, "9812345678", "rohan.gupta@vgu.ac.in", "3rd Year", "/static/images/avatars/student3.svg", 7.65, 81.0, 68.0, "Verified"),
        ("EN2022SE019", "Ananya Iyer", "2002-03-30", "Software Engineering", "B.Tech", "SE-4A", "Section A", 8, "9845612378", "ananya.iyer@vgu.ac.in", "4th Year", "/static/images/avatars/student4.svg", 9.12, 94.0, 90.0, "Verified"),
        ("EN2022AI034", "Vikram Patel", "2002-09-18", "AIML", "B.Tech", "AI-4B", "Section B", 8, "9823456789", "vikram.patel@vgu.ac.in", "4th Year", "/static/images/avatars/student5.svg", 6.80, 74.0, 48.0, "Verified"),
        ("EN2024CS005", "Sneha Nair", "2004-01-12", "Software Engineering", "B.Tech", "SE-2A", "Section A", 4, "9871234560", "sneha.nair@vgu.ac.in", "2nd Year", "", 8.50, 89.0, 75.0, "Verified"),
        ("EN2023CS077", "Arjun Reddy", "2003-07-04", "Data Science", "B.Tech", "DS-3A", "Section A", 6, "9865432109", "arjun.reddy@vgu.ac.in", "3rd Year", "", 8.15, 87.0, 62.0, "Verified"),
        # Tanvi Mehta seeded as 'Pending' to demonstrate new profile waiting for admin approval
        ("EN2023DS012", "Tanvi Mehta", "2003-12-01", "AIML", "B.Tech", "AI-3A", "Section A", 6, "9854321098", "tanvi.mehta@vgu.ac.in", "3rd Year", "", 7.90, 84.0, 58.0, "Pending")
    ]
    cursor.executemany("""
    INSERT INTO student_profiles (
        enrollment_no, full_name, dob, branch, program, class_name, section, semester, mobile, email, semester_year, photo_path, cgpa, attendance_pct, completeness_pct, verification_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, profiles)

    # Seed Extras for Aman Verma (EN2023SE042)
    extras = [
        ("EN2023SE042", "links", json.dumps({
            "linkedin": "https://linkedin.com/in/aman-verma-vgu",
            "github": "https://github.com/amanverma-code",
            "leetcode": "https://leetcode.com/u/aman_v",
            "codeforces": "https://codeforces.com/profile/aman_v"
        })),
        ("EN2023SE042", "skills", json.dumps({
            "soft_skills": ["Leadership", "Technical Communication", "Agile Teamwork", "Problem Solving"],
            "technical_skills": ["Python", "JavaScript", "React", "Node.js", "Docker", "PostgreSQL", "REST APIs"],
            "target_roles": ["Full-Stack Software Engineer", "Backend Systems Architect", "Cloud Engineer"]
        })),
        ("EN2023SE042", "projects", json.dumps([
            {
                "id": 1,
                "title": "Cloud-Native Microservices Telemetry Dashboard",
                "tech_stack": "Go, React, Prometheus, Docker",
                "demo_url": "https://telemetry.amanv.dev",
                "repo_url": "https://github.com/amanverma-code/telemetry-monitor",
                "description": "High-throughput metric collector and real-time visualization dashboard supporting up to 10k events/sec with sub-millisecond alerting.",
                "file_name": "telemetry_architecture_report.pdf"
            },
            {
                "id": 2,
                "title": "Autonomous VGU Campus Navigation System",
                "tech_stack": "Python, OpenCV, Flask, Graph Algorithms",
                "demo_url": "https://campus-nav.vgu.ac.in",
                "repo_url": "https://github.com/amanverma-code/campus-navigator",
                "description": "Interactive multi-floor indoor mapping and shortest-path navigation for VGU campus visitors and students.",
                "file_name": "campus_navigation_docs.pdf"
            }
        ])),
        ("EN2023SE042", "hackathons", json.dumps([
            {
                "id": 1,
                "name": "Smart India Hackathon 2025",
                "role": "Team Lead & Full-Stack Architect",
                "project_name": "AgriSense: IoT Crop Yield Predictor",
                "result": "1st Runner Up (Cash Prize ₹75,000)",
                "date": "2025-11-20",
                "proof_file": "sih2025_certificate.pdf"
            }
        ])),
        ("EN2023SE042", "seminars", json.dumps({
            "organized": [
                {
                    "id": 1,
                    "title": "VGU Annual Open Source Summit 2025",
                    "role": "Lead Student Organizer",
                    "date": "2025-10-14",
                    "proof_file": "oss_lead_organizer_letter.pdf",
                    "image_url": "/static/images/campus_crest.svg"
                }
            ],
            "participated": [
                {
                    "id": 1,
                    "title": "International Conference on Distributed Systems (ICDS)",
                    "organizer": "IEEE Computer Society",
                    "date": "2025-08-05",
                    "proof_file": "icds_participation.pdf",
                    "image_url": ""
                }
            ]
        })),
        ("EN2023SE042", "workshops", json.dumps([
            {
                "id": 1,
                "topic": "Kubernetes & Production Cloud Deployments",
                "conducted_by": "CNCF Student Chapter VGU",
                "date": "2025-09-12",
                "proof_file": "k8s_workshop_cert.pdf",
                "image_url": "/static/images/campus_crest.svg"
            }
        ])),
        ("EN2023SE042", "resumes", json.dumps({
            "filename": "Aman_Verma_Resume_2026.pdf",
            "uploaded_at": "2026-02-10 14:30:00",
            "file_path": "uploads/Students/Software Engineering/Section A/EN2023SE042/resume/Aman_Verma_Resume_2026.pdf"
        }))
    ]
    cursor.executemany("INSERT INTO student_extras (enrollment_no, category, data_json) VALUES (?, ?, ?)", extras)

    # Seed semester marks for Aman Verma
    marks = [
        ("EN2023SE042", 1, 8.60, "sem1_marksheet.pdf", "Approved"),
        ("EN2023SE042", 2, 8.75, "sem2_marksheet.pdf", "Approved"),
        ("EN2023SE042", 3, 8.90, "sem3_marksheet.pdf", "Approved"),
        ("EN2023SE042", 4, 8.80, "sem4_marksheet.pdf", "Approved"),
        ("EN2023SE042", 5, 9.20, "sem5_marksheet.pdf", "Approved")
    ]
    cursor.executemany("INSERT INTO semester_marks (enrollment_no, semester, sgpa, marksheet_file, verified_status) VALUES (?, ?, ?, ?, ?)", marks)

    # Seed Academic Requirements from Admin
    req_deadline_1 = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
    req_deadline_2 = (datetime.now() + timedelta(days=12)).strftime("%Y-%m-%d")
    req_deadline_past = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")

    requirements = [
        ("Summer Internship Completion Certificate 2026", "Compulsory 8-week internship completion certificate and industry mentor evaluation sign-off for VGU students.", "All", "3rd Year", req_deadline_1, "ADM-1001"),
        ("Distributed Cloud Computing Capstone Report", "Submit project repository URL, architecture diagram, and benchmark report.", "Software Engineering", "3rd Year", req_deadline_2, "ADM-1001"),
        ("NPTEL / Coursera Mooc Certification Proof", "Mandatory credit transfer verification document for online elective.", "AIML", "3rd Year", req_deadline_past, "ADM-1002")
    ]
    cursor.executemany("INSERT INTO requirements (title, description, target_branch, target_year, deadline, created_by) VALUES (?, ?, ?, ?, ?, ?)", requirements)

    # Seed Submissions
    submissions = [
        ("EN2023SE042", 1, "internship", "Google Cloud Summer Fellowship Completion", "Google Cloud", "uploads/Students/Software Engineering/Section A/EN2023SE042/certificates/gcp_internship.pdf", "gcp_internship.pdf", "Pending", "", "2026-03-01 10:00:00", None),
        ("EN2023SE042", None, "certificate", "AWS Certified Solutions Architect Associate", "Amazon Web Services", "uploads/Students/Software Engineering/Section A/EN2023SE042/certificates/aws_saa.pdf", "aws_saa.pdf", "Approved", "Verified via AWS Credential Registry. Excellent achievement!", "2026-02-15 11:30:00", "2026-02-16 09:15:00"),
        ("EN2023SE042", None, "certificate", "Docker Certified Associate (DCA)", "Docker Inc.", "uploads/Students/Software Engineering/Section A/EN2023SE042/certificates/docker_dca.pdf", "docker_dca.pdf", "Approved", "Verified valid credential ID.", "2026-02-18 16:45:00", "2026-02-19 14:20:00"),
        ("EN2023AI015", 1, "internship", "DeepMind Research Mentorship", "Google DeepMind", "uploads/Students/AIML/Section A/EN2023AI015/certificates/deepmind_intern.pdf", "deepmind_intern.pdf", "Approved", "Outstanding mentorship letter and evaluation report.", "2026-02-28 14:00:00", "2026-03-02 11:00:00"),
        ("EN2023DS088", 1, "internship", "Data Analytics Trainee Proof", "Infosys", "uploads/Students/Data Science/Section B/EN2023DS088/certificates/infosys_proof.pdf", "infosys_proof.pdf", "Rejected", "Certificate is missing official seal and mentor signature. Please re-upload verified copy.", "2026-03-05 12:00:00", "2026-03-06 15:30:00"),
        ("EN2022SE019", None, "certificate", "Certified Kubernetes Administrator (CKA)", "Linux Foundation", "uploads/Students/Software Engineering/Section A/EN2022SE019/certificates/cka_cert.pdf", "cka_cert.pdf", "Approved", "Valid CKA verification string confirmed.", "2026-01-20 09:30:00", "2026-01-21 16:00:00"),
        ("EN2022AI034", 1, "internship", "Computer Vision Intern", "TCS Research", "uploads/Students/AIML/Section B/EN2022AI034/certificates/tcs_cv.pdf", "tcs_cv.pdf", "Pending", "", "2026-03-10 17:15:00", None)
    ]
    cursor.executemany("""
    INSERT INTO submissions (
        enrollment_no, requirement_id, submission_type, title, issuer_or_org, file_path, file_name, status, admin_comment, submitted_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, submissions)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    seed_sample_data()
    print("VGU Database initialized and seeded successfully!")
