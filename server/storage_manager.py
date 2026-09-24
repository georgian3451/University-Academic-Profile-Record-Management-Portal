import os
import shutil
import re

UPLOAD_BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
STUDENTS_BASE_DIR = os.path.join(UPLOAD_BASE_DIR, "Students")

ALLOWED_CATEGORIES = {
    "basic_details": "basic_details",
    "marks": "marks",
    "certificates": "certificates",
    "resume": "resume",
    "other uploaded files": "other_uploaded_files",
    "other_uploaded_files": "other_uploaded_files"
}

ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "webp", "gif",
    "pdf", "doc", "docx", "txt", "zip"
}

def sanitize_folder_name(name: str) -> str:
    """Sanitize directory names while preserving readability"""
    if not name:
        return "Unassigned"
    # Clean characters not safe for Windows paths
    cleaned = re.sub(r'[\\/*?:"<>|]', "", name).strip()
    return cleaned if cleaned else "General"

def get_student_dir(branch: str, section: str, enrollment_no: str) -> str:
    """
    Returns the absolute path to the student's root folder:
    uploads/Students/<Branch>/<Section>/<Enrollment Number>/
    """
    safe_branch = sanitize_folder_name(branch)
    safe_section = sanitize_folder_name(section)
    safe_enrollment = sanitize_folder_name(enrollment_no)
    
    student_dir = os.path.join(STUDENTS_BASE_DIR, safe_branch, safe_section, safe_enrollment)
    return student_dir

def init_student_structure(branch: str, section: str, enrollment_no: str) -> dict:
    """
    Initializes the required hierarchical folder structure:
    ├── basic_details
    ├── marks
    ├── certificates
    ├── resume
    └── other uploaded files
    """
    student_dir = get_student_dir(branch, section, enrollment_no)
    category_paths = {}
    
    categories = ["basic_details", "marks", "certificates", "resume", "other_uploaded_files"]
    for cat in categories:
        cat_path = os.path.join(student_dir, cat)
        os.makedirs(cat_path, exist_ok=True)
        category_paths[cat] = cat_path
        
    return {
        "student_dir": student_dir,
        "categories": category_paths
    }

def is_allowed_file(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS

def save_uploaded_file(branch: str, section: str, enrollment_no: str, category: str, file_storage) -> dict:
    """
    Saves an uploaded file into the proper hierarchical category folder.
    Returns relative path and metadata.
    """
    cat_key = category.lower().replace(" ", "_")
    folder_name = ALLOWED_CATEGORIES.get(cat_key, "other_uploaded_files")
    
    student_dir = get_student_dir(branch, section, enrollment_no)
    target_dir = os.path.join(student_dir, folder_name)
    os.makedirs(target_dir, exist_ok=True)
    
    original_filename = file_storage.filename
    safe_filename = re.sub(r'[\\/*?:"<>| ]', "_", original_filename)
    
    # Avoid collisions with timestamp or counter
    dest_path = os.path.join(target_dir, safe_filename)
    if os.path.exists(dest_path):
        base, ext = os.path.splitext(safe_filename)
        import time
        safe_filename = f"{base}_{int(time.time())}{ext}"
        dest_path = os.path.join(target_dir, safe_filename)
        
    file_storage.save(dest_path)
    
    # Build a relative path for web serving
    rel_path = os.path.relpath(dest_path, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    rel_web_path = rel_path.replace("\\", "/")
    
    return {
        "original_name": original_filename,
        "saved_name": safe_filename,
        "file_path": rel_web_path,
        "size_bytes": os.path.getsize(dest_path),
        "category": folder_name
    }
