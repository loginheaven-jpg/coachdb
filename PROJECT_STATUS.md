# Coach Competency Database - 프로젝트 현황

**마지막 업데이트:** 2025-11-03
**현재 상태:** Phase 1 완료, Phase 2 준비 완료

---

## 📊 전체 진행 현황

| Phase | 항목 | 상태 | 완료율 |
|-------|------|------|--------|
| **Phase 1** | 프로젝트 기초 구조 | ✅ 완료 | 100% |
| **Phase 1** | Docker 환경 설정 | ✅ 완료 | 100% |
| **Phase 1** | 데이터베이스 스키마 | ✅ 완료 | 100% |
| **Phase 1** | Backend 구조 | ✅ 완료 | 100% |
| **Phase 1** | Frontend 구조 | ✅ 완료 | 100% |
| **Phase 2** | 인증 시스템 | 🔴 미착수 | 0% |
| **Phase 2** | 관리자 기능 | 🔴 미착수 | 0% |
| **Phase 2** | 코치 기능 | 🔴 미착수 | 0% |
| **Phase 2** | 심사위원 기능 | 🔴 미착수 | 0% |
| **Phase 2** | 선발 시스템 | 🔴 미착수 | 0% |

**전체 프로젝트 완료율:** 25%

---

## ✅ 완료된 작업 (Phase 1)

### 1. 인프라 및 환경 설정

#### Docker 구성 ✅
- [x] docker-compose.yml 작성 (5개 서비스)
- [x] Backend Dockerfile
- [x] Frontend Dockerfile
- [x] .dockerignore 설정
- [x] 환경 변수 설정 (.env)

#### 서비스 컨테이너 ✅
- [x] PostgreSQL 15 (alpine)
- [x] Redis 7 (alpine)
- [x] MinIO (S3-compatible storage)
- [x] Backend (FastAPI + Uvicorn)
- [x] Frontend (React + Vite)

### 2. Backend (FastAPI)

#### 핵심 설정 ✅
- [x] [app/core/config.py](backend/app/core/config.py) - 환경 설정
- [x] [app/core/database.py](backend/app/core/database.py) - SQLAlchemy async 설정
- [x] [app/core/security.py](backend/app/core/security.py) - JWT 인증 준비
- [x] [app/main.py](backend/app/main.py) - FastAPI 앱 진입점

#### 데이터베이스 모델 (14개 테이블) ✅

| # | 모델 | 파일 | 주요 기능 |
|---|------|------|----------|
| 1 | User | [user.py](backend/app/models/user.py) | 사용자 관리 (coach/staff/admin) |
| 2 | Project | [project.py](backend/app/models/project.py) | 모집 프로젝트 |
| 3 | ProjectStaff | [project.py](backend/app/models/project.py) | 심사위원 배정 (M:N) |
| 4 | CompetencyItem | [competency.py](backend/app/models/competency.py) | 역량 항목 마스터 |
| 5 | ProjectItem | [competency.py](backend/app/models/competency.py) | 프로젝트별 항목 설정 |
| 6 | ScoringCriteria | [competency.py](backend/app/models/competency.py) | 채점 기준 |
| 7 | CoachCompetency | [competency.py](backend/app/models/competency.py) | **역량 전자지갑** ⭐ |
| 8 | Application | [application.py](backend/app/models/application.py) | 지원서 |
| 9 | ApplicationData | [application.py](backend/app/models/application.py) | 지원서 스냅샷 |
| 10 | File | [file.py](backend/app/models/file.py) | 파일 저장 |
| 11 | ReviewLock | [review_lock.py](backend/app/models/review_lock.py) | **동시 리뷰 방지** ⭐ |
| 12 | CompetencyReminder | [reminder.py](backend/app/models/reminder.py) | 6개월 리마인더 |
| 13 | DataRetentionPolicy | [policy.py](backend/app/models/policy.py) | 데이터 보관 정책 |

#### 핵심 기능 구현 완료 ✅
- [x] **역량 재사용 (Competency Reuse)**: `competency_id` 링크
- [x] **동시 리뷰 방지 (Concurrent Review Protection)**: 잠금 메커니즘
- [x] **고유 제약조건**: `UNIQUE(project_id, user_id)` on applications
- [x] **보완 요청**: `rejection_reason` 컬럼
- [x] **점수 비공개**: `score_visibility` enum

