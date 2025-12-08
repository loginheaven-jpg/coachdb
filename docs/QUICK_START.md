# Quick Start Guide - 템플릿 기반 설문 시스템

**5분 안에 시작하기**

---

## 1. 환경 구성 (2분)

### 사전 요구사항

- Docker Desktop 설치
- Git 설치
- 최소 8GB RAM

### 시작하기

```bash
# 1. 레포지토리 클론
cd c:\dev
git pull  # 또는 git clone {repository_url}

# 2. Docker 컨테이너 시작
cd coachdb
docker-compose up -d

# 3. 컨테이너 상태 확인
docker-compose ps
```

**Expected Output**:
```
NAME                IMAGE         STATUS
coachdb-backend-1   ...          Up
coachdb-frontend-1  ...          Up
coachdb-postgres-1  ...          Up
```

---

## 2. 데이터베이스 초기화 (1분)

```bash
# 1. 마이그레이션 실행
docker-compose exec backend alembic upgrade head

# 2. 템플릿 항목 Seed 데이터 생성
docker-compose exec backend python scripts/seed_template_competency_items.py

# 3. 테스트 데이터 생성
docker-compose exec backend python scripts/create_test_data.py
```

**Expected Output**:
```
✅ Test data creation completed successfully!

Test projects created: 4
  - 템플릿 테스트 과제 1 (13 items, all optional)
  - 템플릿 테스트 과제 2 (13 items, all optional)

Available coaches:
  - browsertest@test.com
  - frontend-test@test.com
  - testcoach@test.com
```

---

## 3. 접속 및 로그인 (1분)

### Frontend 접속

```
http://localhost:3000
```

### 테스트 계정

| 역할 | 이메일 | 비밀번호 | 용도 |
|------|--------|----------|------|
| Admin | browsertest@test.com | password | 설문 구성, 항목 관리 |
| Coach | testcoach@test.com | password | 과제 응모 |

### API Docs 접속

```
http://localhost:8000/docs
```

FastAPI Swagger UI에서 API 테스트 가능

---

## 4. 핵심 기능 테스트 (1분)

### A. 설문 구성 (Admin)

1. Admin 계정 로그인 (browsertest@test.com)
2. 과제 목록 → "템플릿 테스트 과제 1" 클릭
3. **"설문 구성"** 버튼 클릭
4. 항목 선택/배점 설정
5. 증빙 레벨 변경 테스트 (optional → required)
6. **미리보기** 클릭
7. 저장

**확인 사항**:
- ✅ 카테고리별 그룹핑 (기본 평가, 학력, 자격증/경험, 경력, 코칭 분야)
- ✅ 총 배점 100점 검증
- ✅ 미리보기에서 선택한 항목만 표시

### B. 과제 응모 (Coach)

1. Coach 계정 로그인 (testcoach@test.com)
2. 과제 목록 → "템플릿 테스트 과제 1" 클릭
3. **"응모하기"** 버튼 클릭
4. 각 템플릿 타입별 필드 확인:
   - **DEGREE**: SELECT (학위) + TEXT (전공) + FILE (증빙)
   - **TEXT_FILE**: TEXT (명칭) + FILE (증빙), **"추가"** 버튼으로 복수 입력
   - **NUMBER**: InputNumber
   - **TEXT**: Input
   - **COACHING_HISTORY**: TEXT (경험) + FILE (증빙)
5. 임시저장 또는 제출

**확인 사항**:
- ✅ 복수 입력 항목에서 추가/삭제 버튼 동작
- ✅ max_entries 제한 적용
- ✅ 필수 항목 검증

---

## 5. 데이터 확인

### PostgreSQL 접속

```bash
docker-compose exec postgres psql -U coachdb -d coachdb
```

### 유용한 쿼리

```sql
-- 1. 템플릿 항목 확인
SELECT item_name, template, is_repeatable,
       (SELECT COUNT(*) FROM competency_item_fields f
        WHERE f.item_id = ci.item_id) as field_count
FROM competency_items ci
WHERE template IS NOT NULL
ORDER BY item_id;

-- 2. 과제별 설문 항목 확인
SELECT p.project_name,
       ci.item_name,
       pi.is_required,
       pi.proof_required_level,
       pi.max_score
FROM projects p
JOIN project_items pi ON p.project_id = pi.project_id
JOIN competency_items ci ON pi.item_id = ci.item_id
WHERE p.project_name LIKE '%템플릿%'
ORDER BY p.project_id, pi.display_order;

-- 3. 응모 데이터 확인
SELECT a.application_id,
       u.name as coach_name,
       p.project_name,
       COUNT(ad.*) as answers_count,
       a.status
FROM applications a
JOIN users u ON a.user_id = u.user_id
JOIN projects p ON a.project_id = p.project_id
LEFT JOIN application_data ad ON a.application_id = ad.application_id
GROUP BY a.application_id, u.name, p.project_name, a.status;

-- 4. 응답 JSON 확인
SELECT ci.item_name,
       ci.template,
       ad.submitted_value
FROM application_data ad
JOIN competency_items ci ON ad.item_id = ci.item_id
WHERE ad.application_id = 1;
```

---

## 6. 일반적인 문제 해결

### 문제 1: 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# 컨테이너 재시작
docker-compose down
docker-compose up -d
```

### 문제 2: 마이그레이션 오류

```bash
# 현재 마이그레이션 버전 확인
docker-compose exec backend alembic current

# 마이그레이션 히스토리 확인
docker-compose exec backend alembic history

# 특정 버전으로 롤백
docker-compose exec backend alembic downgrade -1

# 다시 업그레이드
docker-compose exec backend alembic upgrade head
```

### 문제 3: 템플릿 항목이 보이지 않음

```bash
# Seed 스크립트 재실행
docker-compose exec backend python scripts/seed_template_competency_items.py

