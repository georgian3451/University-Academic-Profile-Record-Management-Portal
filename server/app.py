import os
from flask import Flask, send_from_directory, render_template_string, jsonify
from flask_cors import CORS
from .database import init_db, seed_sample_data
from .auth import auth_bp
from .routes_student import student_bp
from .routes_admin import admin_bp

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

def create_app():
    app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")
    CORS(app)

    # Initialize DB and seeds
    with app.app_context():
        init_db()
        seed_sample_data()

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(student_bp, url_prefix="/api/student")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    @app.route("/")
    def index():
        return send_from_directory(STATIC_DIR, "index.html")

    @app.route("/uploads/<path:filename>")
    def serve_uploads(filename):
        return send_from_directory(UPLOADS_DIR, filename)

    @app.route("/api/health")
    def health_check():
        return jsonify({"status": "healthy", "service": "Academic Profile Portal API"})

    return app

if __name__ == "__main__":
    app = create_app()
    print("Starting Academic Profile Portal on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
