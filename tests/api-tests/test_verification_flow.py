"""
증빙 검증 전체 플로우 테스트 스크립트

테스트 시나리오:
1. 과제 생성 (설문항목 포함)
2. 응모자가 과제 조회
3. 증빙서류 첨부하여 응모
4. Verifier 검토대상 리스트 조회
5. Verifier 증빙 승인/반려
6. 응모자 화면에서 승인 여부 확인
"""
import requests
import json
import sys

# 환경 설정
BASE_URL = "http://localhost:8000"  # 로컬 테스트
# BASE_URL = "https://coachdbbackend-production.up.railway.app"  # 프로덕션

def log(msg, level="INFO"):
    icons = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "STEP": "📌"}
    print(f"{icons.get(level, '')} {msg}")

def login(email, password):
    """로그인하고 토큰 및 사용자 정보 반환"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token"), data.get("user")
    else:
        log(f"로그인 실패: {response.text}", "ERROR")
        return None, None

def api_get(endpoint, token):
    """GET 요청"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/api{endpoint}", headers=headers)
    return response

def api_post(endpoint, token, data):
    """POST 요청"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/api{endpoint}", headers=headers, json=data)
    return response

def api_put(endpoint, token, data):
    """PUT 요청"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.put(f"{BASE_URL}/api{endpoint}", headers=headers, json=data)
    return response

# =============================================================================
# 테스트 함수들
# =============================================================================

def test_1_check_projects(admin_token):
    """1. 과제 목록 확인"""
    log("=== 테스트 1: 과제 목록 조회 ===", "STEP")

    response = api_get("/projects", admin_token)
    if response.status_code != 200:
        log(f"과제 목록 조회 실패: {response.text}", "ERROR")
        return None

    projects = response.json()
    log(f"총 {len(projects)}개의 과제 발견", "SUCCESS")

    # recruiting 상태인 과제 찾기
    recruiting_projects = [p for p in projects if p.get("status") == "recruiting"]
    if recruiting_projects:
        project = recruiting_projects[0]
        log(f"모집 중인 과제: {project['project_name']} (ID: {project['project_id']})")
        return project
    else:
        log("모집 중인 과제가 없습니다. 새로 생성이 필요합니다.", "INFO")
        return None

def test_2_get_project_items(admin_token, project_id):
    """2. 과제 설문항목 조회"""
    log("=== 테스트 2: 과제 설문항목 조회 ===", "STEP")

    response = api_get(f"/projects/{project_id}/items", admin_token)
    if response.status_code != 200:
        log(f"설문항목 조회 실패: {response.text}", "ERROR")
        return []

    items = response.json()
    log(f"총 {len(items)}개의 설문항목 발견", "SUCCESS")

    for item in items[:5]:
        proof_level = item.get("proof_required_level", "없음")
        log(f"  - {item.get('competency_item', {}).get('item_name', '?')}: 증빙={proof_level}")

    return items

def test_3_coach_view_project(coach_token, project_id):
    """3. 코치가 과제 조회"""
    log("=== 테스트 3: 코치가 과제 조회 ===", "STEP")

    response = api_get(f"/projects/{project_id}", coach_token)
    if response.status_code != 200:
        log(f"과제 조회 실패: {response.text}", "ERROR")
        return None

    project = response.json()
    log(f"과제명: {project['project_name']}", "SUCCESS")
    log(f"모집기간: {project.get('recruitment_start_date')} ~ {project.get('recruitment_end_date')}")
    return project

def test_4_coach_apply(coach_token, project_id, project_items):
    """4. 코치가 증빙 첨부하여 응모"""
    log("=== 테스트 4: 코치가 응모 ===", "STEP")

    # 지원서 생성
    response = api_post("/applications", coach_token, {
        "project_id": project_id,
        "motivation": "테스트 지원동기입니다.",
        "applied_role": "participant"
    })

    if response.status_code not in [200, 201]:
        # 이미 지원한 경우 기존 지원서 확인
        if "이미 지원" in response.text or "already" in response.text.lower():
            log("이미 지원한 과제입니다. 기존 지원서를 확인합니다.", "INFO")
            my_apps = api_get("/applications/my", coach_token)
            if my_apps.status_code == 200:
                apps = my_apps.json()
                for app in apps:
                    if app.get("project_id") == project_id:
                        log(f"기존 지원서 ID: {app['application_id']}", "SUCCESS")
                        return app
        log(f"지원서 생성 실패: {response.text}", "ERROR")
        return None

    application = response.json()
    log(f"지원서 생성 성공: ID={application['application_id']}", "SUCCESS")
    return application

def test_5_verifier_list(verifier_token):
    """5. Verifier가 검토대상 리스트 조회"""
    log("=== 테스트 5: Verifier 검토대상 리스트 조회 ===", "STEP")

    response = api_get("/verifications/pending", verifier_token)
    if response.status_code != 200:
        log(f"검토대상 조회 실패: {response.text}", "ERROR")
        return []

    pending = response.json()
    log(f"총 {len(pending)}개의 검토 대기 증빙", "SUCCESS")

    for item in pending[:5]:
        log(f"  - {item.get('user_name')}: {item.get('item_name')} (상태: {item.get('verification_status', 'pending')})")

    return pending

