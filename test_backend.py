import urllib.request
import urllib.parse
import json
import io

BASE_URL = "http://127.0.0.1:5000"

def api_post(endpoint, data):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def api_get(endpoint):
    url = f"{BASE_URL}{endpoint}"
    with urllib.request.urlopen(url) as res:
        return json.loads(res.read().decode("utf-8"))

def run_tests():
    print("=== STARTING BACKEND API VERIFICATION TESTS ===")

    # 1. Test Student Login
    print("\n[1] Testing Student Login...")
    res = api_post("/api/auth/login", {"role": "student", "identifier": "EN2023SE042", "password": "pass123"})
    assert res["success"] is True, "Student login failed"
    print("[OK] Student login successful:", res["user"]["name"])

    # 2. Test Admin Login
    print("\n[2] Testing Admin Login...")
    res = api_post("/api/auth/login", {"role": "admin", "identifier": "ADM-1001", "password": "pass123"})
    assert res["success"] is True, "Admin login failed"
    print("[OK] Admin login successful:", res["user"]["name"])

    # 3. Test Forgot Password OTP Flow
    print("\n[3] Testing Mobile OTP Password Recovery...")
    res = api_post("/api/auth/forgot-password/request-otp", {"role": "student", "identifier": "EN2023SE042"})
    assert res["success"] is True, "OTP request failed"
    otp = res["simulated_otp"]
    print(f"[OK] OTP generated: {otp} dispatched to {res['masked_mobile']}")

    res_verify = api_post("/api/auth/forgot-password/verify-otp", {"identifier": "EN2023SE042", "otp": otp})
    assert res_verify["success"] is True, "OTP verification failed"
    print("[OK] OTP verified successfully")

    res_reset = api_post("/api/auth/forgot-password/reset", {
        "identifier": "EN2023SE042", "otp": otp, "new_password": "pass123_new"
    })
    assert res_reset["success"] is True, "Password reset failed"
    print("[OK] Password reset to new password")

    # Reset back to pass123
    res_otp2 = api_post("/api/auth/forgot-password/request-otp", {"role": "student", "identifier": "EN2023SE042"})
    api_post("/api/auth/forgot-password/reset", {
        "identifier": "EN2023SE042", "otp": res_otp2["simulated_otp"], "new_password": "pass123"
    })
    print("[OK] Reset back to default test password")

    # 4. Test Student Profile & Completeness
    print("\n[4] Testing Student Profile & Live Completeness...")
    prof = api_get("/api/student/profile?enrollment_no=EN2023SE042")
    assert prof["success"] is True, "Profile fetch failed"
    print(f"[OK] Student profile retrieved. Completeness: {prof['profile']['completeness_pct']}%")

    # 5. Test Admin Multi-Criteria Filter
    print("\n[5] Testing Admin Student Filter Engine...")
    filter_res = api_get("/api/admin/students?branch=Software%20Engineering&min_cgpa=8.0")
    assert filter_res["success"] is True, "Admin filter failed"
    print(f"[OK] Filter returned {filter_res['total']} Software Engineering students with CGPA >= 8.0")

    # 6. Test Submissions Review Queue
    print("\n[6] Testing Submission Review Action...")
    subs = api_get("/api/admin/submissions?status=Pending")
    assert subs["success"] is True, "Failed to get submissions"
    if subs["submissions"]:
        sub_id = subs["submissions"][0]["id"]
        review_res = api_post(f"/api/admin/submissions/{sub_id}/review", {
            "status": "Approved", "admin_comment": "Verified and accepted by faculty board."
        })
        assert review_res["success"] is True, "Review failed"
        print(f"[OK] Submission #{sub_id} reviewed and Approved")

    # 7. Test Admin Requirement Creation & Bulk Email Reminder
    print("\n[7] Testing Requirement Creation & Bulk Email Reminders...")
    new_req = api_post("/api/admin/requirements", {
        "title": "Semester 6 Industrial Training Sign-Off",
        "description": "Submit signed evaluation letter from department liaison.",
        "target_branch": "Software Engineering",
        "target_year": "3rd Year",
        "deadline": "2026-04-15"
    })
    assert new_req["success"] is True, "Requirement creation failed"
    req_id = new_req["requirement_id"]
    print(f"[OK] Requirement created with ID {req_id}")

    non_subs = api_get(f"/api/admin/requirements/{req_id}/non-submitters")
    print(f"[OK] Found {non_subs['total_non_submitters']} non-submitting students for Requirement #{req_id}")

    # Test Bulk 'Send Mail' action
    bulk_mail = api_post(f"/api/admin/requirements/{req_id}/bulk-email", {})
    assert bulk_mail["success"] is True, "Bulk email failed"
    print(f"[OK] Bulk 'Send Mail' dispatched automated reminders to {bulk_mail['sent_count']} students at once!")

    # 8. Test Analytics Endpoint
    print("\n[8] Testing Analytics & KPI Stats...")
    analytics = api_get("/api/admin/analytics")
    assert analytics["success"] is True, "Analytics failed"
    print("[OK] Analytics retrieved successfully. Total students:", analytics["kpis"]["total_students"],
          "Avg CGPA:", analytics["kpis"]["avg_cgpa"])

    # 9. Test CSV Export Endpoint
    print("\n[9] Testing CSV Export...")
    with urllib.request.urlopen(f"{BASE_URL}/api/admin/export") as csv_res:
        content = csv_res.read().decode("utf-8")
        assert "Enrollment No,Full Name" in content
        print(f"[OK] CSV export verified ({len(content.splitlines())} lines generated)")

    print("\n=== ALL BACKEND API TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
