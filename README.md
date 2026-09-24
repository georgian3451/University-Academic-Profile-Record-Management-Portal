# 🎓 University Academic Profile & Record Management Portal

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

A full-stack, enterprise-grade academic management system and digital portfolio portal designed for universities and colleges. Built with a lightweight **Flask REST backend**, **SQLite database**, and an ultra-modern, responsive **Vanilla CSS/JS single-page frontend**.

---

## ✨ Features at a Glance

### 👨‍🎓 Student Dashboard & Portfolio
- **Academic Overview**: Real-time display of CGPA, semester attendance percentage, credits, and current courses.
- **Dynamic Profile Completeness Bar**: Real-time indicator measuring completion of required documents, academic details, and personal profile data.
- **Hierarchical Document Upload**: Organized file-system structure categorizing uploads into:
  - `basic_details` (ID proof, admission documents)
  - `marks` (Semester grade cards & marksheets)
  - `certificates` (Certifications, MOOCs, awards)
  - `resume` (Updated CV in PDF format)
  - `other_uploaded_files` (Extracurricular & research docs)
- **Profile Verification Workflow**: Track profile approval status (`Pending`, `Verified`, `Rejected`) with admin review timestamps and remarks.
- **Academic Highlights**: Showcase projects, technical skills, competitive programming stats, and publications.
- **Security & Password Recovery**: Mobile OTP simulation flow for resetting passwords securely.

### 👩‍💼 Administrator & Faculty Portal
- **Student Directory**: Multi-criteria search and filtering by department (Software Engineering, AIML, Data Science), section, and verification status.
- **Verification Desk**: Granular profile inspection to verify or reject student documents with feedback remarks.
- **Requirement Broadcasting**: Post official academic deadlines, submission guidelines, and department circulars.
- **Data Export & Reporting**: One-click dynamic CSV export of filtered student academic rosters and document statuses.
- **File System Explorer**: Dedicated view into the physical storage hierarchy for auditing uploaded files.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────┐
│             Single Page Application (SPA)              │
│       HTML5 • Modular ES6+ JavaScript • Modern CSS3    │
└──────────────────────────┬─────────────────────────────┘
                           │ JSON REST / Multipart Uploads
┌──────────────────────────▼─────────────────────────────┐
│                   Flask API Server                     │
│  ├── Auth Blueprint        (/api/auth)                 │
│  ├── Student Blueprint     (/api/student)              │
│  └── Admin Blueprint       (/api/admin)                │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
┌─────────────▼─────────────┐   ┌──────────▼─────────────┐
│       SQLite Engine       │   │  Hierarchical Storage  │
│  Users, Profiles, Marks,  │   │  Branch/Section/ID/    │
│  Requirements, Submissions│   │  Document Categories   │
└───────────────────────────┘   └────────────────────────┘
```

---

## 📁 Repository Structure

```text
├── run.py                     # Main application runner
├── requirements.txt           # Python dependency definitions
├── .gitignore                 # Excludes caches, SQLite DB, and personal documents
├── test_backend.py            # Automated API verification test suite
├── init_storage.py            # Utility to build directory hierarchy & mock storage
├── create_avatars.py          # SVG avatar generation utility
├── server/
│   ├── app.py                 # Flask factory, blueprint registration & CORS
│   ├── auth.py                # Session authentication & OTP password reset
│   ├── database.py            # SQLite schema, seeds & query helpers
│   ├── routes_admin.py        # Admin endpoints, verification & CSV reporting
│   ├── routes_student.py      # Student profile management & file uploads
│   └── storage_manager.py     # File validation and directory hierarchy routing
├── static/
│   ├── index.html             # Main single-page web interface
│   ├── css/
│   │   └── styles.css         # Modern design tokens, glassmorphism & components
│   ├── js/
│   │   ├── api.js             # Fetch wrapper & API client
│   │   ├── app.js             # Route coordinator & authentication state
│   │   ├── student.js         # Student dashboard rendering & upload logic
│   │   └── admin.js           # Admin management table, verification & exports
│   └── images/                # University crest, icons, and avatars
└── uploads/                   # Local file storage (hierarchical structure)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.9 or higher
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
cd tdp-demo1
```

### 2. Create & Activate Virtual Environment

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Required Dependencies
```bash
pip install -r requirements.txt
```

### 4. (Optional) Initialize Sample Data & Folders
```bash
python init_storage.py
```

### 5. Launch the Server
```bash
python run.py
```
Open your browser and navigate to: **`http://127.0.0.1:5000`**

---

## 🔑 Default Demo Accounts

All pre-seeded demo accounts use password: **`pass123`**

| Role | Identifier / User ID | Name | Department / Branch |
| :--- | :--- | :--- | :--- |
| **Admin** | `ADM-1001` | Dr. Rajesh Sharma | Dean of Academics |
| **Admin** | `ADM-1002` | Prof. Sunita Rao | Computer Science & Engineering |
| **Student** | `EN2023SE042` | Aman Verma | Software Engineering (Section A) |
| **Student** | `EN2023AI015` | Priya Sharma | AIML (Section A) |
| **Student** | `EN2023DS088` | Rohan Gupta | Data Science (Section B) |
| **Student** | `EN2023DS012` | Tanvi Mehta | Data Science *(Pending Approval)* |

---

## 🧪 Running Automated Tests

A complete backend API test suite is included to verify authentication, OTP resets, student updates, and administrative actions:

```bash
# Ensure server is running in one terminal (python run.py)
# Then in a second terminal:
python test_backend.py
```

---

## 📡 REST API Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate student or admin credentials |
| `POST` | `/api/auth/forgot-password/request-otp` | Request password reset OTP |
| `POST` | `/api/auth/forgot-password/verify-otp` | Verify received OTP code |
| `POST` | `/api/auth/forgot-password/reset` | Reset account password |
| `GET` | `/api/student/profile/<enrollment_no>` | Get student profile details |
| `POST` | `/api/student/profile/<enrollment_no>` | Update profile metadata |
| `POST` | `/api/student/upload` | Upload document to categorized storage |
| `GET` | `/api/student/files/<enrollment_no>` | List uploaded files by category |
| `GET` | `/api/admin/students` | Search and filter student records |
| `POST` | `/api/admin/verify` | Verify or reject student profile |
| `GET` | `/api/admin/export-csv` | Download student roster as CSV |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
