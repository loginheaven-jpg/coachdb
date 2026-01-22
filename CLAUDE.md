# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**코치 역량 데이터베이스 및 프로젝트 매칭 시스템 (PCMS - Professional Coach Management System)**

코치의 역량을 중앙 DB에 저장하고, 프로젝트 지원 시 재사용할 수 있는 "전자지갑" 개념의 시스템.
상세 설계는 `coach_db_service_final_v3.md` 참조.

### 기술 스택

**Backend:**
- FastAPI 0.104.1 (Python async web framework)
- PostgreSQL (asyncpg driver)
- SQLAlchemy 2.0 (async ORM)
- Alembic (database migrations)
- Pydantic v2 (data validation)
- FastAPI Users (authentication)

**Frontend:**
- React 18.2 + TypeScript
- Vite (build tool)
- React Router v6 (routing)
- Ant Design 5 (UI components)
- Zustand (state management)
- React Query (server state)
- React Hook Form + Zod (form validation)

**Testing:**
- Playwright (E2E tests)

## 개발 명령어

### Backend (FastAPI)

```bash
# 가상환경 활성화 (Windows)
cd backend
.\venv\Scripts\activate

# 가상환경 활성화 (Unix/Mac)
cd backend
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 데이터베이스 마이그레이션
alembic upgrade head

# 개발 서버 실행 (http://localhost:8000)
uvicorn app.main:app --reload

# 또는 직접 실행
python -m app.main
```

