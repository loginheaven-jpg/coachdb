"""
API 테스트 스크립트
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def login(email, password):
    """로그인하고 토큰 반환"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": email, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"로그인 실패: {response.json()}")
        return None

def test_project_list(token):
    """프로젝트 목록 조회"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/api/projects", headers=headers)
    print(f"\n=== 프로젝트 목록 조회 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()

def test_create_project(token):
    """프로젝트 생성"""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "project_name": "2025년 상반기 코칭 과제",
        "description": "상반기 리더코치 양성 프로그램",
        "recruitment_start_date": "2025-11-05",
        "recruitment_end_date": "2025-11-30",
        "project_start_date": "2025-12-01",
        "project_end_date": "2026-02-28",
        "max_participants": 20,
        "project_manager_id": 4
    }
    response = requests.post(f"{BASE_URL}/api/projects", headers=headers, json=data)
    print(f"\n=== 프로젝트 생성 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json() if response.status_code == 201 else None

def test_create_custom_question(token, project_id):
    """커스텀 질문 생성"""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "project_id": project_id,
        "question_text": "본 과제에 지원하게 된 동기는 무엇인가요?",
        "question_type": "textarea",
        "is_required": True,
        "display_order": 1
    }
    response = requests.post(f"{BASE_URL}/api/projects/questions", headers=headers, json=data)
    print(f"\n=== 커스텀 질문 생성 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json() if response.status_code == 201 else None

def test_get_project_questions(token, project_id):
    """프로젝트 질문 목록 조회"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/api/projects/{project_id}/questions", headers=headers)
    print(f"\n=== 프로젝트 질문 목록 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()

def test_create_application(token, project_id):
    """지원서 생성"""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "project_id": project_id,
        "motivation": "코칭 역량을 강화하고 싶습니다",
        "applied_role": "leader"
    }
    response = requests.post(f"{BASE_URL}/api/applications", headers=headers, json=data)
    print(f"\n=== 지원서 생성 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json() if response.status_code == 201 else None

def test_save_custom_answer(token, application_id, question_id):
    """커스텀 답변 저장"""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "question_id": question_id,
        "answer_text": "지난 3년간 코칭 경험을 통해 리더십을 키워왔으며, 본 과제를 통해 더욱 전문적인 역량을 쌓고자 합니다.",
        "answer_file_id": None
    }
    response = requests.post(f"{BASE_URL}/api/applications/{application_id}/answers", headers=headers, json=data)
    print(f"\n=== 커스텀 답변 저장 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json() if response.status_code == 201 else None

def test_submit_application(token, application_id, question_id):
    """지원서 제출"""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "motivation": "리더코치로서 성장하고 팀을 이끌고 싶습니다",
        "applied_role": "leader",
        "custom_answers": [
            {
                "question_id": question_id,
                "answer_text": "지난 3년간 코칭 경험을 통해 리더십을 키워왔으며, 본 과제를 통해 더욱 전문적인 역량을 쌓고자 합니다."
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/api/applications/{application_id}/submit", headers=headers, json=data)
    print(f"\n=== 지원서 제출 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()

def test_create_evaluation(token, project_id, coach_user_id):
    """코치 평가 생성"""
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "project_id": project_id,
        "coach_user_id": coach_user_id,
        "participation_score": 4,
        "feedback_text": "매우 적극적으로 참여하여 팀에 큰 도움이 되었습니다.",
        "special_notes": None
    }
    response = requests.post(f"{BASE_URL}/api/projects/{project_id}/evaluations", headers=headers, json=data)
    print(f"\n=== 코치 평가 생성 ===")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json() if response.status_code == 201 else None

def main():
    print("=" * 80)
    print("CoachDB API 테스트 시작")
    print("=" * 80)

    # 1. 관리자 로그인
    print("\n[1] 관리자 로그인...")
    admin_token = login("viproject@naver.com", "password123")
    if not admin_token:
        print("❌ 로그인 실패")
        return
    print(f"✅ 로그인 성공: {admin_token[:20]}...")

    # 2. 프로젝트 목록 조회
    print("\n[2] 프로젝트 목록 조회...")
    projects = test_project_list(admin_token)

    # 3. 프로젝트 생성
    print("\n[3] 새 프로젝트 생성...")
    project = test_create_project(admin_token)
    if not project:
        print("❌ 프로젝트 생성 실패")
        return
    project_id = project.get("project_id")
    print(f"✅ 프로젝트 생성 성공: ID={project_id}")

    # 4. 커스텀 질문 생성
    print("\n[4] 커스텀 질문 생성...")
    question = test_create_custom_question(admin_token, project_id)
    if not question:
        print("❌ 질문 생성 실패")
        return
    question_id = question.get("question_id")
    print(f"✅ 질문 생성 성공: ID={question_id}")

    # 5. 프로젝트 질문 목록 조회
    print("\n[5] 프로젝트 질문 목록 조회...")
    questions = test_get_project_questions(admin_token, project_id)

    # 6. 프로젝트 상태를 recruiting으로 변경
    print("\n[6] 프로젝트 상태 변경...")
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.put(
        f"{BASE_URL}/api/projects/{project_id}",
        headers=headers,
        json={"status": "recruiting"}
    )
    print(f"Status: {response.status_code}")

    # 7. 코치 사용자로 로그인
    print("\n[7] 코치 사용자 로그인...")
    coach_token = login("newuser@test.com", "password123")
    if not coach_token:
        print("❌ 코치 로그인 실패")
        return
    print(f"✅ 코치 로그인 성공")

    # 8. 지원서 생성
    print("\n[8] 지원서 생성...")
    application = test_create_application(coach_token, project_id)
    if not application:
        print("❌ 지원서 생성 실패")
        return
    application_id = application.get("application_id")
    print(f"✅ 지원서 생성 성공: ID={application_id}")

    # 9. 커스텀 답변 저장
    print("\n[9] 커스텀 답변 저장...")
    answer = test_save_custom_answer(coach_token, application_id, question_id)

    # 10. 지원서 제출
    print("\n[10] 지원서 제출...")
    submitted = test_submit_application(coach_token, application_id, question_id)
    print(f"✅ 지원서 제출 성공")

    # 11. 코치 평가 생성
    print("\n[11] 코치 평가 생성...")
    evaluation = test_create_evaluation(admin_token, project_id, 1)
    if evaluation:
        print(f"✅ 평가 생성 성공: ID={evaluation.get('evaluation_id')}")

    print("\n" + "=" * 80)
    print("✅ 모든 테스트 완료!")
    print("=" * 80)

if __name__ == "__main__":
    main()
