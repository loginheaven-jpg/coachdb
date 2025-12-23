#!/usr/bin/env python3
"""Quick test script for verification flow"""
import requests
import json

BASE_URL = "https://coachdbbackend-production.up.railway.app/api"
COACH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1OSIsInJvbGVzIjpbIkNPQUNIIl0sImV4cCI6MTc2NjQxMDExMywidHlwZSI6ImFjY2VzcyJ9.1TCjyMjtFyr5lNoYrjcUFhqo304E4QtM0JeFyVCnRmA"

def api_get(endpoint, token):
    headers = {"Authorization": f"Bearer {token}"}
    return requests.get(f"{BASE_URL}{endpoint}", headers=headers)

def api_post(endpoint, token, data):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    return requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data)

print("=" * 60)
print("증빙 검증 플로우 테스트")
print("=" * 60)

# 1. 과제 목록
print("\n[1] 과제 목록 조회...")
r = api_get("/projects", COACH_TOKEN)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    projects = r.json()
    for p in projects[:3]:
        print(f"  - ID: {p['project_id']}, Name: {p['project_name']}, Status: {p.get('display_status', p['status'])}")
    if projects:
        project_id = projects[0]['project_id']
else:
    print(f"Error: {r.text}")
    exit(1)

# 2. 설문항목 조회
print(f"\n[2] 과제 {project_id} 설문항목 조회...")
r = api_get(f"/projects/{project_id}/items", COACH_TOKEN)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    items = r.json()
    print(f"총 {len(items)}개 설문항목")
    for item in items[:5]:
        ci = item.get('competency_item', {})
        print(f"  - {ci.get('item_name', '?')}: proof={item.get('proof_required_level', 'none')}")
else:
    print(f"Error: {r.text}")

# 3. 코치 역량 조회
print("\n[3] 내 역량 조회...")
r = api_get("/competencies/my", COACH_TOKEN)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    comps = r.json()
    print(f"총 {len(comps)}개 역량")
    for c in comps[:5]:
        ci = c.get('competency_item', {})
        status = c.get('verification_status', 'pending')
        verified = "✅" if c.get('is_globally_verified') else "⏳"
        print(f"  - {ci.get('item_name', '?')}: {verified} {status}")
else:
    print(f"Error: {r.text}")

# 4. 역량 생성 (테스트)
print("\n[4] 역량 생성 테스트 (코칭관련 자격증)...")
r = api_post("/competencies/", COACH_TOKEN, {
    "item_id": 15,  # 코칭관련 자격증
    "value": "KSC 인증코치 테스트"
})
print(f"Status: {r.status_code}")
if r.status_code in [200, 201]:
    comp = r.json()
    print(f"  생성됨: competency_id={comp.get('competency_id')}")
else:
    print(f"  {r.text[:200]}")

# 5. Verifier 검토대상 조회 (권한 필요)
print("\n[5] Verifier 검토대상 조회 (COACH 토큰으로 시도)...")
r = api_get("/verifications/pending", COACH_TOKEN)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    pending = r.json()
    print(f"총 {len(pending)}개 검토대상")
    for p in pending[:3]:
        print(f"  - {p.get('user_name')}: {p.get('item_name')} (status: {p.get('verification_status', 'pending')})")
elif r.status_code == 403:
    print("  권한 없음 (VERIFIER 역할 필요)")
else:
    print(f"  Error: {r.text[:200]}")

# 6. 알림 조회
print("\n[6] 알림 조회...")
r = api_get("/notifications/my", COACH_TOKEN)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    notifs = r.json()
    print(f"총 {len(notifs)}개 알림")
    for n in notifs[:3]:
        print(f"  - [{n.get('type')}] {n.get('title')}")
else:
    print(f"Error: {r.text}")

print("\n" + "=" * 60)
print("테스트 완료")
print("=" * 60)