### Frontend (React)

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 (http://localhost:5173)
npm run dev:local

# 프로덕션 빌드
npm run build

# 프로덕션 미리보기
npm run preview

# 린트
npm run lint
```

### 테스트

```bash
# 루트 디렉토리에서 Playwright 테스트 실행
npm test

# UI 모드로 테스트
npm run test:ui

# 헤드 모드로 테스트
npm run test:headed

# 특정 테스트 파일 실행
npm run test:auth        # 인증 테스트
npm run test:profile     # 프로필 테스트
npm run test:projects    # 프로젝트 테스트
npm run test:verifications  # 검증 테스트
```

## 아키텍처

### Backend 구조

```
backend/app/
├── main.py                 # FastAPI 앱 진입점, CORS, 라우터 등록
├── core/
│   ├── config.py          # Settings (Pydantic Settings)
│   ├── database.py        # AsyncSession, init_db(), Alembic 실행
│   └── security.py        # JWT, password hashing
├── models/                # SQLAlchemy ORM models (14+ tables)
│   ├── user.py           # 사용자 (roles: COACH, STAFF, ADMIN, etc.)
│   ├── competency.py     # 역량 항목 (중앙 DB - "전자지갑")
│   ├── project.py        # 프로젝트 (모집 공고)
│   ├── application.py    # 지원서 (역량 스냅샷)
│   └── ...
├── schemas/              # Pydantic schemas (request/response)
├── api/endpoints/        # API 라우터
│   ├── auth.py          # 인증: /api/auth/login, /api/auth/register
│   ├── competencies.py  # 역량 관리: /api/competencies/*
│   ├── projects.py      # 프로젝트: /api/projects/*
│   ├── applications.py  # 지원서: /api/applications/*
│   ├── admin.py         # 관리자: /api/admin/*
│   ├── verifications.py # 검증: /api/verifications/*
│   ├── scoring.py       # 평가: /api/scoring/*
│   └── files.py         # 파일: /api/files/*
├── services/            # 비즈니스 로직
└── utils/               # 유틸리티

alembic/
├── versions/           # 마이그레이션 파일들
└── env.py             # Alembic 설정
```

### Frontend 구조

```
frontend/src/
├── App.tsx                    # 라우팅 설정
├── main.tsx                   # 진입점
├── pages/                     # 페이지 컴포넌트
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx      # 통합 대시보드 (역할별 분기)
│   ├── CoachDashboard.tsx     # 코치 대시보드
│   ├── StaffDashboard.tsx     # 실무자 대시보드
│   ├── AdminDashboard.tsx     # 관리자 대시보드
│   ├── UnifiedCompetencyPage.tsx  # 역량 관리 (중앙 DB)
│   ├── ApplicationSubmitPage.tsx  # 지원서 작성
│   ├── ProjectListPage.tsx
│   ├── ProjectManagePage.tsx
│   └── ...
├── components/
│   ├── layout/            # 레이아웃 (AppLayout, Header, etc.)
│   ├── shared/            # 공통 컴포넌트 (ProtectedRoute, etc.)
│   └── ...
├── services/              # API 클라이언트
│   ├── api.ts            # Axios 인스턴스
│   ├── authService.ts
│   ├── competencyService.ts
│   ├── projectService.ts
│   └── ...
├── stores/               # Zustand 스토어
│   └── authStore.ts
├── types/                # TypeScript 타입 정의
├── hooks/                # Custom hooks
└── utils/                # 유틸리티
```

### 핵심 개념: 역량 재사용 (전자지갑)

1. **CoachCompetency (중앙 DB)**
   - 코치가 평소 입력/관리하는 역량 정보
   - 실무자가 "확인완료" 처리한 항목은 재사용 가능
   - 위치: `/competencies` 페이지 (UnifiedCompetencyPage)

2. **ApplicationData (스냅샷 DB)**
   - 프로젝트 지원 시 CoachCompetency를 참조하여 자동 복사
   - 기존 확인완료 정보는 "이 정보 사용" 버튼으로 재사용
   - 위치: `/projects/:id/apply` 페이지 (ApplicationSubmitPage)

3. **검증 플로우**
   - 코치 → 역량 입력 + 증빙 첨부
   - 실무자 → 증빙 검토 → "확인완료" 또는 "보완필요"
   - 확인완료된 역량은 다른 프로젝트 지원 시 재사용

### 데이터베이스

**주요 테이블:**
- `users` - 사용자 (roles: COACH, STAFF, ADMIN, SUPER_ADMIN)
- `competency_items` - 역량 항목 정의 (KCA 자격, 코칭 경력시간, 학위 등)
- `coach_competencies` - 코치 역량 중앙 DB (전자지갑)
- `projects` - 프로젝트/모집 공고
- `project_competency_mappings` - 프로젝트별 평가 항목 설정
- `applications` - 지원서
- `application_data` - 지원서 항목별 데이터 (스냅샷)
- `files` - 증빙 파일
- `notifications` - 알림

**Enum 타입:**
- `projectstatus` - draft, pending, approved, ready, recruiting, reviewing, in_progress, evaluating, closed
- `proofrequiredlevel` - NOT_REQUIRED, OPTIONAL, REQUIRED
- `matchingtype` - EXACT, CONTAINS, RANGE

**마이그레이션:**
- Alembic 사용
- `backend/alembic/versions/` 에 마이그레이션 파일 존재
- 앱 시작 시 자동으로 `alembic upgrade head` 실행됨

### 환경 변수

Backend `.env` 필요:
- `DATABASE_URL` - PostgreSQL 연결 문자열
- `SECRET_KEY` - JWT 서명 키
- `BACKEND_CORS_ORIGINS` - 허용할 프론트엔드 origin

참고: `backend/.env.example` 참조

## 작업 원칙 (필수 준수)

### 1. TodoWrite 필수 사용
- 3개 이상의 작업이 있으면 반드시 TodoWrite로 등록
- 각 작업 완료 시 즉시 completed로 변경
- 모든 작업이 completed 되기 전까지 commit 금지

### 2. Commit 전 체크리스트
- 계획한 모든 항목이 완료되었는지 확인
- TodoWrite 목록에 pending/in_progress 항목이 없어야 함
- 미완료 항목이 있으면 commit 하지 말고 사용자에게 보고

### 3. 임의 판단 금지
- 작업 범위를 임의로 축소/변경하지 않음
- "이건 나중에" 또는 "이건 별도로" 판단 금지
- 불확실하면 반드시 사용자에게 질문

### 4. 작업 완료 기준
- 계획한 모든 항목 구현 완료
- 빌드 에러 없음
- 사용자가 요청한 기능이 모두 동작

### 5. 코드 수정 원칙 (원상복구 방지)
- 수정 전 반드시 해당 파일 Read로 확인
- 참고할 UI/패턴이 있으면 해당 파일도 먼저 확인
- 에러 발생 시 즉시 수정, 다음 작업으로 넘어가지 않음

#### 5-1. Edit 직전 필수 Read
- Edit 호출 직전에 반드시 해당 파일을 Read (5분 전에 읽었더라도 다시 읽기)
- "File has been modified since read" 에러 발생 시 반드시 다시 Read 후 Edit

#### 5-2. Edit 후 즉시 검증
- Edit 완료 후 해당 부분을 다시 Read하여 의도대로 반영되었는지 확인
- 특히 여러 곳을 수정할 때는 각 Edit 후 검증 필수

#### 5-3. 다중 파일 수정 시 순차 처리
- 파일 A 수정 → 파일 A 검증 → 파일 B 수정 → 파일 B 검증
- 병렬 Edit 금지 (한 번에 여러 파일 Edit 호출 금지)
- 이전 파일 수정이 확인된 후에만 다음 파일로 이동

#### 5-4. 코드 축약/재작성 금지
- 기존 코드 수정 시 "재작성" 금지
- 반드시 정확한 old_string으로 최소 범위만 부분 교체
- 기존 코드의 디테일한 로직/예외처리/주석을 임의로 생략하지 않음
- 긴 코드를 "비슷하게" 다시 쓰지 않고, 정확히 복사하여 필요한 부분만 변경

#### 5-5. 연쇄 수정 시 이전 수정 보존 확인
- A 문제 해결 후 B 문제 해결 시, B 수정 전에 A 수정이 유지되는지 확인
- old_string은 반드시 현재 파일 상태 기준으로 작성 (기억 의존 금지)

### 6. 데이터 초기화 원칙
- reset API 호출 후 반드시 seed API도 호출하여 기본 데이터 복구
- 초기화 완료 후 사용자에게 브라우저 새로고침 안내

### 7. 시간 기준
- 데이터 기록, 조회, 표시 모두 특별한 요청이 없는 한 한국시간(KST) 기준으로 한다.

### 8. 자동 commit & push
- 위의 모든 수정작업이 위 원칙대로 완료되면 묻지 않고 자동으로 commit 하고 push까지 진행한 뒤 보고한다.

## 주요 API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 사용자 정보

### 역량 관리 (중앙 DB)
- `GET /api/competencies/items` - 역량 항목 목록
- `GET /api/competencies/my-competencies` - 내 역량 조회
- `POST /api/competencies/my-competencies` - 역량 추가/수정
- `GET /api/competencies/{id}` - 특정 역량 조회

### 프로젝트
- `GET /api/projects` - 프로젝트 목록
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects/{id}` - 프로젝트 상세
- `PUT /api/projects/{id}` - 프로젝트 수정
- `GET /api/projects/{id}/competency-mappings` - 프로젝트 평가항목

### 지원서
- `POST /api/applications` - 지원서 제출
- `GET /api/applications/my-applications` - 내 지원서 목록
- `GET /api/applications/{id}` - 지원서 상세
- `GET /api/applications/{id}/submission-status` - 제출 가능 여부

### 검증
- `GET /api/verifications/pending` - 검증 대기 목록
- `POST /api/verifications/{id}/approve` - 확인완료
- `POST /api/verifications/{id}/reject` - 보완필요

### 파일
- `POST /api/files/upload` - 파일 업로드
- `GET /api/files/{id}` - 파일 다운로드

## 개발 시 주의사항

### Backend
- 모든 DB 작업은 async/await 사용
- `Depends(get_db)` 로 AsyncSession 주입
- Enum 값은 대소문자 구분 주의 (projectstatus는 소문자)
- 마이그레이션 생성: `alembic revision --autogenerate -m "description"`

### Frontend
- API 호출은 services/ 를 통해 (직접 axios 호출 지양)
- 인증은 authStore 사용 (Zustand)
- 보호된 페이지는 ProtectedRoute로 감싸기
- Ant Design 컴포넌트 사용 (일관성)

### 역할 기반 접근 제어
- COACH: 역량 관리, 프로젝트 지원
- STAFF: 지원서 검토, 증빙 확인
- ADMIN/PROJECT_MANAGER: 프로젝트 생성/관리
- SUPER_ADMIN: 시스템 전체 관리

### 증빙 파일 처리
- 파일 업로드는 multipart/form-data
- 파일 ID를 역량/지원서 데이터에 저장
- 필수 증빙 미첨부 시 제출 불가 (can_submit=false)

## 참고 문서

- `coach_db_service_final_v3.md` - 전체 시스템 설계서
- `backend/.env.example` - 환경 변수 예시
- `backend/alembic/versions/` - 데이터베이스 스키마 변경 이력