# DB에서 확인
docker-compose exec postgres psql -U coachdb -d coachdb -c "SELECT COUNT(*) FROM competency_items WHERE template IS NOT NULL;"
# Expected: 13
```

### 문제 4: Frontend가 API를 호출하지 못함

```bash
# Backend 상태 확인
curl http://localhost:8000/api/health

# 네트워크 확인
docker network ls
docker network inspect coachdb_default

# CORS 설정 확인 (backend/.env)
CORS_ORIGINS=["http://localhost:3000"]
```

### 문제 5: 테스트 데이터 재생성

```bash
# 기존 테스트 과제 삭제
docker-compose exec postgres psql -U coachdb -d coachdb -c "DELETE FROM projects WHERE project_name LIKE '%템플릿%';"

# 테스트 데이터 재생성
docker-compose exec backend python scripts/create_test_data.py
```

---

## 7. 개발 모드

### Backend Hot Reload

Backend는 기본적으로 hot reload 활성화:

```bash
# backend/main.py
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
```

코드 수정 시 자동 재시작됨.

### Frontend Hot Reload

Frontend도 Vite로 hot reload 활성화:

```bash
docker-compose logs -f frontend
# Vite dev server running at http://localhost:3000
```

파일 수정 시 브라우저 자동 새로고침.

### 로그 실시간 확인

```bash
# 모든 컨테이너
docker-compose logs -f

# 특정 컨테이너
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

---

## 8. 다음 단계

### 학습 리소스

1. **설계 문서**: `docs/SURVEY_SYSTEM_DESIGN.md`
   - 시스템 아키텍처
   - 데이터베이스 ERD
   - 템플릿 시스템 설명
   - 코드 구조

2. **API 레퍼런스**: `docs/API_REFERENCE_SURVEY.md`
   - 엔드포인트 상세
   - 요청/응답 예제
   - 에러 코드

3. **소스 코드 탐색**:
   - Backend: `backend/app/`
   - Frontend: `frontend/src/`
   - Migration: `backend/alembic/versions/`
   - Scripts: `backend/scripts/`

### 개발 작업

#### 새 템플릿 타입 추가

1. Backend Enum 추가: `app/models/competency.py`
2. Migration 생성: `alembic revision -m "add new template"`
3. Frontend Enum 추가: `services/projectService.ts`
4. DynamicFieldRenderer 확장: `components/DynamicFieldRenderer.tsx`
5. Seed 데이터 추가: `scripts/seed_template_competency_items.py`

#### 새 역량 항목 추가

1. Seed 스크립트 수정: `scripts/seed_template_competency_items.py`
2. 스크립트 실행:
```bash
docker-compose exec backend python scripts/seed_template_competency_items.py
```

#### 카테고리 그룹핑 수정

1. SurveyBuilder: `frontend/src/components/SurveyBuilder.tsx`
2. ApplicationForm: `frontend/src/components/ApplicationForm.tsx`
3. `groupItemsByCategory()` 함수 수정

---

## 9. 자주 사용하는 명령어

```bash
# 컨테이너 관리
docker-compose up -d              # 시작
docker-compose down               # 종료
docker-compose restart            # 재시작
docker-compose ps                 # 상태 확인

# 로그
docker-compose logs -f backend    # Backend 로그
docker-compose logs -f frontend   # Frontend 로그

# 데이터베이스
docker-compose exec postgres psql -U coachdb -d coachdb  # PostgreSQL 접속
docker-compose exec backend alembic upgrade head          # 마이그레이션

# 스크립트 실행
docker-compose exec backend python scripts/seed_template_competency_items.py
docker-compose exec backend python scripts/create_test_data.py

# 컨테이너 내부 접속
docker-compose exec backend bash
docker-compose exec frontend sh
```

---

## 10. 체크리스트

### 환경 구성 완료

- [ ] Docker Desktop 실행 중
- [ ] `docker-compose up -d` 성공
- [ ] 모든 컨테이너 Up 상태
- [ ] `http://localhost:3000` 접속 가능
- [ ] `http://localhost:8000/docs` 접속 가능

### 데이터 초기화 완료

- [ ] Alembic 마이그레이션 완료
- [ ] Seed 스크립트 실행 완료 (13개 템플릿 항목)
- [ ] 테스트 데이터 생성 완료 (4개 과제, 각 13개 항목)

### 기능 테스트 완료

- [ ] Admin 로그인 성공
- [ ] "설문 구성" 버튼 동작
- [ ] 항목 선택/배점 설정 가능
- [ ] 100점 검증 동작
- [ ] 미리보기 기능 동작
- [ ] Coach 로그인 성공
- [ ] 과제 응모 폼 렌더링
- [ ] 각 템플릿 타입 필드 정상 표시
- [ ] 복수 입력 항목 추가/삭제 동작
- [ ] 임시저장/제출 성공

### 문서 확인 완료

- [ ] SURVEY_SYSTEM_DESIGN.md 읽음
- [ ] API_REFERENCE_SURVEY.md 확인
- [ ] 주요 코드 파일 위치 파악

---

## 11. 도움말

### 공식 문서

- FastAPI: https://fastapi.tiangolo.com
- React: https://react.dev
- Ant Design: https://ant.design
- SQLAlchemy: https://docs.sqlalchemy.org

### 이슈 보고

문제 발생 시:

1. 로그 확인: `docker-compose logs -f`
2. DB 상태 확인: SQL 쿼리 실행
3. API 응답 확인: `/docs`에서 직접 테스트
4. 컨테이너 재시작: `docker-compose restart`

---

**시작 준비 완료!** 🚀

이제 설문 시스템을 탐색하고 개발을 시작할 수 있습니다.