def test_6_verifier_confirm(verifier_token, competency_id):
    """6. Verifier가 증빙 승인"""
    log(f"=== 테스트 6: 증빙 컨펌 (competency_id={competency_id}) ===", "STEP")

    response = api_post("/verifications/confirm", verifier_token, {
        "competency_id": competency_id
    })

    if response.status_code not in [200, 201]:
        log(f"컨펌 실패: {response.text}", "ERROR")
        return False

    result = response.json()
    log(f"컨펌 성공: record_id={result.get('record_id')}", "SUCCESS")
    return True

def test_7_verifier_reject(verifier_token, competency_id, reason):
    """7. Verifier가 증빙 반려 (보완요청)"""
    log(f"=== 테스트 7: 증빙 보완요청 (competency_id={competency_id}) ===", "STEP")

    response = api_post(f"/verifications/{competency_id}/request-supplement", verifier_token, {
        "reason": reason
    })

    if response.status_code not in [200, 201]:
        log(f"보완요청 실패: {response.text}", "ERROR")
        return False

    result = response.json()
    log(f"보완요청 성공: {result.get('message')}", "SUCCESS")
    return True

def test_8_coach_check_competencies(coach_token):
    """8. 코치가 자신의 역량 검증 상태 확인"""
    log("=== 테스트 8: 코치 역량 검증 상태 확인 ===", "STEP")

    response = api_get("/competencies/my", coach_token)
    if response.status_code != 200:
        log(f"역량 조회 실패: {response.text}", "ERROR")
        return []

    competencies = response.json()
    log(f"총 {len(competencies)}개의 역량", "SUCCESS")

    for comp in competencies:
        status = comp.get("verification_status", "pending")
        is_verified = comp.get("is_globally_verified", False)
        rejection_reason = comp.get("rejection_reason", "")

        item_name = comp.get("competency_item", {}).get("item_name", "?")

        status_str = "✅ 검증완료" if is_verified else f"⏳ {status}"
        if rejection_reason:
            status_str += f" (사유: {rejection_reason[:30]}...)"

        log(f"  - {item_name}: {status_str}")

    return competencies

def test_9_coach_check_notifications(coach_token):
    """9. 코치 알림 확인"""
    log("=== 테스트 9: 코치 알림 확인 ===", "STEP")

    response = api_get("/notifications/my", coach_token)
    if response.status_code != 200:
        log(f"알림 조회 실패: {response.text}", "ERROR")
        return []

    notifications = response.json()
    log(f"총 {len(notifications)}개의 알림", "SUCCESS")

    for notif in notifications[:5]:
        read_status = "읽음" if notif.get("is_read") else "안읽음"
        log(f"  - [{read_status}] {notif.get('title')}: {notif.get('message', '')[:50]}")

    return notifications

# =============================================================================
# 메인 실행
# =============================================================================

def main():
    print("=" * 80)
    print("증빙 검증 전체 플로우 테스트")
    print("=" * 80)

    # 1. 관리자/Verifier 로그인
    log("\n[STEP 1] 관리자/Verifier 로그인")
    admin_token, admin_user = login("viproject@naver.com", "password123")
    if not admin_token:
        log("다른 계정으로 시도해보세요.", "ERROR")
        return
    log(f"로그인 성공: {admin_user.get('name')} (roles: {admin_user.get('roles')})", "SUCCESS")

    # 2. 코치 로그인
    log("\n[STEP 2] 코치 로그인")
    coach_token, coach_user = login("newuser@test.com", "password123")
    if not coach_token:
        log("코치 계정 로그인 실패. 다른 계정으로 시도해보세요.", "ERROR")
        return
    log(f"코치 로그인 성공: {coach_user.get('name')}", "SUCCESS")

    # 3. 과제 확인
    log("\n[STEP 3] 과제 확인")
    project = test_1_check_projects(admin_token)
    if not project:
        log("테스트할 과제가 없습니다.", "ERROR")
        return
    project_id = project["project_id"]

    # 4. 과제 설문항목 확인
    log("\n[STEP 4] 설문항목 확인")
    project_items = test_2_get_project_items(admin_token, project_id)

    # 5. 코치가 과제 조회
    log("\n[STEP 5] 코치가 과제 조회")
    test_3_coach_view_project(coach_token, project_id)

    # 6. 코치가 응모
    log("\n[STEP 6] 코치가 응모")
    application = test_4_coach_apply(coach_token, project_id, project_items)

    # 7. Verifier가 검토대상 조회
    log("\n[STEP 7] Verifier 검토대상 조회")
    pending = test_5_verifier_list(admin_token)

    if pending:
        # 8. 첫 번째 증빙 승인 테스트
        first_pending = pending[0]
        log(f"\n[STEP 8] 증빙 승인 테스트 (ID: {first_pending['competency_id']})")
        test_6_verifier_confirm(admin_token, first_pending["competency_id"])

        # 9. 두 번째 증빙 반려 테스트 (있는 경우)
        if len(pending) > 1:
            second_pending = pending[1]
            log(f"\n[STEP 9] 증빙 반려 테스트 (ID: {second_pending['competency_id']})")
            test_7_verifier_reject(admin_token, second_pending["competency_id"], "테스트 반려 사유: 서류가 불명확합니다.")

    # 10. 코치가 검증 상태 확인
    log("\n[STEP 10] 코치 역량 검증 상태 확인")
    test_8_coach_check_competencies(coach_token)

    # 11. 코치 알림 확인
    log("\n[STEP 11] 코치 알림 확인")
    test_9_coach_check_notifications(coach_token)

    print("\n" + "=" * 80)
    log("테스트 완료!", "SUCCESS")
    print("=" * 80)

if __name__ == "__main__":
    main()
