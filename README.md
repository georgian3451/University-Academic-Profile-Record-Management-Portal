# University Academic Profile Portal (VGU)

A full-stack, enterprise-grade academic management and student portfolio system built with Flask, SQLite, and modern responsive web technologies. It features role-based access for students and administrators, hierarchical document management, verification workflows, and academic progress tracking.

---

## 🌟 Key Features

### 🎓 Student Portal
- **Dashboard & Academics**: View CGPA, attendance statistics, current semester marks, and credit requirements.
- **Dynamic Profile Completeness**: Real-time progress bar tracking completeness of student records and documentation.
- **Hierarchical Document Upload**: Categorized uploads into structured storage (`basic_details`, `marks`, `certificates`, `resume`, and `other_uploaded_files`).
- **Profile Verification Status**: Live status tracking (`Verified`, `Pending`, `Rejected`) with admin review remarks.
- **Projects & Publications**: Showcase academic projects, tech stacks, certifications, and research papers.

### 🛡️ Faculty / Administrator Portal
- **Student Record Management**: Filter, search, and browse students by department, section, and status.
- **Verification Workflow**: Review, approve, or reject student profile updates with comments and audit logs.
- **Academic Requirements Broadcast**: Create and broadcast institutional requirements and document deadlines.
- **Analytics & Reporting**: Export comprehensive student records and metrics in CSV format.
- **Storage Browser**: Inspect structured student folders and uploaded verification documents.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Python 3.x, Flask, SQLite3, Flask-CORS
- **Frontend**: Vanilla HTML5, modern CSS3 (Custom design system, glassmorphism, responsive grid), Vanilla JavaScript (ES6+ modular architecture)
- **Storage**: Organized file-system hierarchy under `uploads/Students/{Branch}/{Section}/{EnrollmentNo}/{Category}/`

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Git

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd tdp-demo1
```

### 2. Setup Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Initialize Database & Storage
```bash
# Optional: Pre-populate sample hierarchical directories & mock files
python init_storage.py
```

### 5. Run the Application
```bash
python run.py
```
The application will launch at: [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## 🔑 Demo Credentials

All seeded demo accounts use the default password: **`pass123`**

| Role | Identifier (User ID) | Name | Department |
| :--- | :--- | :--- | :--- |
| **Admin** | `ADM-1001` | Dr. Rajesh Sharma | Dean Academics |
| **Admin** | `ADM-1002` | Prof. Sunita Rao | Computer Science |
| **Student** | `EN2023SE042` | Aman Verma | Software Engineering |
| **Student** | `EN2023AI015` | Priya Sharma | AIML |
| **Student** | `EN2023DS088` | Rohan Gupta | Data Science |

---

## 📁 Project Structure

```text
├── academic_portal.db       # SQLite database (auto-generated on launch)
├── create_avatars.py        # Avatar generation utility
├── init_storage.py          # Storage folder initialization utility
├── requirements.txt         # Python dependencies
├── run.py                   # Application entry point
├── server/
│   ├── app.py               # Flask app factory and routing
│   ├── auth.py              # Authentication & session token management
│   ├── database.py          # SQLite schema, migrations & seed records
│   ├── routes_admin.py      # Admin verification & reporting endpoints
│   ├── routes_student.py    # Student profile & upload endpoints
│   └── storage_manager.py   # Hierarchical file storage management
├── static/
│   ├── css/styles.css       # Unified design system & responsive styling
│   ├── images/              # Logos and SVGs
│   ├── js/                  # Frontend modular JavaScript
│   └── index.html           # Single-page interface container
└── uploads/                 # Structured document storage (git-ignored)
```

---

## 📄 License
This project is licensed under the MIT License.