#### 의존성 패키지 ✅
- [x] FastAPI 0.104.1
- [x] Uvicorn 0.24.0 (with websockets, httptools)
- [x] SQLAlchemy 2.0.23 (async)
- [x] Alembic 1.12.1 (migrations)
- [x] asyncpg 0.29.0
- [x] Pydantic 2.5.0
- [x] JWT, OAuth 라이브러리
- [x] boto3, minio (파일 저장)
- [x] redis, aioredis (캐싱)

### 3. Frontend (React TypeScript)

#### 핵심 설정 ✅
- [x] [src/main.tsx](frontend/src/main.tsx) - React 진입점
- [x] [src/App.tsx](frontend/src/App.tsx) - 라우팅 설정
- [x] [src/types/index.ts](frontend/src/types/index.ts) - TypeScript 타입
- [x] [src/services/api.ts](frontend/src/services/api.ts) - Axios 클라이언트
- [x] [src/stores/authStore.ts](frontend/src/stores/authStore.ts) - 인증 상태 관리

#### 폴더 구조 ✅
- [x] `/components/coach/` - 코치용 컴포넌트
- [x] `/components/staff/` - 심사위원용 컴포넌트
- [x] `/components/admin/` - 관리자용 컴포넌트
- [x] `/components/shared/` - 공통 컴포넌트
- [x] `/pages/` - 페이지 컴포넌트
- [x] `/hooks/` - 커스텀 훅
- [x] `/services/` - API 서비스
- [x] `/stores/` - Zustand 상태 관리

#### 의존성 패키지 ✅
- [x] React 18
- [x] TypeScript 5.x
- [x] Ant Design 5 (UI 라이브러리)
- [x] Tailwind CSS (스타일링)
- [x] Zustand (상태 관리)
- [x] React Query (서버 상태)
- [x] React Hook Form + Zod (폼 관리)
- [x] Axios (HTTP 클라이언트)
- [x] React Router (라우팅)

### 4. 데이터베이스

#### 마이그레이션 ✅
- [x] Alembic 초기 설정
- [x] 초기 마이그레이션 생성
- [x] 14개 테이블 생성 완료
- [x] Foreign Key 관계 설정
- [x] Unique Constraints 설정
- [x] Index 설정

#### 실제 생성된 테이블 (확인 완료) ✅
```sql
-- PostgreSQL 15에 생성된 테이블
1. users
2. projects
3. project_staff
4. competency_items
5. project_items
6. scoring_criteria
7. coach_competencies
8. applications
9. application_data
10. files
11. review_locks
12. competency_reminders
13. data_retention_policy
14. alembic_version
```

### 5. 문서화

