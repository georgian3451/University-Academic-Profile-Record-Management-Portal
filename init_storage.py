import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
STUDENTS_DIR = os.path.join(UPLOADS_DIR, "Students")

students = [
    ("Software Engineering", "Section A", "EN2023SE042"),
    ("AIML", "Section A", "EN2023AI015"),
    ("Data Science", "Section B", "EN2023DS088"),
    ("Software Engineering", "Section A", "EN2022SE019"),
    ("AIML", "Section B", "EN2022AI034"),
    ("Software Engineering", "Section A", "EN2024CS005"),
    ("Data Science", "Section A", "EN2023CS077"),
    ("AIML", "Section A", "EN2023DS012")
]

subfolders = ["basic_details", "marks", "certificates", "resume", "other_uploaded_files"]

for branch, section, enrollment in students:
    student_dir = os.path.join(STUDENTS_DIR, branch, section, enrollment)
    for sub in subfolders:
        path = os.path.join(student_dir, sub)
        os.makedirs(path, exist_ok=True)
        # Create a sample placeholder/info doc inside
        info_file = os.path.join(path, ".info")
        with open(info_file, "w") as f:
            f.write(f"Category: {sub}\nStudent: {enrollment}\nBranch: {branch}\nSection: {section}\n")

# Copy sample resume and certificate files for Aman Verma (EN2023SE042)
aman_resume_dir = os.path.join(STUDENTS_DIR, "Software Engineering", "Section A", "EN2023SE042", "resume")
with open(os.path.join(aman_resume_dir, "Aman_Verma_Resume_2026.pdf"), "w") as f:
    f.write("%PDF-1.4 Mock Resume Document for Aman Verma (Software Engineering)")

aman_cert_dir = os.path.join(STUDENTS_DIR, "Software Engineering", "Section A", "EN2023SE042", "certificates")
with open(os.path.join(aman_cert_dir, "aws_saa.pdf"), "w") as f:
    f.write("%PDF-1.4 Mock AWS Certified Solutions Architect Associate Certificate")
with open(os.path.join(aman_cert_dir, "docker_dca.pdf"), "w") as f:
    f.write("%PDF-1.4 Mock Docker Certified Associate Certificate")
with open(os.path.join(aman_cert_dir, "gcp_internship.pdf"), "w") as f:
    f.write("%PDF-1.4 Mock GCP Summer Fellowship Completion Certificate")

print("Hierarchical student storage initialized successfully!")
