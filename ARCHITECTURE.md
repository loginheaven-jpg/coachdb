# ARCHITECTURE.md

프로젝트의 아키텍처, 설계 원칙, 도메인 모델에 대한 상세 문서

**⚠️ 중요**: 이 문서는 시스템의 단일 진실 공급원(Single Source of Truth)입니다.
모든 주요 변경사항은 반드시 이 문서에 반영해야 합니다.

---

## 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [아키텍처 설계 원칙](#아키텍처-설계-원칙)
4. [데이터베이스 스키마](#데이터베이스-스키마)
5. [알림 시스템](#알림-시스템-notification-system)
6. [API 엔드포인트 구조](#api-엔드포인트-구조)
7. [프로젝트 생명주기](#프로젝트-생명주기-project-lifecycle)
8. [응모 및 검토 프로세스](#응모-및-검토-프로세스)
9. [배포 및 인프라 (Railway)](#배포-및-인프라-railway)
10. [주요 비즈니스 로직](#주요-비즈니스-로직)
11. [프론트엔드 구조](#프론트엔드-구조)
12. [트러블슈팅 가이드](#트러블슈팅-가이드)
13. [개발 가이드라인](#개발-가이드라인)

---

## 프로젝트 개요

### 기본 정보
- **프로젝트명**: PCMS (Project & Coach pool Management System)
- **부제**: 코치 역량 데이터베이스 및 프로젝트 매칭 시스템
- **한 줄 요약**: 코치의 역량을 중앙 DB에 저장하고, 프로젝트 지원 시 재사용할 수 있는 "전자지갑" 시스템
- **주요 사용자**:
  - **코치 (COACH)**: 역량 관리, 프로젝트 지원
  - **실무자 (STAFF/VERIFIER)**: 증빙서류 검토 및 검증
  - **평가자 (REVIEWER)**: 코치 평가 및 심사
  - **프로젝트 관리자 (PROJECT_MANAGER)**: 프로젝트 생성, 평가 기준 설정
  - **시스템 관리자 (SUPER_ADMIN)**: 시스템 설정, 역량 항목 정의, 과제 승인

### 핵심 목적
1. **역량 정보의 중앙 관리** (전자지갑)
   - 코치가 한 번 입력하고 증빙 제출한 역량은 영구 보관
   - 실무자가 확인완료한 역량은 다른 프로젝트에서 재사용 가능
   - 증빙 재제출 불필요 → 코치와 실무자 모두의 업무 부담 감소

2. **프로젝트 기반 코치 모집 및 선발**
   - 프로젝트별 맞춤형 평가 항목 설정
   - 자동 점수 계산 (정량 평가)
   - 정성 평가와 결합한 종합 평가

3. **투명하고 체계적인 검증 프로세스**
   - 증빙서류 기반 검토
   - 동시 검토 지원 (여러 실무자가 항목별 분담)
   - 보완 요청 및 재제출 관리

4. **데이터 영구 보관 및 통계**
   - 역량 데이터 영구 보관 (탈퇴자 포함)
   - 증빙 파일 5년 보관 후 아카이빙
   - 프로젝트별 통계 및 코치 성과 분석

---

## 기술 스택

### Backend
- **Framework**: FastAPI 0.109+ (Python 3.11+)
- **Database**: PostgreSQL 14+ (Railway PostgreSQL)
- **ORM**: SQLAlchemy 2.0+ (Async)
- **Migration**: Alembic
- **Authentication**: JWT (python-jose)
- **Password**: bcrypt
- **Async**: asyncio, asyncpg
- **Cache**: Redis (설정되어 있으나 현재 미사용)

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **UI Library**: Ant Design 5.x
- **State Management**: Zustand
- **Data Fetching**: React Query + Axios
- **Routing**: React Router v6
- **Date**: dayjs (한국 시간 기준, KST)
- **PDF Viewer**: react-pdf

### Deployment
- **Platform**: Railway
- **Backend**: Docker (Dockerfile, uvicorn)
- **Frontend**: Static file serving (Vite build)
- **Database**: Railway PostgreSQL
- **CI/CD**: Git push → Railway auto-deploy

---

## 아키텍처 설계 원칙

### 1. 레이어 아키텍처 (Layered Architecture)

```
┌─────────────────────────────────────────┐
│        Presentation Layer               │
│  (FastAPI Routers, Pydantic Schemas)    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Business Layer                  │
│       (Services, Domain Logic)          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│        Data Access Layer                │
│    (SQLAlchemy Models, AsyncSession)    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│            Database                     │
│         (PostgreSQL)                    │
└─────────────────────────────────────────┘
```

**의존성 방향**: 상위 레이어 → 하위 레이어 (단방향)

**각 레이어의 역할**:
- **Presentation**: HTTP 요청/응답 처리, 데이터 검증 (Pydantic)
- **Business**: 비즈니스 로직, 점수 계산, 검증 규칙 (Service 레이어)
- **Data Access**: DB 쿼리, 트랜잭션 관리 (SQLAlchemy ORM)
- **Database**: 데이터 저장 및 무결성 보장 (PostgreSQL)

### 2. 핵심 설계 패턴

#### 2.1. 중앙 DB + 스냅샷 패턴 (Central DB + Snapshot)

**CoachCompetency (중앙 DB - 전자지갑)**
- 코치의 역량을 중앙에서 관리
- 검증 상태 추적 (`pending` → `approved` / `rejected`)
- 영구 보관 (탈퇴 후에도 익명화하여 유지)

**ApplicationData (스냅샷)**
- 프로젝트 지원 시점의 역량 데이터 복사본
- `competency_id`로 원본 참조
- 마감 후 동결 (`is_frozen=true`) - 데이터 변조 방지

**설계 의도**:
- 역량 재사용: 확인완료된 역량은 자동 복사, 증빙 재제출 불필요
- 데이터 무결성: 마감 후에도 지원서 내용 변경 불가
- 이력 추적: 과거 프로젝트 지원 당시의 역량 상태 보존

#### 2.2. 템플릿 기반 역량 항목 (Template-Based Competency Items)

**CompetencyItem + CompetencyItemField**
- 역량 항목은 템플릿으로 정의 (`ItemTemplate` enum)
- 각 템플릿은 여러 필드로 구성 가능 (예: 학위 = 학위수준 + 전공 + 증빙)
- 반복 입력 지원 (`is_repeatable=true`) - 예: 복수 자격증

**템플릿 유형**:
- `text`: 단순 텍스트
- `number`: 단순 숫자
- `select`: 단일 선택
- `multiselect`: 다중 선택
- `file`: 단일 파일
- `text_file`: 텍스트 + 파일 (자격증, 경험)
- `degree`: 학위 (선택 + 텍스트 + 파일)
- `coaching_history`: 코칭 분야 이력 + 증빙
- `coaching_time`: 코칭시간 (내용 + 연도 + 시간 + 증빙)
- `coaching_experience`: 코칭경력 (기관명 + 연도 + 시간 + 증빙)

**설계 의도**:
- 유연성: 새로운 역량 항목을 코드 수정 없이 추가
- 일관성: 모든 프로젝트에서 동일한 역량 항목 정의 공유
- 확장성: 템플릿 추가로 다양한 입력 형태 지원

#### 2.3. 점수 계산 엔진 (Scoring Engine)

**ScoringCriteria + Matching Types**
- 프로젝트별 평가 기준 설정
- 다양한 매칭 방식 지원:
  - `exact`: 정확히 일치 (예: "KSC" → 10점)
  - `contains`: 포함 여부 (예: "진로" 포함 → 5점)
  - `range`: 숫자 범위 (예: 1000 이상 → 10점)
  - `grade`: 등급별 점수 (예: KSC=10, KAC=8, KPC=5)
  - `EXISTS`: 값 존재 여부
  - `ANY`: 항상 매칭

**집계 방식** (`AggregationMode`):
- `first`: 첫 번째만 (기본값)
- `sum`: 합산 (코칭 시간 등)
- `max`: 최대값
- `count`: 개수
- `any_match`: 하나라도 매칭
- `best_match`: 가장 높은 점수

**설계 의도**:
- 자동화: 증빙 확인 후 자동 점수 계산
- 투명성: 명확한 점수 산정 기준
- 유연성: 프로젝트마다 다른 평가 기준 적용 가능

### 3. 보안 및 인증 설계

#### 3.1. JWT 기반 인증
- **Access Token**: 30분 만료 (API 호출에 사용)
- **Refresh Token**: 7일 만료 (Access Token 갱신용)
- 비밀번호: bcrypt 해싱 (72 byte 제한 고려)

#### 3.2. 역할 기반 접근 제어 (RBAC)

**역할 정의** (`UserRole` enum):
- `SUPER_ADMIN`: 시스템 전체 관리, 역량 항목 정의, 과제 승인
- `PROJECT_MANAGER`: 프로젝트 생성/관리, 평가 기준 설정
- `VERIFIER`: 증빙서류 검증 (실무자)
- `REVIEWER`: 코치 평가/심사
- `COACH`: 일반 코치
- ~~`ADMIN`, `STAFF`~~: Deprecated (하위 호환성 유지)

**권한 체계**:
- 복수 역할 지원: `roles` 필드는 JSON 배열
- Dependency 기반 권한 체크: `require_roles([UserRole.ADMIN, UserRole.STAFF])`
- 프론트엔드 권한 체크: `authStore.hasRole(['ADMIN', 'STAFF'])`

#### 3.3. 파일 업로드 보안
- 실행 파일 차단: `.exe`, `.bat`, `.sh`, `.ps1` 등
- 파일 크기 제한: 10MB (설정 가능)
- 허용 타입 설정 가능 (기본: 모든 문서/이미지 허용)
- 업로더 추적: `File.uploader_id` 기록

---

## 데이터베이스 스키마

### 주요 테이블 구조

#### 1. users (사용자)
```sql
- user_id: BIGINT PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- hashed_password: VARCHAR(255) NOT NULL
- name: VARCHAR(100) NOT NULL
- phone: VARCHAR(20)
- roles: JSON (배열: ["COACH", "VERIFIER"] 등)
- status: VARCHAR(20) DEFAULT 'active'  # active / deleted
- address: VARCHAR(200) NOT NULL
- in_person_coaching_area: VARCHAR(200)
- coach_certification_number: VARCHAR(50)  # 최상위 자격 (KSC, KAC 등)
- coaching_fields: JSON  # 코칭 전문 분야 배열
- created_at, updated_at: TIMESTAMP
```

#### 2. coach_profiles (코치 상세 프로필)
```sql
- profile_id: BIGINT PRIMARY KEY
- user_id: BIGINT FK → users.user_id
- coaching_years: INTEGER  # 코칭 경력 연수
- specialty: VARCHAR(500)  # 전문 분야
- certifications: TEXT  # 자격증 요약
- mentoring_experiences: TEXT  # 멘토링 경험
- created_at, updated_at: TIMESTAMP
```

#### 3. competency_items (역량 항목 마스터)
```sql
- item_id: INTEGER PRIMARY KEY
- item_code: VARCHAR(100) UNIQUE NOT NULL
- item_name: VARCHAR(200) NOT NULL
- category: competencycategory ENUM
- template: itemtemplate ENUM
- is_repeatable: BOOLEAN DEFAULT FALSE
- max_entries: INTEGER
- is_custom: BOOLEAN DEFAULT FALSE
- is_active: BOOLEAN DEFAULT TRUE
- description: TEXT  # 설문 입력 안내 문구
- created_by: BIGINT FK → users.user_id
```

#### 4. coach_competencies (코치 역량 - 전자지갑)
```sql
- competency_id: BIGINT PRIMARY KEY
- user_id: BIGINT FK → users.user_id
- item_id: INTEGER FK → competency_items.item_id
- value: TEXT (JSON 또는 문자열)
- file_id: BIGINT FK → files.file_id
- verification_status: VARCHAR(20) DEFAULT 'pending'
- verified_by: BIGINT FK → users.user_id
- verified_at: TIMESTAMP
- rejection_reason: TEXT
- is_globally_verified: BOOLEAN DEFAULT FALSE
- globally_verified_at: TIMESTAMP
- is_anonymized: BOOLEAN DEFAULT FALSE
- created_at, updated_at: TIMESTAMP
```

#### 5. projects (프로젝트/모집 공고)
```sql
- project_id: INTEGER PRIMARY KEY
- project_name: VARCHAR(200) NOT NULL
- project_type: projecttype ENUM  # public_coaching, business_coaching, other
- support_program_name: VARCHAR(200)  # 지원 사업명
- description: TEXT
- status: projectstatus ENUM DEFAULT 'DRAFT'  # ⚠️ UPPERCASE 값 사용
- recruitment_start_date, recruitment_end_date: DATE
- project_start_date, project_end_date: DATE  # 계획
- actual_start_date, actual_end_date: DATE  # 실제
- max_participants: INTEGER NOT NULL
- quantitative_weight: NUMERIC(5,2) DEFAULT 70  # 정량평가 가중치
- qualitative_weight: NUMERIC(5,2) DEFAULT 30   # 정성평가 가중치
- project_manager_id: BIGINT FK → users.user_id
- created_by: BIGINT FK → users.user_id
- project_achievements, project_special_notes: TEXT
- review_started_at: TIMESTAMP  # 심사개시 시점 (이 시점 이후 보완 제출 차단)
- created_at, updated_at: TIMESTAMP
```

#### 6. applications (지원서)
```sql
- application_id: BIGINT PRIMARY KEY
- project_id: INTEGER FK → projects.project_id
- user_id: BIGINT FK → users.user_id
- status: VARCHAR(20) DEFAULT 'draft'  # draft, submitted, reviewing, completed
- motivation: TEXT  # 지원 동기
- applied_role: VARCHAR(50)  # 리더, 참여, 수퍼비전
- auto_score: NUMERIC(5,2)  # 자동 계산 점수
- final_score: NUMERIC(5,2)  # 최종 점수
- score_visibility: VARCHAR(20) DEFAULT 'admin_only'
- can_submit: BOOLEAN DEFAULT FALSE
- selection_result: VARCHAR(20) DEFAULT 'pending'  # pending, selected, rejected
- is_frozen: BOOLEAN DEFAULT FALSE
- frozen_at: TIMESTAMP
- submitted_at, reviewed_at: TIMESTAMP
- document_status: ENUM DEFAULT 'pending'  # pending, in_review, supplement_requested, approved, disqualified (심사개시용)
- document_disqualification_reason: TEXT  # 서류탈락 사유
- document_disqualified_at: TIMESTAMP  # 서류탈락 시점
- UNIQUE(project_id, user_id)  # 중복 지원 방지
```

#### 7. application_data (지원서 항목별 데이터 - 스냅샷)
```sql
- data_id: BIGINT PRIMARY KEY
- application_id: BIGINT FK → applications.application_id
- item_id: INTEGER FK → competency_items.item_id
- competency_id: BIGINT FK → coach_competencies.competency_id  # 재사용 시
- submitted_value: TEXT (JSON 또는 문자열)
- submitted_file_id: BIGINT FK → files.file_id
- verification_status: VARCHAR(20) DEFAULT 'pending'
- item_score: NUMERIC(5,2)
- reviewed_by: BIGINT FK → users.user_id
- reviewed_at: TIMESTAMP
- rejection_reason: TEXT
- supplement_deadline: TIMESTAMP
- supplement_requested_at: TIMESTAMP
```

#### 8. notifications (알림)
```sql
- notification_id: BIGINT PRIMARY KEY
- user_id: BIGINT FK → users.user_id
- type: VARCHAR(50) NOT NULL  # NotificationType enum 값
- title: VARCHAR(200) NOT NULL
- message: TEXT
- related_application_id: BIGINT FK → applications.application_id
- related_project_id: INTEGER FK → projects.project_id
- related_data_id: BIGINT  # ApplicationData.data_id (FK 아님)
- related_competency_id: BIGINT FK → coach_competencies.competency_id
- is_read: BOOLEAN DEFAULT FALSE
- read_at: TIMESTAMP
- email_sent: BOOLEAN DEFAULT FALSE
- email_sent_at: TIMESTAMP
- created_at: TIMESTAMP DEFAULT NOW()
```

#### 9. files (증빙 파일)
```sql
- file_id: BIGINT PRIMARY KEY
- filename: VARCHAR(255) NOT NULL
- file_path: VARCHAR(500) NOT NULL
- file_size: BIGINT
- mime_type: VARCHAR(100)
- uploader_id: BIGINT FK → users.user_id
- uploaded_at: TIMESTAMP
- is_archived: BOOLEAN DEFAULT FALSE
```

### PostgreSQL Enum Types

#### ⚠️ CRITICAL: Enum 값 대소문자 정책

**PostgreSQL enum 값과 Python enum 멤버 이름은 반드시 일치해야 함**

**현재 정책 (2026-01-22 기준)**:
| Enum 타입 | 대소문자 | 예시 |
|-----------|---------|------|
| `projectstatus` | **UPPERCASE** | `DRAFT`, `PENDING`, `APPROVED`, `READY`, `RECRUITING`, `REVIEWING`, `IN_PROGRESS`, `EVALUATING`, `CLOSED` |
| `projecttype` | lowercase | `public_coaching`, `business_coaching`, `other` |
| `competencycategory` | **UPPERCASE** | `BASIC`, `CERTIFICATION`, `EDUCATION`, `EXPERIENCE`, `OTHER`, `DETAIL`, `ADDON`, `COACHING` |
| `itemtemplate` | lowercase | `text`, `number`, `select`, `multiselect`, `file`, `text_file`, `degree`, `coaching_history`, `coaching_time` |
| `matchingtype` | lowercase/mixed | `exact`, `contains`, `range`, `grade`, `EXISTS`, `ANY` |
| `aggregationmode` | lowercase | `first`, `sum`, `max`, `count`, `any_match`, `best_match` |

#### ⚠️ 중요 규칙

1. **SQLAlchemy는 enum 멤버 이름(name)을 DB 쿼리에 사용**
   ```python
   # Python 모델
   class ProjectStatus(str, enum.Enum):
       DRAFT = "DRAFT"  # ← 멤버 이름

   # SQLAlchemy 쿼리 생성
   Project.status == ProjectStatus.DRAFT
   # → SQL: WHERE status = 'DRAFT'  (멤버 이름 사용!)
   ```

2. **일관성 없는 대소문자 사용 시 발생 문제**
   ```python
   # ❌ 잘못된 예
   class ProjectStatus(str, enum.Enum):
       draft = "draft"  # Python: 소문자

   # PostgreSQL: ENUM('DRAFT', 'PENDING', ...)  # DB: 대문자
   # 결과: invalid input value for enum projectstatus: "draft"
   ```

3. **올바른 구현** (backend/app/models/project.py:8-24)
   ```python
   class ProjectStatus(str, enum.Enum):
       """Project status enum - names match PostgreSQL enum values (UPPERCASE)

       IMPORTANT: Enum member NAMES must match PostgreSQL enum VALUES exactly.
       SQLAlchemy uses enum member names (not values) for database queries.
       """
       DRAFT = "DRAFT"  # ✅ 이름과 값 모두 UPPERCASE
       PENDING = "PENDING"
       APPROVED = "APPROVED"
       READY = "READY"
       RECRUITING = "RECRUITING"
       REVIEWING = "REVIEWING"
       IN_PROGRESS = "IN_PROGRESS"
       EVALUATING = "EVALUATING"
       CLOSED = "CLOSED"
   ```

4. **start.sh에서 enum 값 자동 추가 및 변환**
   - 배포 시 `backend/start.sh` (Lines 194-233)가 자동 실행
   - 누락된 enum 값 추가 (하위 호환성)
   - 기존 소문자 데이터를 대문자로 변환

   ```bash
   # start.sh 주요 로직
   # 1. 소문자와 대문자 enum 값 모두 추가
   all_status_values = [
       'approved', 'draft', 'pending', ...  # 기존 데이터 호환용
       'APPROVED', 'DRAFT', 'PENDING', ...  # 현재 사용 중
   ]

   # 2. 기존 데이터 변환
   status_conversions = [
       ('approved', 'APPROVED'),
       ('draft', 'DRAFT'),
       # ...
   ]
   UPDATE projects SET status = 'APPROVED'::projectstatus WHERE status::text = 'approved'
   ```

5. **새 enum 값 추가 시 절차**
   - ① PostgreSQL enum에 먼저 값 추가 (`ALTER TYPE ... ADD VALUE`)
   - ② Python 모델에 enum 멤버 추가 (이름 = 값으로 일치)
   - ③ start.sh에도 동일한 값 추가 (배포 시 자동 적용)
   - ④ 대소문자 정책 준수 (projectstatus는 UPPERCASE)

### 주요 인덱스

```sql
-- 성능 최적화를 위한 인덱스
CREATE INDEX idx_users_email ON users(email);  -- Unique Index
CREATE INDEX idx_coach_competencies_user_id ON coach_competencies(user_id);
CREATE INDEX idx_coach_competencies_item_id ON coach_competencies(item_id);
CREATE INDEX idx_applications_project_id_user_id ON applications(project_id, user_id);
CREATE INDEX idx_application_data_application_id ON application_data(application_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

---

## 알림 시스템 (Notification System)

### 알림 유형 (NotificationType)

**정의**: `backend/app/models/notification.py:8-26`

```python
class NotificationType(str, enum.Enum):
    # 응모 관련
    APPLICATION_DRAFT_SAVED = "application_draft_saved"
    APPLICATION_SUBMITTED = "application_submitted"

    # 서류 보충 관련
    SUPPLEMENT_REQUEST = "supplement_request"          # 응모 서류 보충 요청
    SUPPLEMENT_SUBMITTED = "supplement_submitted"      # 보충 서류 제출됨 (Staff용)
    REVIEW_COMPLETE = "review_complete"                # 심사 완료
    SELECTION_RESULT = "selection_result"              # 선발 결과
    PROJECT_UPDATE = "project_update"                  # 과제 업데이트
    DEADLINE_REMINDER = "deadline_reminder"            # 마감 임박 알림

    # 증빙 검증 관련
    VERIFICATION_SUPPLEMENT_REQUEST = "verification_supplement_request"  # 증빙 보완 요청
    VERIFICATION_COMPLETED = "verification_completed"  # 증빙 검증 완료
    VERIFICATION_RESET = "verification_reset"          # 검증 리셋 (활동 기록용)

    # 과제 승인 관련
    PROJECT_APPROVED = "project_approved"              # 과제 승인됨
    PROJECT_REJECTED = "project_rejected"              # 과제 반려됨
```

### 알림 생성 흐름

**예시: 응모 서류 보완 요청**

1. **이벤트 발생**
   - 실무자가 증빙검토 화면에서 "보완 요청" 버튼 클릭
   - API: `POST /api/applications/{application_id}/data/{data_id}/request-supplement`
   - 엔드포인트: `backend/app/api/endpoints/applications.py:1220-1302`

2. **알림 서비스 호출**
   ```python
   # backend/app/services/notification_service.py:111-138
   await send_supplement_request_notification(
       db=db,
       user_id=application.user_id,  # 코치 ID
       application_id=application_id,
       project_id=application.project_id,
       data_id=data_id,
       item_name="코칭 자격증",
       reason="증빙 파일이 명확하지 않습니다",
       project_name="2024 공익코칭 프로젝트",  # ✨ 2026-01-22 추가
       deadline="2024-12-31"
   )
   ```

3. **Notification 레코드 생성**
   ```python
   # backend/app/services/notification_service.py:123-127
   if project_name:
       title = f"[{project_name}] 서류 보충이 필요합니다: {item_name}"
   else:
       title = f"서류 보충이 필요합니다: {item_name}"

   notification = Notification(
       user_id=user_id,
       type=NotificationType.SUPPLEMENT_REQUEST,
       title=title,
       message=reason,
       related_application_id=application_id,
       related_project_id=project_id,
       related_data_id=data_id,
       is_read=False,
       email_sent=False
   )
   ```

4. **이메일 발송** (선택적, 현재 미구현)
   - `notification_service.py:create_notification_with_email()`
   - 이메일 템플릿 렌더링
   - SMTP 발송 (로그만 출력, 실제 발송 미구현)

### 알림 표시 위치 (Frontend)

#### 1. AppLayout.tsx (헤더 벨 아이콘)
- **위치**: `frontend/src/components/layout/AppLayout.tsx:100-128`
- **표시**: 모든 페이지 상단 우측, 읽지 않은 알림 개수 뱃지
- **클릭 동작**: Popover로 최근 알림 5개 표시

**알림 클릭 시 네비게이션** (Lines 115-128):
```typescript
const handleNotificationClick = async (notification: Notification) => {
  // 읽음 처리
  if (!notification.is_read) {
    await notificationService.markAsRead(notification.notification_id)
  }

  setPopoverVisible(false)

  // 관련 페이지로 이동
  if (notification.related_competency_id) {
    navigate('/coach/competencies')
  } else if (notification.related_application_id && notification.related_project_id) {
    // ✨ 2026-01-22: 직접 응모서류 수정 화면으로 이동
    navigate(
      `/projects/${notification.related_project_id}/apply?applicationId=${notification.related_application_id}&mode=edit`
    )
  } else if (notification.related_application_id) {
    navigate('/my-applications')  // Fallback
  } else if (notification.related_project_id) {
    navigate('/projects')
  } else {
    navigate('/dashboard')
  }
}
```

#### 2. CoachDashboard.tsx (코치 대시보드)
- **위치**: `frontend/src/pages/CoachDashboard.tsx:213-250`
- **표시**: Timeline 컴포넌트로 최근 알림 목록
- **클릭 동작**: AppLayout과 동일한 네비게이션 로직 (Lines 232-243)

#### 3. DashboardPage.tsx (메인 대시보드)
- **위치**: `frontend/src/pages/DashboardPage.tsx:300-324`
- **표시**: 모든 역할 공통 대시보드, Timeline 또는 Card 형태
- **클릭 동작**: AppLayout과 동일한 네비게이션 로직 (Lines 313-324)

### 최근 개선사항 (2026-01-22)

**커밋**: `4cdcec0` - "Enhance: show project name in supplement request notifications and direct link to edit"

**문제점**:
- 알림 제목에 과제명이 없어서 어떤 과제 관련 알림인지 불명확
- 알림 클릭 시 응모 목록 페이지로만 이동 → 해당 응모 찾기 어려움
- 사용자 경험: 클릭 3+ 회 필요 (알림 → 목록 → 해당 응모 찾기 → 수정 버튼)

**해결**:
1. 알림 제목에 과제명 추가
   - 기존: `"서류 보충이 필요합니다: {item_name}"`
   - 변경: `"[{project_name}] 서류 보충이 필요합니다: {item_name}"`
   - 구현: `backend/app/services/notification_service.py:123-127`

2. 알림 클릭 시 직접 응모서류 수정 화면으로 이동
   - 기존: `/my-applications` (목록 페이지)
   - 변경: `/projects/{project_id}/apply?applicationId={application_id}&mode=edit` (직접 수정)
   - 구현: 3개 파일 모두 업데이트
     - `frontend/src/components/layout/AppLayout.tsx:117-121`
     - `frontend/src/pages/CoachDashboard.tsx:234-238`
     - `frontend/src/pages/DashboardPage.tsx:315-319`

3. 사용자 경험 개선: 클릭 1회로 단축

**하위 호환성**:
- `project_name`이 없는 기존 알림도 정상 동작
- `related_project_id`가 없으면 기존처럼 목록 페이지로 이동

---

## API 엔드포인트 구조

### 주요 엔드포인트 개요

#### Authentication (`/api/auth`)
```
POST   /api/auth/register           # 회원가입
POST   /api/auth/login              # 로그인 (JWT 발급)
POST   /api/auth/refresh            # Token 갱신
POST   /api/auth/logout             # 로그아웃
POST   /api/auth/forgot-password    # 비밀번호 찾기 (이메일 발송)
POST   /api/auth/reset-password     # 비밀번호 재설정
GET    /api/auth/me                 # 현재 사용자 정보
```

#### Competencies (`/api/competencies`)
```
GET    /api/competencies            # 내 역량 목록 (검증 상태 필터)
POST   /api/competencies            # 역량 등록
PUT    /api/competencies/{id}       # 역량 수정
DELETE /api/competencies/{id}       # 역량 삭제
GET    /api/competencies/{id}       # 역량 상세
```

#### Verifications (`/api/verifications`)
```
GET    /api/verifications           # 검증 대기 목록 (VERIFIER용)
GET    /api/verifications/{id}      # 증빙 상세 조회
POST   /api/verifications/{id}/approve   # 증빙 승인
POST   /api/verifications/{id}/reject    # 증빙 반려 (보완 요청)
POST   /api/verifications/{id}/reset     # 검증 리셋
```

#### Projects (`/api/projects`)
```
GET    /api/projects                # 프로젝트 목록 (mode: browse/manage/review)
POST   /api/projects                # 프로젝트 생성
GET    /api/projects/{id}           # 프로젝트 상세
PUT    /api/projects/{id}           # 프로젝트 수정 (draft 상태에서만)
DELETE /api/projects/{id}           # 프로젝트 삭제
POST   /api/projects/{id}/submit    # 과제 상신 (draft → pending)
POST   /api/projects/{id}/approve   # 과제 승인 (SUPER_ADMIN, pending → approved)
POST   /api/projects/{id}/reject    # 과제 반려 (SUPER_ADMIN, pending → draft)
POST   /api/projects/{id}/start-recruitment  # 모집 시작 (approved → ready)
GET    /api/projects/{id}/preview-start-review  # 심사개시 미리보기 (서류탈락 대상 조회)
POST   /api/projects/{id}/start-review  # 심사개시 (보완 차단, 미완료 건 서류탈락)
GET    /api/projects/{id}/items     # 프로젝트 수집 항목 목록
```

#### Applications (`/api/applications`)
```
GET    /api/applications            # 내 응모 목록
POST   /api/applications            # 응모 생성/임시저장
GET    /api/applications/{id}       # 응모 상세
PUT    /api/applications/{id}       # 응모 수정
POST   /api/applications/{id}/submit            # 응모 제출
GET    /api/applications/{project_id}/mine      # 특정 과제에 내가 제출한 응모
POST   /api/applications/{id}/data/{data_id}/request-supplement  # 서류 보완 요청
POST   /api/applications/{id}/freeze            # 응모 동결 (마감 시)
```

#### Notifications (`/api/notifications`)
```
GET    /api/notifications           # 내 알림 목록
GET    /api/notifications/unread-count  # 읽지 않은 알림 개수
POST   /api/notifications/{id}/mark-read  # 알림 읽음 처리
POST   /api/notifications/mark-all-read   # 모든 알림 읽음 처리
```

#### Admin (`/api/admin`)
```
GET    /api/admin/competency-items  # 역량 항목 마스터 목록
POST   /api/admin/competency-items  # 역량 항목 생성
PUT    /api/admin/competency-items/{id}  # 역량 항목 수정
GET    /api/admin/users             # 사용자 목록
PUT    /api/admin/users/{id}/roles  # 사용자 역할 변경
POST   /api/admin/reset             # 데이터베이스 초기화 (개발용)
POST   /api/admin/seed              # 시드 데이터 생성 (개발용)
```

#### Files (`/api/files`)
```
POST   /api/files/upload            # 파일 업로드
GET    /api/files/{id}/download     # 파일 다운로드
GET    /api/files/{id}/preview      # 파일 미리보기 (PDF 등)
```

#### Scoring (`/api/scoring`)
```
GET    /api/projects/{id}/scoring-criteria  # 평가 기준 조회
POST   /api/projects/{id}/calculate-scores  # 자동 점수 계산 (전체 응모)
POST   /api/applications/{id}/calculate-score  # 특정 응모 점수 계산
```

### API 호출 흐름 예시

**응모 서류 보완 요청 흐름**:
```
1. 실무자: VerificationPage.tsx에서 "보완 요청" 클릭
   ↓
2. Frontend: POST /api/applications/{app_id}/data/{data_id}/request-supplement
   Body: { rejection_reason: "증빙 불명확", deadline_days: 7 }
   ↓
3. Backend: applications.py:request_supplement_for_application_data()
   - ApplicationData.verification_status = 'supplement_requested'
   - ApplicationData.supplement_deadline = now + 7일
   ↓
4. Backend: notification_service.send_supplement_request_notification()
   - Notification 레코드 생성
   - title: "[과제명] 서류 보충이 필요합니다: 항목명"
   ↓
5. Frontend: 코치 알림 화면에 표시
   - AppLayout 헤더 벨 아이콘 (뱃지 +1)
   - CoachDashboard 최근 활동
   ↓
6. 코치: 알림 클릭
   ↓
7. Frontend: 직접 응모서류 수정 화면으로 이동
   URL: /projects/{project_id}/apply?applicationId={app_id}&mode=edit
```

---

## 프로젝트 생명주기 (Project Lifecycle)

### 상태 전이도

```
┌──────────┐
│  DRAFT   │  초안 (임시저장, 비공개)
│  (초안)  │  - 프로젝트 관리자가 생성
│          │  - 평가 항목, 기준 설정
└────┬─────┘  - 수정 가능
     │
     │ 상신 (submit)
     │ POST /api/projects/{id}/submit
     ↓
┌──────────┐
│ PENDING  │  승인대기
│(승인대기)│  - SUPER_ADMIN 승인 필요
│          │  - 과제 내용 검토
└────┬─────┘  - 수정 불가
     │
     │ 승인 (approve) / 반려 (reject)
     │ POST /api/projects/{id}/approve or /reject
     ↓
┌──────────┐
│APPROVED  │  승인완료
│(승인완료)│  - 모집 시작 전 상태
│          │  - 프로젝트 관리자가 모집 시작 결정
└────┬─────┘  - 수정 불가
     │
     │ 모집 시작 (start-recruitment)
     │ POST /api/projects/{id}/start-recruitment
     ↓
┌──────────┐
│  READY   │  모집개시
│(모집개시)│  - 코치들이 지원 가능
│          │  - recruitment_end_date까지 접수
└────┬─────┘  - 평가 기준 변경 불가
     │
     │ 모집 마감 (자동) → 증빙검토
     │ recruitment_end_date 경과
     ↓
┌───────────┐
│REVIEWING  │  심사중
│ (심사중)  │  - 실무자가 증빙서류 검토
│           │  - 자동 점수 계산
└────┬──────┘  - 정성 평가 진행
     │
     │ 선발 완료 (select)
     │ 프로젝트 관리자가 선발 결정
     ↓
┌─────────────┐
│IN_PROGRESS  │  과제진행중
│(과제진행중) │  - 선발된 코치들이 과제 수행
│             │  - 프로젝트 관리자가 진행 관리
└────┬────────┘
     │
     │ 과제 종료 → 평가 시작
     │ 프로젝트 관리자가 전환
     ↓
┌────────────┐
│EVALUATING  │  과제평가중
│(과제평가중)│  - 코치 성과 평가
│            │  - 최종 총평 작성
└────┬───────┘
     │
     │ 평가 완료
     │ 프로젝트 관리자가 종료
     ↓
┌──────────┐
│ CLOSED   │  종료
│  (종료)  │  - 과제 완전 종료
└──────────┘  - 통계/분석 데이터로 활용
```

### 상태별 권한 및 제약사항

| 상태 | 수정 가능 | 지원 가능 | 누가 전환? | 비고 |
|------|----------|----------|-----------|------|
| `DRAFT` | ✅ 전체 수정 가능 | ❌ 불가 (비공개) | PROJECT_MANAGER가 상신 | 평가 기준, 항목 설정 |
| `PENDING` | ❌ 수정 불가 | ❌ 불가 | SUPER_ADMIN이 승인/반려 | 과제 내용 검토 |
| `REJECTED` | ✅ 수정 가능 | ❌ 불가 | PROJECT_MANAGER가 재상신 | PENDING에서 반려 시 |
| `APPROVED` | ❌ 수정 불가 | ❌ 불가 (아직 미개시) | PROJECT_MANAGER가 모집 시작 | 승인 완료 상태 |
| `READY` | ❌ 수정 불가 | ✅ 가능 (모집 중) | 자동 (마감일) | 모집 기간 중 |
| `REVIEWING` | ❌ 수정 불가 | ❌ 마감됨 | PROJECT_MANAGER가 선발 | 증빙검토 및 평가 |
| `IN_PROGRESS` | ❌ 수정 불가 | ❌ 마감됨 | PROJECT_MANAGER가 평가 시작 | 과제 진행 중 |
| `EVALUATING` | ❌ 수정 불가 | ❌ 마감됨 | PROJECT_MANAGER가 종료 | 성과 평가 중 |
| `CLOSED` | ❌ 수정 불가 | ❌ 마감됨 | - | 완전 종료 |

### 주요 상태 전환 로직

**1. 상신 (DRAFT → PENDING)**:
```python
# backend/app/api/endpoints/projects.py
@router.post("/{project_id}/submit")
async def submit_project(project_id: int, current_user: User, db: AsyncSession):
    project = await db.get(Project, project_id)

    # 권한 확인: 생성자 또는 PROJECT_MANAGER
    if project.created_by != current_user.user_id:
        raise HTTPException(403, "권한 없음")

    # 상태 확인
    if project.status != ProjectStatus.DRAFT:
        raise HTTPException(400, "초안 상태에서만 상신 가능")

    # 필수 항목 검증 (평가 항목, 모집 기간 등)
    if not project.project_items:
        raise HTTPException(400, "평가 항목을 설정해주세요")

    # 상태 전환
    project.status = ProjectStatus.PENDING
    await db.commit()

    return {"message": "과제가 상신되었습니다"}
```

**2. 승인 (PENDING → APPROVED)**:
```python
@router.post("/{project_id}/approve")
async def approve_project(project_id: int, current_user: User, db: AsyncSession):
    # 권한 확인: SUPER_ADMIN만 가능
    if not has_role(current_user, [UserRole.SUPER_ADMIN]):
        raise HTTPException(403, "SUPER_ADMIN만 승인 가능")

    project = await db.get(Project, project_id)

    if project.status != ProjectStatus.PENDING:
        raise HTTPException(400, "승인 대기 상태에서만 승인 가능")

    # 상태 전환
    project.status = ProjectStatus.APPROVED
    await db.commit()

    # 알림 발송 (프로젝트 생성자에게)
    await send_project_approved_notification(
        db=db,
        user_id=project.created_by,
        project_id=project_id,
        project_name=project.project_name
    )

    return {"message": "과제가 승인되었습니다"}
```

**3. 모집 시작 (APPROVED → READY)**:
```python
@router.post("/{project_id}/start-recruitment")
async def start_recruitment(project_id: int, current_user: User, db: AsyncSession):
    project = await db.get(Project, project_id)

    # 권한 확인: 프로젝트 관리자 또는 생성자
    if project.project_manager_id != current_user.user_id and project.created_by != current_user.user_id:
        raise HTTPException(403, "권한 없음")

    if project.status != ProjectStatus.APPROVED:
        raise HTTPException(400, "승인완료 상태에서만 모집 시작 가능")

    # 모집 기간 검증
    if project.recruitment_start_date > datetime.now().date():
        raise HTTPException(400, "모집 시작일이 아직 도래하지 않았습니다")

    # 상태 전환
    project.status = ProjectStatus.READY
    await db.commit()

    return {"message": "모집이 시작되었습니다"}
```

---

## 응모 및 검토 프로세스

### 1. 응모 작성 흐름

```
코치 → 프로젝트 검색 → 프로젝트 상세 확인 → 응모 작성
                                    ↓
                         ┌──────────────────────┐
                         │ 1. 기본 정보 입력    │
                         │   - 지원 동기        │
                         │   - 신청 역할        │
                         │   - 커스텀 질문 답변 │
                         └──────────┬───────────┘
                                    ↓
                         ┌──────────────────────┐
                         │ 2. 역량 항목 입력    │
                         │   - 기존 역량 재사용 │
                         │     (클릭 한 번)     │
                         │   - 새 역량 입력     │
                         │     (값 + 파일)      │
                         └──────────┬───────────┘
                                    ↓
                 ┌──────────────────────────────────┐
                 │ 필수 증빙 모두 첨부?            │
                 └────┬─────────────────────┬───────┘
                      │ YES                 │ NO
                      ↓                     ↓
                 ┌─────────┐           ┌──────────┐
                 │ 제출 가능│           │임시저장만│
                 │can_submit=true│      │가능     │
                 └────┬────┘           └──────────┘
                      │
                      │ 제출 (submit)
                      ↓
              ┌──────────────────┐
              │ Application 생성 │
              │ status=submitted │
              │ submitted_at 기록│
              └──────────────────┘
```

**프론트엔드**: `ApplicationSubmitPage.tsx`

**백엔드**: `POST /api/applications` (임시저장), `POST /api/applications/{id}/submit` (제출)

### 2. 증빙검토 흐름

```
실무자 → 검토 대기 목록 조회 → 응모 선택 → 항목별 검토
                                       ↓
                            ┌──────────────────┐
                            │ ReviewLock 확인  │
                            │ (30분 잠금)      │
                            └────┬─────────────┘
                                 ↓
                            ┌──────────────────┐
                            │ PDF 뷰어로 증빙  │
                            │ 파일 확인        │
                            └────┬─────────────┘
                                 ↓
                   ┌─────────────────────────┐
                   │ 증빙이 적합한가?        │
                   └───┬─────────────┬───────┘
                       │ YES         │ NO
                       ↓             ↓
                 ┌──────────┐  ┌──────────────┐
                 │확인완료  │  │ 보완 요청     │
                 │(approve) │  │ - 사유 입력   │
                 │          │  │ - 마감일 설정 │
                 └────┬─────┘  └──────┬───────┘
                      │                │
                      │                │ 알림 발송 (SUPPLEMENT_REQUEST)
                      │                │ "[과제명] 서류 보충이 필요합니다: 항목명"
                      │                ↓
                      │         ┌─────────────────┐
                      │         │ 코치가 보완 제출│
                      │         │ (마감 전까지)   │
                      │         │ - 알림 클릭     │
                      │         │ - 직접 수정화면 │
                      │         └────────┬────────┘
                      │                  │
                      └──────────────────┘
                            │
                            │ 모든 항목 검토 완료
                            ↓
                   ┌──────────────────┐
                   │ 자동 점수 계산   │
                   │ (scoring_service)│
                   │ - 매칭 조건 확인 │
                   │ - 집계 방식 적용 │
                   └────────┬─────────┘
                            ↓
                   ┌──────────────────┐
                   │ auto_score 업데이트│
                   │ Application 테이블│
                   └──────────────────┘
```

**프론트엔드**: `VerificationPage.tsx`

**백엔드**:
- `POST /api/applications/{app_id}/data/{data_id}/request-supplement` (보완 요청)
- `POST /api/verifications/{id}/approve` (승인)

### 3. 동시 검토 지원 (ReviewLock)

**문제**: 여러 실무자가 동시에 같은 항목 검토 시 충돌

**해결**: `ReviewLock` 테이블로 항목별 잠금

**모델**: `backend/app/models/review_lock.py`
```python
class ReviewLock(Base):
    __tablename__ = "review_locks"

    lock_id: BIGINT PRIMARY KEY
    data_id: BIGINT  # ApplicationData ID
    locked_by: BIGINT  # 실무자 user_id
    locked_at: TIMESTAMP
    expires_at: TIMESTAMP  # 30분 후 자동 해제
```

**흐름**:
1. 실무자 A가 항목 클릭
2. `ReviewLock` 생성 (30분 만료)
3. 실무자 B가 동일 항목 클릭 → "다른 실무자 검토 중" 표시
4. 검토 완료 또는 30분 경과 → Lock 해제
5. 페이지 이탈 시에도 Lock 해제 (beforeunload 이벤트)

---

## 배포 및 인프라 (Railway)

### Railway 배포 구조

```
GitHub (main branch)
       ↓ git push
Railway Auto-Deploy
       ├─ Backend Service
       │  ├─ Dockerfile build
       │  ├─ start.sh 실행 ⚠️ 중요!
       │  ├─ Alembic migration
       │  └─ uvicorn app:main
       │
       ├─ Frontend Service
       │  ├─ Dockerfile build
       │  ├─ npm run build
       │  └─ Static file serving (nginx)
       │
       └─ PostgreSQL Database
          ├─ Auto-provisioned
          └─ DATABASE_URL 자동 설정
```

### railway.json 설정

**⚠️ 중요**: `builder`를 반드시 `DOCKERFILE`로 설정

**Backend** (`backend/railway.json`):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",  // ⚠️ NIXPACKS 사용 금지
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Frontend** (`frontend/railway.json`):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**왜 DOCKERFILE을 사용해야 하는가?**:
- `NIXPACKS` 사용 시 환경변수 `$PORT`가 문자열 그대로 전달됨
- Dockerfile CMD가 무시되어 start.sh가 실행되지 않음
- start.sh는 enum 값 추가 및 데이터 변환에 필수

### start.sh의 역할 (⚠️ 매우 중요)

**위치**: `backend/start.sh`

**실행 순서**:
```bash
#!/bin/bash
set -e

echo "=== Starting PCMS Backend ==="

# 1. DATABASE_URL 확인
if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL not set"
    exit 1
fi

# 2. psycopg2로 직접 연결 (동기)
python << 'EOF'
import os
import psycopg2

url = os.environ.get('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

# 3. 누락된 테이블 컬럼 추가 (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
columns_to_add = [
    ('support_program_name', 'VARCHAR(200)'),
    ('project_achievements', 'TEXT'),
    # ...
]
for col_name, col_type in columns_to_add:
    cur.execute(f"ALTER TABLE projects ADD COLUMN IF NOT EXISTS {col_name} {col_type}")

# 4. 누락된 Enum 값 추가 (ALTER TYPE ... ADD VALUE IF NOT EXISTS)
enum_values = ['ADDON', 'EDUCATION', 'COACHING', 'OTHER', 'CERTIFICATION']
for val in enum_values:
    cur.execute(f"ALTER TYPE competencycategory ADD VALUE IF NOT EXISTS '{val}'")

# 5. ⚠️ projectstatus enum: 소문자 + 대문자 모두 추가
all_status_values = [
    'approved', 'draft', 'pending', 'rejected', 'ready',
    'recruiting', 'reviewing', 'in_progress', 'evaluating', 'closed',
    'APPROVED', 'DRAFT', 'PENDING', 'REJECTED', 'READY',
    'RECRUITING', 'REVIEWING', 'IN_PROGRESS', 'EVALUATING', 'CLOSED'
]
for val in all_status_values:
    cur.execute(f"ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS '{val}'")

# 6. 기존 데이터 변환 (소문자 → 대문자)
status_conversions = [
    ('approved', 'APPROVED'),
    ('draft', 'DRAFT'),
    # ...
]
for old_val, new_val in status_conversions:
    cur.execute(f"""
        UPDATE projects
        SET status = '{new_val}'::projectstatus
        WHERE status::text = '{old_val}'
    """)
    if cur.rowcount > 0:
        print(f"[OK] Converted {cur.rowcount} projects from '{old_val}' to '{new_val}'")

cur.close()
conn.close()
EOF

# 7. Alembic 마이그레이션 실행
echo "=== Running migrations ==="
alembic upgrade head || echo "[WARN] Alembic migration failed, continuing..."

# 8. uvicorn 서버 시작
echo "=== Starting uvicorn ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
```

**왜 필요한가?**:
1. **Alembic 트랜잭션 제약**: Alembic은 트랜잭션 내에서 enum 값 추가 불가
2. **배포 시 자동 스키마 동기화**: 누락된 컬럼/enum 값 자동 추가
3. **하위 호환성 유지**: 소문자 → 대문자 enum 값 변환
4. **Zero-downtime 배포**: 기존 데이터 보존하면서 스키마 업데이트

**주요 작업** (Lines 194-233):
- projectstatus enum: 소문자 + 대문자 모두 추가
- 기존 데이터 변환 (`approved` → `APPROVED`)
- competencycategory enum 값 추가 (`ADDON`, `EDUCATION` 등)
- itemtemplate enum 값 추가 (`TEXT`, `NUMBER` 등)
- matchingtype enum 값 추가 (`GRADE`, `EXACT` 등)

### 환경 변수

**Backend 필수**:
```bash
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
SECRET_KEY=your-secret-key-min-32-characters
BACKEND_CORS_ORIGINS=["https://yourfrontend.com"]
FRONTEND_URL=https://yourfrontend.com
```

**Frontend 필수**:
```bash
VITE_API_BASE_URL=https://yourbackend.com
```

---

## 주요 비즈니스 로직

### 1. 자동 점수 계산 (Auto Scoring)

**서비스**: `backend/app/services/scoring_service.py`

**알고리즘**:
```python
async def calculate_application_score(application_id: int, db: AsyncSession):
    # 1. 응모 정보 조회
    application = await db.get(Application, application_id)
    project = await db.get(Project, application.project_id)

    # 2. 평가 기준 조회
    scoring_criteria = await db.execute(
        select(ScoringCriteria).where(ScoringCriteria.project_id == project.project_id)
    )

    total_score = 0.0

    # 3. 각 평가 기준별로 점수 계산
    for criteria in scoring_criteria:
        # 3-1. 값 추출
        if criteria.value_source == 'submitted':
            value = application_data.submitted_value
        elif criteria.value_source == 'user_field':
            value = getattr(application.user, criteria.source_field)
        elif criteria.value_source == 'json_field':
            value = json.loads(application_data.submitted_value).get(criteria.source_field)

        # 3-2. 매칭 확인
        matched = False
        score = 0.0

        if criteria.matching_type == 'exact':
            matched = (value == criteria.expected_value)
        elif criteria.matching_type == 'contains':
            matched = (criteria.expected_value in value)
        elif criteria.matching_type == 'range':
            matched = (criteria.min_value <= float(value) <= criteria.max_value)
        elif criteria.matching_type == 'grade':
            # 등급 테이블 조회
            grade_config = json.loads(criteria.grade_config)
            score = grade_config.get(value, 0)
            matched = (score > 0)

        # 3-3. 점수 할당
        if matched:
            if criteria.matching_type != 'grade':
                score = criteria.score

        # 3-4. 집계 방식 적용 (복수 입력 시)
        if criteria.aggregation_mode == 'sum':
            # 모든 매칭된 값의 점수 합산
            total_score += sum(all_matched_scores)
        elif criteria.aggregation_mode == 'max':
            # 가장 높은 점수만
            total_score += max(all_matched_scores) if all_matched_scores else 0
        elif criteria.aggregation_mode == 'count':
            # 매칭된 개수
            total_score += len(all_matched_scores)
        elif criteria.aggregation_mode == 'best_match':
            # 가장 높은 점수 (grade 매칭 시)
            total_score += max(all_matched_scores) if all_matched_scores else 0
        else:  # 'first'
            # 첫 번째만
            total_score += score

    # 4. 응모에 점수 저장
    application.auto_score = total_score
    await db.commit()

    return total_score
```

**예시**:
- **평가 항목**: "코칭 자격증"
- **평가 기준**:
  - KSC = 10점
  - KAC = 8점
  - KPC = 5점
- **코치 입력값**: "KSC"
- **결과**: 10점

### 2. 역량 재사용 로직

**컴포넌트**: `frontend/src/pages/ApplicationSubmitPage.tsx`

**흐름**:
```typescript
// 1. 프로젝트 필요 항목 조회
const { data: projectItems } = await api.get(`/api/projects/${projectId}/items`)

// 2. 내 역량 목록 조회 (확인완료된 것만)
const { data: myCompetencies } = await api.get('/api/competencies?status=approved')

// 3. 항목별 매칭 확인
const reusableCompetencies = projectItems.map(item => {
  return myCompetencies.find(comp =>
    comp.item_id === item.item_id &&
    comp.verification_status === 'approved'
  )
})

// 4. 재사용 버튼 클릭
const handleReuseCompetency = async (itemId, competencyId) => {
  // ApplicationData 생성
  await api.post(`/api/applications/${applicationId}/data`, {
    item_id: itemId,
    competency_id: competencyId,  // 원본 참조
    // value, file_id는 자동으로 복사됨
  })
}

// 5. 새로 입력 시
const handleNewInput = async (itemId, value, fileId) => {
  // ApplicationData 생성
  await api.post(`/api/applications/${applicationId}/data`, {
    item_id: itemId,
    competency_id: null,  // 재사용 아님
    submitted_value: value,
    submitted_file_id: fileId
  })
}
```

**장점**:
- 증빙 파일 재업로드 불필요
- 코치 입력 시간 단축 (클릭 1회)
- 실무자 검토 부담 감소 (이미 확인된 증빙)

### 3. 마감 후 스냅샷 동결

**트리거**: `recruitment_end_date` 경과 후 자동 실행

**동작**:
```python
# backend/app/api/endpoints/applications.py
async def freeze_applications(project_id: int, db: AsyncSession):
    """모집 마감 시 응모 동결"""

    # 1. 해당 프로젝트의 모든 응모 조회
    applications = await db.execute(
        select(Application).where(Application.project_id == project_id)
    )

    for application in applications.scalars():
        if application.status == 'submitted':
            # 2. 응모 동결
            application.is_frozen = True
            application.frozen_at = datetime.now()

            # 3. ApplicationData도 동결 표시
            for data in application.application_data:
                data.is_frozen = True

    await db.commit()
```

**효과**:
- 지원서 내용 변조 방지
- 심사 중 데이터 일관성 보장
- 과거 지원 이력 정확히 보존

---

## 프론트엔드 구조

### 주요 페이지

#### 인증 및 프로필
- `LoginPage.tsx`: 로그인 (JWT 발급)
- `RegisterPage.tsx`: 회원가입
- `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`: 비밀번호 찾기/재설정
- `ProfileEditPage.tsx`: 프로필 수정
- `DetailedProfilePage.tsx`: 상세 프로필 조회

#### 코치 - 역량 관리
- `UnifiedCompetencyPage.tsx`: 통합 역량 관리 (현재 사용)
  - 역량 등록, 조회, 수정, 삭제
  - 검증 상태별 필터
  - 증빙 파일 업로드/다운로드

#### 코치 - 프로젝트 및 응모
- `ProjectBrowsePage.tsx`: 프로젝트 검색/목록
- `ProjectDetailPage.tsx`: 프로젝트 상세
- `ApplicationSubmitPage.tsx`: 응모 작성/수정
  - 기존 역량 재사용 (클릭 1회)
  - 새 역량 입력 + 파일 업로드
  - 임시저장/제출
- `MyApplicationsPage.tsx`: 내 응모 목록
- `CoachDashboard.tsx`: 코치 대시보드
  - 통계 (응모, 선발, 증빙 상태)
  - 최근 활동 (알림 Timeline)

#### 실무자 - 검토
- `StaffDashboard.tsx`: 실무자 대시보드
- `VerificationPage.tsx`: 증빙검토 (응모 서류)
  - PDF 뷰어로 증빙 확인
  - 확인완료/보완 요청
  - ReviewLock 지원 (30분 잠금)

#### 프로젝트 관리자
- `ProjectCreatePage.tsx`: 프로젝트 생성
- `ProjectEditPage.tsx`: 프로젝트 수정
- `ProjectManagePage.tsx`: 프로젝트 관리
- `ProjectApplicationsPage.tsx`: 지원자 목록
- `ProjectReviewPage.tsx`: 심사/평가

#### 관리자
- `AdminDashboard.tsx`: 관리자 대시보드
- `SuperAdminDashboard.tsx`: 슈퍼관리자 대시보드
- `AdminCompetencyItemsPage.tsx`: 역량 항목 관리
- `UserManagementPage.tsx`: 사용자 관리

#### 공통
- `DashboardPage.tsx`: 메인 대시보드 (역할별 분기)
- `AppLayout.tsx`: 공통 레이아웃 (헤더, 사이드바, 알림)

### 상태 관리 (Zustand)

**주요 Store**:

**authStore** (`stores/authStore.ts`):
```typescript
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (roles: string[]) => boolean
  refreshToken: () => Promise<void>
}
```

**useApplicationStore** (`stores/applicationStore.ts`):
```typescript
interface ApplicationState {
  draftData: Record<number, any>  // applicationId → 임시저장 데이터
  saveDraft: (applicationId: number, data: any) => void
  clearDraft: (applicationId: number) => void
}
```

### API 통신 (React Query + Axios)

**Axios 인스턴스**: `services/api.ts`
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request 인터셉터: Authorization 헤더 자동 추가
api.interceptors.request.use(config => {
  const token = authStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response 인터셉터: 401 응답 시 자동 로그아웃
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      authStore.getState().logout()
      message.error('로그인이 만료되었습니다')
    }
    return Promise.reject(error)
  }
)
```

**React Query 사용**:
```typescript
// services/applicationService.ts
export const useApplications = () => {
  return useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data } = await api.get('/api/applications')
      return data
    },
    staleTime: 5 * 60 * 1000,  // 5분 캐시
    cacheTime: 10 * 60 * 1000  // 10분 보관
  })
}

export const useCreateApplication = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ApplicationCreate) => {
      const response = await api.post('/api/applications', data)
      return response.data
    },
    onSuccess: () => {
      // 목록 캐시 무효화
      queryClient.invalidateQueries(['applications'])
      message.success('응모가 저장되었습니다')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '응모 저장 실패')
    }
  })
}
```

---

## 트러블슈팅 가이드

### 1. PostgreSQL Enum 오류

**증상**:
```
sqlalchemy.exc.DataError: (psycopg2.errors.InvalidTextRepresentation)
invalid input value for enum projectstatus: "draft"
```

**원인**:
- Python enum 멤버 이름과 PostgreSQL enum 값 불일치
- SQLAlchemy는 enum 멤버 **이름**(name)을 DB 쿼리에 사용

**진단**:
```bash
# 1. PostgreSQL enum 값 확인
psql $DATABASE_URL -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'projectstatus') ORDER BY enumlabel"

# 2. Python 모델 확인
grep -A 15 "class ProjectStatus" backend/app/models/project.py
```

**해결**:
1. Python 모델 수정:
   ```python
   # backend/app/models/project.py
   class ProjectStatus(str, enum.Enum):
       DRAFT = "DRAFT"  # ✅ 이름과 값 모두 UPPERCASE
       PENDING = "PENDING"
       # ...
   ```

2. start.sh에 enum 값 추가:
   ```bash
   # backend/start.sh (Lines 196-208)
   all_status_values = ['DRAFT', 'PENDING', 'APPROVED', ...]
   for val in all_status_values:
       cur.execute(f"ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS '{val}'")
   ```

3. 재배포:
   ```bash
   git add backend/app/models/project.py backend/start.sh
   git commit -m "Fix: enum case mismatch"
   git push origin main
   ```

### 2. Railway 배포 실패 (환경변수 오류)

**증상**:
```
Error: Invalid value for '--port': '$PORT' is not a valid integer.
```

**원인**:
- railway.json에서 NIXPACKS builder 사용 시 `$PORT` 환경변수 미확장
- Dockerfile CMD가 무시됨

**해결**:
1. railway.json 수정:
   ```json
   {
     "build": {
       "builder": "DOCKERFILE",  // ✅ NIXPACKS → DOCKERFILE
       "dockerfilePath": "Dockerfile"
     }
   }
   ```

2. Procfile 삭제 (충돌 방지):
   ```bash
   rm backend/Procfile
   git commit -am "Remove Procfile"
   ```

3. Dockerfile CMD 확인:
   ```dockerfile
   CMD ["sh", "start.sh"]  # start.sh에서 $PORT 처리
   ```

### 3. 알림이 표시되지 않음

**체크리스트**:

1. **Notification 레코드 생성 확인**:
   ```sql
   SELECT * FROM notifications
   WHERE user_id = {코치_ID}
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. **related_* 컬럼 값 확인**:
   ```sql
   SELECT
     notification_id,
     type,
     title,
     related_application_id,
     related_project_id,
     related_data_id
   FROM notifications
   WHERE type = 'supplement_request';
   ```

3. **Frontend 알림 조회 API 호출 확인**:
   - 브라우저 개발자 도구 → Network 탭
   - `GET /api/notifications?limit=10` 확인

4. **알림 서비스 호출 시 project_name 전달 확인**:
   ```python
   # backend/app/api/endpoints/applications.py:1299
   await send_supplement_request_notification(
       # ...
       project_name=project.project_name if project else None  # ✅ 확인
   )
   ```

### 4. 파일 업로드 실패

**증상**:
- `413 Payload Too Large`: 파일 크기 초과 (10MB 이상)
- `415 Unsupported Media Type`: 실행 파일 업로드 시도

**해결**:

1. **파일 크기 확인**:
   - 현재 제한: 10MB
   - 설정 변경: `backend/app/core/config.py:MAX_FILE_SIZE`

2. **MIME 타입 확인**:
   - 차단 목록: `.exe`, `.bat`, `.sh`, `.ps1` 등
   - 허용 타입: 문서, 이미지, PDF

3. **Backend 로그 확인**:
   ```bash
   railway logs --service backend | grep -i "file"
   ```

### 5. start.sh 실행 실패

**증상**:
```
[WARN] Could not fix columns: connection already closed
```

**원인**:
- DATABASE_URL 형식 오류
- PostgreSQL 연결 실패

**해결**:

1. **DATABASE_URL 형식 확인**:
   ```bash
   # Railway 환경변수
   echo $DATABASE_URL
   # 예상: postgresql+asyncpg://user:password@host:5432/dbname
   ```

2. **start.sh에서 URL 변환 확인**:
   ```python
   # backend/start.sh:15-16
   url = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
   ```

3. **수동 연결 테스트**:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

---

## 개발 가이드라인

### 새 기능 추가 시 체크리스트

#### 1. Backend 변경
- [ ] 모델 변경 시 Alembic 마이그레이션 생성
  ```bash
  cd backend
  alembic revision --autogenerate -m "Add new column"
  ```
- [ ] Enum 추가 시 start.sh에도 반영
  ```bash
  # start.sh에 추가
  cur.execute("ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{new_value}'")
  ```
- [ ] API 엔드포인트 추가 시 권한 체크 (`require_roles`)
- [ ] 비즈니스 로직은 Service로 분리 (scoring_service, notification_service)
- [ ] 에러 처리 (`HTTPException` 사용)

#### 2. Frontend 변경
- [ ] API 호출은 React Query 사용
- [ ] 에러 메시지는 Ant Design `message` API
- [ ] 로딩 상태 표시 (`Spin` 컴포넌트)
- [ ] 권한별 UI 분기 (`authStore.hasRole`)
- [ ] 한국 시간(KST) 표시 (dayjs)

#### 3. 데이터베이스 변경
- [ ] 마이그레이션 파일 생성 후 로컬 테스트
- [ ] Enum 값 추가는 트랜잭션 밖에서 (start.sh)
- [ ] 인덱스 추가 (성능 고려)
- [ ] 외래 키 제약 확인 (`ondelete` 설정)

#### 4. 배포 전 확인
- [ ] 로컬에서 빌드 성공
  ```bash
  # Backend
  docker build -t backend:test backend/

  # Frontend
  cd frontend && npm run build
  ```
- [ ] E2E 테스트 통과 (존재하는 경우)
- [ ] Railway 환경변수 설정 확인
- [ ] start.sh 변경사항 확인

### ARCHITECTURE.md 업데이트 규칙

**다음 경우 반드시 이 문서 업데이트**:

1. **새로운 Enum 타입 추가**
   - "PostgreSQL Enum Types" 섹션에 추가
   - 대소문자 정책 명시

2. **주요 테이블 스키마 변경**
   - "데이터베이스 스키마" 섹션 업데이트
   - 컬럼 추가/삭제 내역

3. **새로운 API 엔드포인트 그룹 추가**
   - "API 엔드포인트 구조" 섹션에 추가
   - 주요 엔드포인트 목록 업데이트

4. **배포 프로세스 변경**
   - "배포 및 인프라" 섹션 업데이트
   - start.sh 주요 변경사항

5. **중요한 버그 해결**
   - "트러블슈팅 가이드" 섹션에 추가
   - 증상, 원인, 해결 방법 기술

6. **새로운 비즈니스 로직 추가**
   - "주요 비즈니스 로직" 섹션에 추가
   - 알고리즘, 흐름 설명

7. **프론트엔드 주요 페이지 추가/변경**
   - "프론트엔드 구조" 섹션 업데이트

8. **알림 시스템 변경**
   - "알림 시스템" 섹션 업데이트
   - 새 알림 유형, 표시 위치 등

**업데이트 방법**:
1. 해당 섹션에 변경사항 추가
2. "변경 이력" 섹션에 날짜 및 내용 기록
3. Git commit 메시지에 `docs: update ARCHITECTURE.md` 명시

**예시**:
```bash
git add ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md - add new notification type"
```

---

## 현재 구현 상태

### ✅ Phase 1 (MVP) - 완료
- [x] 사용자 인증/인가 (JWT, RBAC)
- [x] 역량 항목 마스터 데이터 관리
- [x] 코치 역량 관리 (중앙 DB - 전자지갑)
- [x] 프로젝트 생성/관리
- [x] 프로젝트별 평가 항목 설정
- [x] 지원서 작성 (역량 재사용 포함)
- [x] 증빙서류 검토 (동시 검토 지원)
- [x] 자동 점수 계산 엔진
- [x] 선발 프로세스
- [x] 파일 업로드/다운로드
- [x] 알림 시스템 (과제명 표시, 직접 링크)

### 🚧 Phase 2 - 진행 중
- [x] PostgreSQL Enum 대소문자 이슈 해결 (2026-01-22)
- [x] 알림 시스템 개선 (과제명 표시, 직접 네비게이션) (2026-01-22)
- [ ] 이메일 알림 자동화 (SMTP 설정 필요)
- [ ] Excel 업로드/다운로드 (대량 데이터 처리)
- [ ] 6개월 주기 정보 업데이트 리마인드
- [ ] 고급 통계/리포트 대시보드

### 🔮 Phase 3 - 계획 중
- [ ] 본인인증 연동
- [ ] 모바일 앱 (React Native)
- [ ] 실시간 알림 (WebSocket)
- [ ] 다국어 지원 (i18n)

### ⚠️ 개선 필요
- [ ] 에러 핸들링 표준화 (전역 에러 핸들러 개선)
- [ ] 프론트엔드 성능 최적화 (코드 스플리팅, lazy loading)
- [ ] API 응답 캐싱 개선 (React Query 설정)
- [ ] 테스트 커버리지 확대 (단위 테스트 추가)
- [ ] 로깅 및 모니터링 (Sentry, CloudWatch 등)
- [ ] Redis 캐싱 활성화 (현재 미사용)

---

## 변경 이력

### 2026-01-23
- **서비스 공식 명칭 변경**
  - 기존: PPMS (Project & coach Profile Management System)
  - 변경: **PCMS (Project & Coach pool Management System)**
  - 영향 범위:
    - Frontend: AppLayout, LoginPage, RegisterPage, AdminDashboard, CoachDashboard, DashboardPage
    - Backend: Email template (base.html)
    - E2E Tests: dashboard.spec.ts
    - Documentation: ARCHITECTURE.md

- **과제 생성 페이지 개선**
  - 페이지 진입 시 안내 팝업 추가
  - 내용: "과제정보, 설문항목(100점 배점), 심사계획(심사위원지정 포함) 이 완료되어야 과제를 상신할 수 있습니다. 이를 관리자가 승인하고 모집기간이 도래하면 응모코치들께 과제가 노출됩니다."
  - 사용자 경험 개선: 과제 생성 프로세스에 대한 명확한 안내 제공

- **display_status 대소문자 정규화 수정 (CRITICAL)**
  - 문제: 테스트 과제 생성 후 "과제심사" 페이지에서 "심사하기" 버튼이 비활성화 상태
  - 원인: Backend와 Frontend 간 enum 케이스 불일치
    - Backend: `ProjectStatus.REVIEWING = "REVIEWING"` (대문자)
    - Frontend: `status === 'reviewing'` (소문자 기대)
    - `calculate_display_status()` 함수가 `status.value` 직접 반환 (대문자)
    - 버튼 활성화 조건: `display_status === 'reviewing'` 체크 실패
  - 해결: `backend/app/schemas/project.py` (line 34, 43)
    - 모든 display_status 반환값을 `.lower()`로 정규화
    - `return status.value.lower()  # ✅ Always return lowercase`
  - 효과: 모든 프로젝트 상태가 frontend와 일관되게 소문자로 표시, 심사하기 버튼 정상 활성화
  - 관련 커밋: cb2a6c1, 02b6a4a (기존 enum 케이스 수정 작업의 연장)

- **과제 생성 로깅 추가 (OPTIONAL)**
  - 배경: "재사용테스트1_TIMESTAMP" 형태 과제들의 출처 불명 (실제로는 수동 생성)
  - 목적: 향후 유사 상황 발생 시 추적 가능하도록 로깅 강화
  - 변경: `backend/app/api/endpoints/projects.py`
    - 3개 프로젝트 생성 엔드포인트에 로깅 추가
    - `POST /projects` (일반 생성, line 706-707)
    - `POST /projects/create-test` (테스트 과제, line 193)
    - `POST /projects/create-test-with-applications` (응모완료 테스트, line 602)
  - 로그 형식: `[PROJECT_CREATE] name='{name}', id={id}, creator={email}, status={status}, endpoint='{endpoint}'`
  - 효과: 모든 과제 생성 이벤트 추적 가능

- **증빙 검증 중복 키 에러 수정**
  - 문제: 보완필요 처리 후 재컨펌 시 `duplicate key value violates unique constraint "uq_competency_verifier"` 에러 발생
  - 원인: `verification_records` 테이블의 (competency_id, verifier_id) unique constraint
    - Reset/보완필요 처리 시 기존 레코드의 `is_valid`를 False로 변경 (삭제하지 않음)
    - 재컨펌 시 is_valid=True인 레코드만 확인하여 기존 레코드 존재를 감지하지 못함
    - 새 레코드 INSERT 시도 → unique constraint 위반
  - 해결: 컨펌 엔드포인트 로직 개선 (`backend/app/api/endpoints/verifications.py:357-406`)
    - is_valid 조건 없이 (competency_id, verifier_id) 조합으로 기존 레코드 확인
    - 기존 레코드가 있고 is_valid=True → 이미 컨펌했다고 에러
    - 기존 레코드가 있고 is_valid=False → UPDATE (is_valid=True, verified_at 갱신)
    - 기존 레코드가 없음 → INSERT
  - 효과: 보완필요 후 재컨펌 시 정상 동작, 중복 레코드 생성 방지

### 2026-01-22
- **ARCHITECTURE.md 대폭 확장** (Claude Sonnet 4.5)
  - 목차 추가 (13개 주요 섹션)
  - 기술 스택 섹션 추가 (Backend, Frontend, Deployment 상세)
  - Database Schema 섹션 추가 (테이블 구조, enum 타입)
  - PostgreSQL Enum Critical Issue 섹션 추가 (대소문자 정책, 트러블슈팅)
  - Notification System Architecture 섹션 추가 (유형, 생성 흐름, 표시 위치, 최근 개선사항)
  - API Endpoints Overview 추가 (12개 주요 엔드포인트 그룹)
  - Project Lifecycle 상태 전이도 추가 (9개 상태, 권한 및 제약사항)
  - 응모 및 검토 프로세스 상세 설명 (흐름도, ReviewLock)
  - Railway 배포 구조 및 start.sh 역할 설명 (enum 값 추가, 데이터 변환)
  - 주요 비즈니스 로직 설명 (자동 점수 계산, 역량 재사용, 스냅샷 동결)
  - 프론트엔드 구조 및 상태 관리 (Zustand, React Query + Axios)
  - 트러블슈팅 가이드 추가 (5개 주요 이슈 해결 방법)
  - 개발 가이드라인 및 문서 업데이트 규칙 추가
  - 전체 약 1800줄 (기존 662줄 → 3배 확장)

- **알림 시스템 개선** (Commit: 4cdcec0)
  - 알림 제목에 과제명 표시: `[{project_name}] 서류 보충이 필요합니다: {item_name}`
  - 알림 클릭 시 직접 응모서류 수정 화면으로 이동
  - 3개 UI 표시 위치 모두 업데이트: AppLayout, CoachDashboard, DashboardPage
  - 사용자 경험 개선: 클릭 3+ 회 → 1회로 단축
  - 하위 호환성: project_name 없는 기존 알림도 정상 동작

- **PostgreSQL Enum 대소문자 이슈 해결** (Commits: cb2a6c1, 02b6a4a, 4532831, f27d89d, e1a4e6a)
  - Python enum 멤버 이름을 UPPERCASE로 변경 (ProjectStatus.DRAFT 등)
  - start.sh에서 소문자/대문자 enum 값 모두 추가 후 변환
  - database.py init_db() 데이터 변환 로직 추가
  - 500 Internal Server Error 해결 (`invalid input value for enum projectstatus: "draft"`)
  - 하위 호환성: 소문자 enum 값도 추가 (기존 데이터 보호)

- **Railway 배포 설정 수정**
  - railway.json builder를 DOCKERFILE로 변경 (NIXPACKS → DOCKERFILE)
  - Procfile 삭제 (충돌 방지)
  - $PORT 환경변수 처리 문제 해결 (`Invalid value for '--port': '$PORT'`)

### 2025-01-22
- ARCHITECTURE.md 최초 작성 (662줄 기본 구조)

### 2026-01-23
- **심사개시(Start Review) 기능 추가**
  - 기능 개요: 서류검토 완료 후 심사 단계 진입 기능
  - DB 변경:
    - `applications.document_status`: 서류검토 상태 (pending, in_review, supplement_requested, approved, disqualified)
    - `applications.document_disqualification_reason`: 서류탈락 사유
    - `applications.document_disqualified_at`: 서류탈락 시점
    - `projects.review_started_at`: 심사개시 시점
  - API 추가:
    - `GET /api/projects/{id}/preview-start-review`: 심사개시 미리보기 (서류탈락 대상 목록 조회)
    - `POST /api/projects/{id}/start-review`: 심사개시 (보완 제출 차단, 미완료 건 서류탈락 처리)
  - 프론트엔드 변경:
    - `ProjectReviewPage.tsx`: 심사개시 버튼 및 확인 모달 추가
    - 응모자 목록에 '서류상태' 컬럼 추가
  - 프로세스:
    1. REVIEWING 상태에서 과제관리자가 "심사개시" 버튼 클릭
    2. 미리보기에서 서류완료/서류탈락 예정 목록 확인
    3. 확인 후 심사개시 실행
    4. 심사개시 이후: 보완 제출 차단, 미완료 건 자동 서류탈락
    5. 심사자는 서류완료 응모건만 평가 가능

---

## 참고 문서

- **개발 작업 규칙**: `CLAUDE.md` (루트 및 PCMS 폴더)
- **사용자 매뉴얼**:
  - `docs/USER_MANUAL.md`
  - `docs/증빙검토 → 심사 → 최종 선발 프로세스 테스트.md`
- **환경 변수**: `backend/.env.example`
- **마이그레이션 이력**: `backend/alembic/versions/`
- **배포 스크립트**: `backend/start.sh`
- **Railway 설정**: `backend/railway.json`, `frontend/railway.json`

---

**Last Updated**: 2026-01-23 by Claude Opus 4.5

**Document Version**: 2.2 (Start Review feature added)