#### 작성 완료 ✅
- [x] [README.md](README.md) - 프로젝트 개요 (381줄)
- [x] [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - 설정 완료 보고서 (388줄)
- [x] [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) - 완전 설치 가이드 (800+ 줄)
- [x] [QUICK_START_CHECKLIST.md](QUICK_START_CHECKLIST.md) - 빠른 시작 체크리스트
- [x] [PROJECT_STATUS.md](PROJECT_STATUS.md) - 현재 문서
- [x] [MANUAL_SETUP.md](MANUAL_SETUP.md) - 수동 설정 가이드

---

## 🔴 미완료 작업 (Phase 2)

### 1. 인증 시스템 (Week 3) - 0%

#### Backend API
- [ ] `POST /api/auth/register` - 회원가입
- [ ] `POST /api/auth/login` - 로그인
- [ ] `POST /api/auth/logout` - 로그아웃
- [ ] `POST /api/auth/refresh` - 토큰 갱신
- [ ] `GET /api/auth/me` - 현재 사용자 정보
- [ ] JWT 토큰 발급/검증 로직
- [ ] 비밀번호 해싱 (bcrypt)
- [ ] 역할 기반 접근 제어 (RBAC)

#### Frontend
- [ ] 로그인 페이지
- [ ] 회원가입 페이지
- [ ] 보호된 라우트 설정
- [ ] 인증 상태 관리
- [ ] 자동 토큰 갱신

### 2. 관리자 기능 (Week 4) - 0%

#### Backend API
- [ ] `GET /api/projects` - 프로젝트 목록
- [ ] `POST /api/projects` - 프로젝트 생성
- [ ] `GET /api/projects/{id}` - 프로젝트 상세
- [ ] `PUT /api/projects/{id}` - 프로젝트 수정
- [ ] `DELETE /api/projects/{id}` - 프로젝트 삭제
- [ ] `POST /api/projects/{id}/staff` - 심사위원 배정
- [ ] `POST /api/projects/{id}/items` - 평가 항목 설정
- [ ] `POST /api/projects/{id}/criteria` - 채점 기준 설정

#### Frontend (Admin)
- [ ] A-01: 관리자 대시보드
- [ ] A-02: 프로젝트 생성 마법사 (4단계)
  - Step 1: 기본 정보
  - Step 2: 평가 항목 선택
  - Step 3: 채점 기준 설정
  - Step 4: 심사위원 배정
- [ ] A-03: 프로젝트 관리 테이블
- [ ] A-04: 선발 결과 확정 화면
- [ ] A-05: 통계 대시보드

### 3. 코치 기능 (Week 5-7) - 0%

#### Backend API - 역량 관리
- [ ] `GET /api/competencies/my` - 내 역량 목록
- [ ] `POST /api/competencies` - 역량 추가
- [ ] `PUT /api/competencies/{id}` - 역량 수정
- [ ] `DELETE /api/competencies/{id}` - 역량 삭제
- [ ] `POST /api/competencies/{id}/file` - 증빙 파일 업로드
- [ ] `GET /api/competencies/completion` - 완성도 계산

#### Backend API - 지원서
- [ ] `GET /api/applications/my` - 내 지원서 목록
- [ ] `POST /api/applications` - 지원서 생성
- [ ] `PUT /api/applications/{id}` - 지원서 수정 (자동저장)
- [ ] `POST /api/applications/{id}/submit` - 지원서 제출
- [ ] `POST /api/applications/{id}/reuse-competency` - **역량 재사용** ⭐
- [ ] `GET /api/applications/{id}/submission-status` - 제출 가능 여부

#### Frontend (Coach)
- [ ] C-01: 코치 대시보드
- [ ] C-02: 역량 관리 (전자 지갑)
- [ ] C-03: 프로젝트 목록 (지원 가능)
- [ ] C-04: 프로젝트 상세 정보
- [ ] C-05: 지원서 작성 폼 (역량 재사용 기능 포함) ⭐
- [ ] C-06: 제출된 지원서 확인
- [ ] 자동 저장 기능 (30초마다)
- [ ] 완성도 표시 (진행률 바)
- [ ] 파일 업로더/뷰어

### 4. 심사위원 기능 (Week 8-9) - 0%

#### Backend API
- [ ] `GET /api/reviews/projects/{id}/applications` - 지원서 목록
- [ ] `GET /api/reviews/applications/{id}` - 지원서 상세
- [ ] `POST /api/reviews/applications/{id}/items/{itemId}/lock` - **항목 잠금** ⭐
- [ ] `DELETE /api/reviews/applications/{id}/items/{itemId}/lock` - 잠금 해제
- [ ] `POST /api/reviews/applications/{id}/items/{itemId}/approve` - 승인
- [ ] `POST /api/reviews/applications/{id}/items/{itemId}/reject` - 반려 (보완 요청)
- [ ] 잠금 만료 백그라운드 작업 (30분)

#### Frontend (Staff)
- [ ] R-01: 심사위원 대시보드
- [ ] R-02: 지원서 큐 (할당된 프로젝트)
- [ ] R-03: 지원서 상세 (항목별)
- [ ] R-04: 리뷰 인터페이스 (잠금 표시 포함) ⭐
- [ ] R-05: 보완 요청 관리
- [ ] PDF/이미지 뷰어
- [ ] 잠금 상태 실시간 표시

### 5. 선발 시스템 (Week 10) - 0%

#### Backend API
- [ ] `GET /api/selections/projects/{id}/candidates` - 후보자 순위
- [ ] `POST /api/selections/projects/{id}/select` - 선발 확정
- [ ] `GET /api/selections/projects/{id}/export` - 결과 내보내기
- [ ] 자동 점수 계산 엔진
- [ ] 랭킹 알고리즘

#### Frontend (Admin)
- [ ] 후보자 랭킹 테이블
- [ ] 점수 분포 차트
- [ ] 선발 결과 확정 UI
- [ ] 엑셀 내보내기

### 6. 파일 관리 (Week 11) - 0%

#### Backend API
- [ ] `POST /api/files/upload` - 파일 업로드
- [ ] `GET /api/files/{id}` - 파일 다운로드
- [ ] `DELETE /api/files/{id}` - 파일 삭제
- [ ] MinIO/S3 연동
- [ ] Pre-signed URL 생성
- [ ] 파일 보관 정책 (5년)
- [ ] 스케줄된 삭제 작업

#### Frontend
- [ ] FileUploader 공통 컴포넌트
- [ ] FileViewer 공통 컴포넌트
- [ ] 이미지 미리보기
- [ ] PDF 뷰어
- [ ] 업로드 진행률 표시

### 7. 테스트 (Week 12) - 0%

#### Backend
- [ ] 단위 테스트 (pytest)
- [ ] 통합 테스트
- [ ] API 엔드포인트 테스트
- [ ] 데이터베이스 트랜잭션 테스트

#### Frontend
- [ ] 컴포넌트 테스트 (React Testing Library)
- [ ] E2E 테스트 (Playwright/Cypress)
- [ ] 통합 테스트

---

## 🎯 다음 우선순위 작업

### 즉시 시작 가능 (Priority 1)

1. **인증 시스템 구현** (Week 3)
   - [ ] Backend: auth endpoints 구현
   - [ ] Frontend: 로그인/회원가입 페이지
   - [ ] JWT 토큰 관리
   - **예상 소요:** 3-5일

2. **기본 역할별 대시보드** (Week 4 초반)
   - [ ] Admin 대시보드 (A-01)
   - [ ] Coach 대시보드 (C-01)
   - [ ] Staff 대시보드 (R-01)
   - **예상 소요:** 2-3일

### 중기 작업 (Priority 2)

3. **프로젝트 관리** (Week 4)
   - [ ] 프로젝트 CRUD
   - [ ] 평가 항목 설정
   - **예상 소요:** 4-5일

4. **역량 관리** (Week 5)
   - [ ] 역량 CRUD
   - [ ] 파일 업로드
   - **예상 소요:** 3-4일

### 장기 작업 (Priority 3)

5. **지원서 시스템** (Week 6-7)
6. **리뷰 시스템** (Week 8-9)
7. **선발 시스템** (Week 10)

---

## 📈 기술 부채 및 개선 사항

### 현재 알려진 이슈
- [ ] Backend models에 back_populates 관계 양방향 설정 필요
- [ ] Frontend에서 에러 처리 개선 필요
- [ ] API 응답 형식 표준화 필요

### 성능 최적화
- [ ] 데이터베이스 인덱스 최적화
- [ ] Redis 캐싱 전략 수립
- [ ] API 응답 시간 모니터링
- [ ] 프론트엔드 번들 크기 최적화

### 보안
- [ ] CORS 정책 세밀 조정
- [ ] Rate limiting 구현
- [ ] SQL Injection 방지 검증
- [ ] XSS 방지 검증
- [ ] 파일 업로드 보안 강화

---

## 🚀 릴리스 계획

### MVP (Minimum Viable Product) - 12주 후

**포함 기능:**
- ✅ 사용자 인증
- ✅ 역할 기반 접근 제어
- ✅ 프로젝트 관리
- ✅ 역량 전자 지갑
- ✅ 지원서 작성 및 제출
- ✅ 역량 재사용
- ✅ 리뷰 시스템 (동시 리뷰 방지)
- ✅ 선발 시스템

### Phase 2 기능 - 20주 후

**추가 기능:**
- Email/SMS 알림
- 6개월 역량 업데이트 리마인더
- 엑셀 가져오기/내보내기
- 고급 통계 및 리포트
- 신원 확인 통합

---

## 📞 연락처 및 지원

- **프로젝트 관리자:** [이름]
- **기술 리드:** [이름]
- **문제 보고:** GitHub Issues

---

**마지막 업데이트:** 2025-11-03
**다음 검토 예정일:** 2025-11-10
