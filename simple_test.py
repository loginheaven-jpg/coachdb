import requests
import json

BASE = "http://localhost:8000"

# 1. Login
print("1. Admin login...")
r = requests.post(f"{BASE}/api/auth/login", json={"email": "viproject@naver.com", "password": "test1234"})
print(f"Status: {r.status_code}")
if r.status_code != 200:
    print(f"Error: {r.text}")
    exit(1)
admin_token = r.json()["access_token"]
print(f"Token: {admin_token[:30]}...")

# 2. List projects
print("\n2. List projects...")
r = requests.get(f"{BASE}/api/projects", headers={"Authorization": f"Bearer {admin_token}"})
print(f"Status: {r.status_code}")
print(f"Projects: {json.dumps(r.json(), indent=2)}")

# 3. Create project
print("\n3. Create project...")
r = requests.post(f"{BASE}/api/projects", headers={"Authorization": f"Bearer {admin_token}"}, json={
    "project_name": "Test Project 2025",
    "description": "Test coaching project",
    "recruitment_start_date": "2025-11-05",
    "recruitment_end_date": "2025-11-30",
    "project_start_date": "2025-12-01",
    "project_end_date": "2026-02-28",
    "max_participants": 20,
    "project_manager_id": 4
})
print(f"Status: {r.status_code}")
if r.status_code != 201:
    print(f"Error: {r.text}")
    exit(1)
project = r.json()
project_id = project["project_id"]
print(f"Created project ID: {project_id}")

# 4. Create custom question
print("\n4. Create custom question...")
r = requests.post(f"{BASE}/api/projects/questions", headers={"Authorization": f"Bearer {admin_token}"}, json={
    "project_id": project_id,
    "question_text": "Why do you want to join this project?",
    "question_type": "textarea",
    "is_required": True,
    "display_order": 1
})
print(f"Status: {r.status_code}")
if r.status_code != 201:
    print(f"Error: {r.text}")
    exit(1)
question = r.json()
question_id = question["question_id"]
print(f"Created question ID: {question_id}")

# 5. Update project status to recruiting
print("\n5. Update project to recruiting...")
r = requests.put(f"{BASE}/api/projects/{project_id}", headers={"Authorization": f"Bearer {admin_token}"}, json={
    "status": "recruiting"
})
print(f"Status: {r.status_code}")

# 6. Login as coach
print("\n6. Coach login...")
r = requests.post(f"{BASE}/api/auth/login", json={"email": "newuser@test.com", "password": "test1234"})
print(f"Status: {r.status_code}")
if r.status_code != 200:
    print(f"Error: {r.text}")
    exit(1)
coach_token = r.json()["access_token"]
print("Coach logged in")

# 7. Create application
print("\n7. Create application...")
r = requests.post(f"{BASE}/api/applications", headers={"Authorization": f"Bearer {coach_token}"}, json={
    "project_id": project_id,
    "motivation": "I want to improve my coaching skills",
    "applied_role": "leader"
})
print(f"Status: {r.status_code}")
if r.status_code != 201:
    print(f"Error: {r.text}")
    exit(1)
application = r.json()
application_id = application["application_id"]
print(f"Created application ID: {application_id}")

# 8. Save custom answer
print("\n8. Save custom answer...")
r = requests.post(f"{BASE}/api/applications/{application_id}/answers", headers={"Authorization": f"Bearer {coach_token}"}, json={
    "question_id": question_id,
    "answer_text": "I have 3 years of coaching experience and want to grow as a leader coach.",
    "answer_file_id": None
})
print(f"Status: {r.status_code}")
if r.status_code != 201:
    print(f"Error: {r.text}")

# 9. Submit application
print("\n9. Submit application...")
r = requests.post(f"{BASE}/api/applications/{application_id}/submit", headers={"Authorization": f"Bearer {coach_token}"}, json={
    "motivation": "I want to lead the team",
    "applied_role": "leader",
    "custom_answers": [{
        "question_id": question_id,
        "answer_text": "I have 3 years experience"
    }]
})
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print("Application submitted successfully!")

# 10. Create evaluation (as admin)
print("\n10. Create coach evaluation...")
r = requests.post(f"{BASE}/api/projects/{project_id}/evaluations", headers={"Authorization": f"Bearer {admin_token}"}, json={
    "project_id": project_id,
    "coach_user_id": 1,
    "participation_score": 4,
    "feedback_text": "Excellent participation",
    "special_notes": None
})
print(f"Status: {r.status_code}")
if r.status_code == 201:
    print("Evaluation created successfully!")
else:
    print(f"Error: {r.text}")

print("\n=== All tests completed! ===")
