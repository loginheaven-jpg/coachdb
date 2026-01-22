# ARCHITECTURE.md

프로젝트의 아키텍처, 설계 원칙, 도메인 모델에 대한 상세 문서

---

## 프로젝트 개요

### 기본 정보
- **프로젝트명**: PCMS (Professional Coach Management System)
- **부제**: 코치 역량 데이터베이스 및 프로젝트 매칭 시스템
- **한 줄 요약**: 코치의 역량을 중앙 DB에 저장하고, 프로젝트 지원 시 재사용할 수 있는 "전자지갑" 시스템
- **주요 사용자**:
  - **코치 (COACH)**: 역량 관리, 프로젝트 지원
  - **실무자 (STAFF/VERIFIER)**: 증빙서류 검토 및 검증
  - **평가자 (REVIEWER)**: 코치 평가 및 심사
  - **프로젝트 관리자 (PROJECT_MANAGER)**: 프로젝트 생성, 평가 기준 설정
  - **시스템 관리자 (SUPER_ADMIN)**: 시스템 설정, 역량 항목 정의

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
- **Business**: 비즈니스 로직, 점수 계산, 검증 규칙
- **Data Access**: DB 쿼리, 트랜잭션 관리
- **Database**: 데이터 저장 및 무결성 보장

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
- `TEXT`: 단순 텍스트
- `SELECT`: 단일 선택
- `MULTISELECT`: 다중 선택
- `TEXT_FILE`: 텍스트 + 파일 (자격증, 경험)
- `DEGREE`: 학위 (선택 + 텍스트 + 파일)
- `COACHING_HISTORY`: 코칭 분야 이력 + 증빙
- `COACHING_TIME`: 코칭시간 (내용 + 연도 + 시간 + 증빙)

**설계 의도**:
- 유연성: 새로운 역량 항목을 코드 수정 없이 추가
- 일관성: 모든 프로젝트에서 동일한 역량 항목 정의 공유
- 확장성: 템플릿 추가로 다양한 입력 형태 지원

#### 2.3. 점수 계산 엔진 (Scoring Engine)

**ScoringCriteria + Matching Types**
- 프로젝트별 평가 기준 설정
- 다양한 매칭 방식 지원:
  - `EXACT`: 정확히 일치 (예: "KSC" → 10점)
  - `CONTAINS`: 포함 여부 (예: "진로" 포함 → 5점)
  - `RANGE`: 숫자 범위 (예: 1000 이상 → 10점)
  - `GRADE`: 등급별 점수 (예: KSC=10, KAC=8, KPC=5)

**집계 방식** (`AggregationMode`):
- `FIRST`: 첫 번째만 (기본값)
- `SUM`: 합산 (코칭 시간 등)
- `MAX`: 최대값
- `COUNT`: 개수
- `ANY_MATCH`: 하나라도 매칭
- `BEST_MATCH`: 가장 높은 점수

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
- `SUPER_ADMIN`: 시스템 전체 관리, 역량 항목 정의
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

## 도메인 모델 상세

### 1. User (사용자)

**주요 필드**:
- `user_id`: BigInteger (Primary Key)
- `email`: 이메일 (Unique, 로그인 ID)
- `hashed_password`: bcrypt 해시
- `roles`: JSON 배열 (복수 역할)
- `status`: `active` / `deleted`
- `address`: 거주지 (필수)
- `in_person_coaching_area`: 대면 코칭 가능 지역 (선택)
- `coach_certification_number`: 최상위 자격 (예: KSC, KAC)
- `coaching_fields`: 코칭 전문 분야 (JSON 배열)

**비즈니스 규칙**:
- 이메일 중복 불가 (Unique 제약)
- 탈퇴 시 `status=deleted`, 데이터는 익명화하여 보존
- `roles`는 배열로 저장, 복수 역할 가능
- 코치는 기본 정보 외에 `CoachProfile` 테이블에 상세 정보 보관

### 2. CompetencyItem (역량 항목 마스터)

**주요 필드**:
- `item_id`: Integer (Primary Key)
- `item_code`: 항목 코드 (Unique, 예: "KCA_CERT", "COACHING_TIME")
- `item_name`: 항목명
- `category`: 카테고리 (CERTIFICATION, EDUCATION, EXPERIENCE 등)
- `template`: 템플릿 유형
- `is_repeatable`: 반복 입력 가능 여부
- `max_entries`: 최대 입력 개수 (null = 무제한)
- `is_custom`: 커스텀 항목 여부
- `is_active`: 활성 여부

**관계**:
- `fields`: `CompetencyItemField` (1:N) - 템플릿 필드 정의
- `project_items`: `ProjectItem` (1:N) - 프로젝트별 사용
- `coach_competencies`: `CoachCompetency` (1:N) - 코치별 입력값

**비즈니스 규칙**:
- `item_code`는 Unique (시스템 전체에서 유일)
- `is_custom=true`인 경우 프로젝트 관리자가 생성한 커스텀 항목
- 비활성화(`is_active=false`)해도 기존 데이터는 유지 (삭제 불가)

### 3. CoachCompetency (중앙 DB - 전자지갑)

**주요 필드**:
- `competency_id`: BigInteger (Primary Key)
- `user_id`: 코치 ID
- `item_id`: 역량 항목 ID
- `value`: 입력값 (JSON 또는 텍스트)
- `file_id`: 증빙 파일 ID
- `verification_status`: 검증 상태
  - `pending`: 검토 대기
  - `approved`: 확인완료
  - `rejected`: 반려
  - `supplemented`: 보완 제출됨
- `verified_by`: 검증자 ID
- `verified_at`: 검증 완료 시각
- `rejection_reason`: 보완 사유
- `is_globally_verified`: 전역 검증 완료 여부
- `is_anonymized`: 익명화 여부 (탈퇴 시)

**비즈니스 규칙**:
- 동일 코치의 동일 항목에 대해 반복 입력 가능 (is_repeatable=true인 경우)
- `approved` 상태 역량만 재사용 가능
- 탈퇴 시 `is_anonymized=true`, 데이터는 보존 (통계/연구용)
- 전역 검증 시스템: 복수 Verifier 확인 → `is_globally_verified=true`

### 4. Project (프로젝트/모집 공고)

**주요 필드**:
- `project_id`: Integer (Primary Key)
- `project_name`: 프로젝트명
- `project_type`: 과제 구분 (공익코칭, 비즈니스코칭 등)
- `status`: 프로젝트 상태 (enum)
- `recruitment_start_date` / `recruitment_end_date`: 모집 기간
- `project_start_date` / `project_end_date`: 과제 기간 (계획)
- `actual_start_date` / `actual_end_date`: 실제 진행 기간
- `max_participants`: 모집 인원
- `quantitative_weight` / `qualitative_weight`: 정량/정성 평가 가중치
- `created_by`: 생성자
- `project_manager_id`: 과제 관리자

**상태 전이** (`ProjectStatus`):
```
draft (초안)
  ↓ 상신
pending (승인대기)
  ↓ SUPER_ADMIN 승인
approved (승인완료)
  ↓ 모집 시작
ready (모집 개시)
  ↓ 심사 시작
reviewing (심사중)
  ↓ 선발 완료
in_progress (과제 진행중)
  ↓ 과제 종료
evaluating (과제 평가중)
  ↓ 평가 완료
closed (종료)
```

**비즈니스 규칙**:
- `draft` 상태에서만 수정 가능
- `pending` 상태에서 SUPER_ADMIN만 승인/반려 가능
- `ready` 이후에는 모집 기간/평가 기준 변경 불가
- 모집 마감 (`recruitment_end_date` 경과) 후 자동으로 스냅샷 동결

### 5. Application (지원서)

**주요 필드**:
- `application_id`: BigInteger (Primary Key)
- `project_id`: 프로젝트 ID
- `user_id`: 코치 ID
- `status`: 지원서 상태
  - `draft`: 임시저장
  - `submitted`: 제출완료
  - `reviewing`: 검토중
  - `completed`: 검토완료
- `motivation`: 지원 동기 및 기여점 (자유 서술)
- `applied_role`: 신청 역할 (리더, 참여, 수퍼비전)
- `auto_score`: 자동 계산 점수 (정량 평가)
- `final_score`: 최종 점수 (정량 + 정성)
- `score_visibility`: 점수 공개 여부 (기본: `admin_only`)
- `can_submit`: 제출 가능 여부 (필수 증빙 모두 첨부 시 `true`)
- `selection_result`: 선발 결과 (`pending`, `selected`, `rejected`)
- `is_frozen`: 마감 후 동결 여부
- `frozen_at`: 동결 시각

**관계**:
- `application_data`: `ApplicationData` (1:N) - 항목별 데이터
- `custom_question_answers`: `CustomQuestionAnswer` (1:N) - 커스텀 질문 답변
- `reviewer_evaluations`: `ReviewerEvaluation` (1:N) - 정성 평가

**비즈니스 규칙**:
- 동일 프로젝트에 중복 지원 불가 (`uq_project_user` Unique 제약)
- 필수 증빙 미첨부 시 제출 불가 (`can_submit=false`)
- 점수는 코치에게 비공개 (`score_visibility=admin_only`)
- 마감 후 자동 동결 (`is_frozen=true`), 이후 수정 불가

### 6. ApplicationData (지원서 항목별 데이터 - 스냅샷)

**주요 필드**:
- `data_id`: BigInteger (Primary Key)
- `application_id`: 지원서 ID
- `item_id`: 역량 항목 ID
- `competency_id`: 재사용한 원본 역량 ID (선택)
- `submitted_value`: 제출값 (JSON 또는 텍스트)
- `submitted_file_id`: 제출 파일 ID
- `verification_status`: 검증 상태
- `item_score`: 항목별 점수
- `reviewed_by`: 검토자 ID
- `reviewed_at`: 검토 완료 시각
- `rejection_reason`: 보완 사유
- `supplement_deadline`: 보완 기한
- `supplement_requested_at`: 보완 요청일

**비즈니스 규칙**:
- `competency_id`가 있으면 재사용 (CoachCompetency 참조)
- `competency_id`가 없으면 새로 입력
- 검증 완료 후 `item_score` 자동 계산
- 보완 요청 시 모집 마감 전까지만 수정 가능

### 7. File (증빙 파일)

**주요 필드**:
- `file_id`: BigInteger (Primary Key)
- `filename`: 원본 파일명
- `file_path`: 저장 경로
- `file_size`: 파일 크기 (bytes)
- `mime_type`: MIME 타입
- `uploader_id`: 업로더 ID
- `uploaded_at`: 업로드 시각
- `is_archived`: 아카이빙 여부

**비즈니스 규칙**:
- 파일은 삭제하지 않고 보관 (참조 무결성)
- 5년 후 자동 아카이빙 (`is_archived=true`)
- 실행 파일 업로드 차단 (보안)
- 최대 10MB 제한 (설정 가능)

---

## 주요 기능

### 1. 코치 - 역량 관리 (전자지갑)
- **역량 입력**: 역량 항목별 값 입력 + 증빙 파일 업로드
- **역량 조회**: 내 역량 목록 (검증 상태별 필터)
- **역량 수정**: `pending`, `rejected` 상태에서만 수정 가능
- **검증 상태 확인**: 실무자 검토 진행 상황 확인
- **보완 대응**: 보완 요청 시 사유 확인 및 재제출

**구현 위치**:
- Frontend: `UnifiedCompetencyPage.tsx`
- Backend: `api/endpoints/competencies.py`
- Service: 없음 (엔드포인트에서 직접 처리)

### 2. 코치 - 프로젝트 지원
- **프로젝트 검색**: 모집 중인 프로젝트 목록 조회
- **지원서 작성**:
  - 프로젝트별 평가 항목 확인
  - 기존 확인완료 역량 재사용 (클릭 한 번)
  - 새로운 역량 입력 + 증빙 업로드
  - 지원 동기, 신청 역할 입력
- **임시저장**: 필수 항목 미완성 시 임시저장
- **제출**: 모든 필수 증빙 첨부 후 제출 가능
- **지원 현황**: 내 지원서 목록, 검토 진행 상황

**구현 위치**:
- Frontend: `ApplicationSubmitPage.tsx`, `MyApplicationsPage.tsx`
- Backend: `api/endpoints/applications.py`
- Service: 없음

### 3. 실무자 - 증빙서류 검토
- **검토 대기 목록**: 제출된 지원서 목록
- **항목별 검토**:
  - PDF 뷰어로 증빙 확인
  - 확인완료 / 보완필요 선택
  - 보완 사유 입력 (보완필요 시)
- **동시 검토 지원**:
  - 항목별 잠금 (30분)
  - 다른 실무자 검토 중 표시
- **검토 이력**: 누가 언제 무엇을 검토했는지 기록

**구현 위치**:
- Frontend: `StaffDashboard.tsx`, `VerificationPage.tsx`
- Backend: `api/endpoints/verifications.py`
- Service: 없음

### 4. 프로젝트 관리자 - 프로젝트 생성/관리
- **프로젝트 생성**:
  - 기본 정보 입력 (프로젝트명, 모집 기간, 인원 등)
  - 수집 항목 선택 (기존 역량 항목 또는 커스텀)
  - 평가 기준 설정 (항목별 배점, 매칭 조건)
  - 커스텀 질문 추가
- **프로젝트 수정**: `draft` 상태에서만 가능
- **상태 관리**: draft → 상신 → 승인 대기
- **실무자 배정**: 검토 담당 실무자 지정
- **지원자 관리**: 지원자 목록, 점수 확인

**구현 위치**:
- Frontend: `ProjectCreatePage.tsx`, `ProjectEditPage.tsx`, `ProjectManagePage.tsx`
- Backend: `api/endpoints/projects.py`
- Service: 없음

### 5. 시스템 관리자 - 역량 항목 관리
- **역량 항목 정의**:
  - 항목 코드, 이름, 카테고리 설정
  - 템플릿 선택
  - 필드 정의 (텍스트, 선택, 파일 등)
  - 반복 입력 허용 여부
- **항목 활성화/비활성화**: `is_active` 토글
- **글로벌 검증 관리**: 전역 검증 시스템 설정

**구현 위치**:
- Frontend: `AdminCompetencyItemsPage.tsx`, `AdminDashboard.tsx`
- Backend: `api/endpoints/admin.py`
- Service: 없음

### 6. 평가 및 선발
- **자동 점수 계산**:
  - 증빙 확인 완료 후 자동 계산
  - 매칭 조건에 따라 점수 부여
  - 집계 방식 적용 (SUM, MAX, COUNT 등)
- **정성 평가**:
  - 평가자가 지원자별 정성 점수 입력
  - 평가 코멘트 작성
- **최종 점수 산출**:
  - (정량 점수 × 정량 가중치) + (정성 점수 × 정성 가중치)
  - 점수 순 정렬
- **선발 결정**:
  - 상위 N명 선발
  - 선발 결과 통보

**구현 위치**:
- Frontend: `ProjectReviewPage.tsx`, `EvaluationDashboard.tsx`
- Backend: `api/endpoints/scoring.py`
- Service: `services/scoring_service.py`

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

### 🚧 Phase 2 - 계획 중
- [ ] 보완 통지 자동화 (이메일/SMS)
- [ ] Excel 업로드/다운로드 (대량 데이터 처리)
- [ ] 6개월 주기 정보 업데이트 리마인드
- [ ] 고급 통계/리포트 대시보드
- [ ] 본인인증 연동
- [ ] 모바일 앱 (React Native)

### ⚠️ 개선 필요
- [ ] 에러 핸들링 표준화 (전역 에러 핸들러 개선)
- [ ] 프론트엔드 성능 최적화 (코드 스플리팅, lazy loading)
- [ ] API 응답 캐싱 (React Query 설정 개선)
- [ ] 테스트 커버리지 확대 (현재 E2E 테스트만 존재)
- [ ] 로깅 및 모니터링 (Sentry, CloudWatch 등)

---

## 설계 규칙 및 컨벤션

### 1. 네이밍 규칙

#### Backend (Python)
- **모델**: PascalCase, 단수형 (예: `User`, `CoachCompetency`)
- **테이블명**: snake_case, 복수형 (예: `users`, `coach_competencies`)
- **변수/함수**: snake_case (예: `get_current_user`, `auto_score`)
- **상수**: UPPER_SNAKE_CASE (예: `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Enum**: PascalCase 클래스, UPPER_CASE 값 (예: `UserRole.SUPER_ADMIN`)
  - 단, PostgreSQL enum은 소문자 (예: `projectstatus.draft`)

#### Frontend (TypeScript)
- **컴포넌트**: PascalCase (예: `ApplicationSubmitPage`, `ProtectedRoute`)
- **함수**: camelCase (예: `handleSubmit`, `fetchProjects`)
- **변수**: camelCase (예: `userId`, `autoScore`)
- **상수**: UPPER_SNAKE_CASE (예: `API_BASE_URL`)
- **타입/인터페이스**: PascalCase (예: `User`, `Application`)
- **파일명**: PascalCase for components, camelCase for utils (예: `LoginPage.tsx`, `authService.ts`)

### 2. 코드 스타일

#### Backend
- **Linter**: 없음 (추가 권장: flake8, black)
- **Docstring**: Google 스타일 (함수/클래스 설명)
- **Import 순서**:
  1. 표준 라이브러리
  2. 외부 라이브러리
  3. 내부 모듈 (`app.*`)

#### Frontend
- **Linter**: ESLint
- **Formatter**: (없음, Prettier 추가 권장)
- **Import 순서**:
  1. React 관련
  2. 외부 라이브러리
  3. 내부 모듈 (`@/...`)
  4. 타입 import (마지막)

### 3. Git 브랜치 전략

- **main**: 프로덕션 배포 가능 상태 (항상 안정)
- **feature/***: 기능 개발 (예: `feature/add-email-notification`)
- **fix/***: 버그 수정 (예: `fix/scoring-calculation`)
- **hotfix/***: 긴급 수정 (프로덕션 버그)

**커밋 메시지**:
- 접두사 사용: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `style:`
- 예: `feat: add email notification for supplement requests`
- Claude 작업 시 Co-Authored-By 추가

### 4. 테스트 전략

#### E2E 테스트 (Playwright)
- 주요 사용자 플로우 커버 (인증, 지원서 작성, 검토 등)
- 역할별 시나리오 테스트
- 현재 위치: `tests/*.spec.ts`

#### 단위 테스트 (미구현)
- 중요 비즈니스 로직 (점수 계산, 검증 규칙 등)
- 권장 도구: pytest (Backend), Vitest (Frontend)

### 5. 에러 핸들링

#### Backend
- `HTTPException` 사용 (FastAPI 표준)
- 전역 에러 핸들러: `app/main.py:global_exception_handler`
- 상태 코드:
  - `400`: 잘못된 요청 (검증 실패)
  - `401`: 인증 실패
  - `403`: 권한 없음
  - `404`: 리소스 없음
  - `500`: 서버 오류

#### Frontend
- Axios 인터셉터: `services/api.ts`
- 401 응답 시 자동 로그아웃
- 사용자 친화적 메시지 표시 (Ant Design `message` API)

### 6. 데이터베이스 마이그레이션

- **도구**: Alembic
- **위치**: `backend/alembic/versions/`
- **파일명 규칙**: `YYYY_MM_DD_HHMM-{hash}_{description}.py`
- **마이그레이션 생성**: `alembic revision --autogenerate -m "description"`
- **적용**: 앱 시작 시 자동 실행 (`init_db()`)

**주의사항**:
- Enum 값 추가는 트랜잭션 밖에서 실행 (`database.py:init_db()`)
- Enum 이름과 PostgreSQL 값 매칭 확인 (대소문자)
- `down()` 함수도 작성 (롤백 가능하도록)

---

## 보안 및 데이터 관리

### 1. 개인정보 보호
- **마스킹**: 비관리자에게 개인정보 마스킹 (예: 홍*동, abc***@email.com)
- **익명화**: 탈퇴 시 `name`, `email` 익명화, `user_id` 유지
- **접근 제어**: 본인 데이터만 조회 가능 (관리자 제외)

### 2. 데이터 보관 정책
- **역량 데이터**: 영구 보관 (탈퇴자 포함, 익명화)
- **증빙 파일**: 5년 보관 후 아카이빙
- **지원서**: 영구 보관 (통계/연구용)
- **감사 로그**: 3년 보관 후 삭제 (미구현)

### 3. 파일 스토리지
- **현재**: 로컬 파일 시스템 (`./uploads`)
- **계획**: Cloudflare R2 (S3 호환) 또는 MinIO
- **백업**: (미구현, 추가 필요)

### 4. CORS 정책
- 허용 Origin: 프론트엔드 도메인만 명시
- Credentials: `true` (쿠키/헤더 포함)
- 와일드카드(`*`) 사용 금지

---

## 성능 최적화

### 1. 데이터베이스 최적화
- **인덱스**:
  - `users.email` (Unique Index)
  - `coach_competencies.user_id` (Foreign Key Index)
  - `applications.project_id, user_id` (Composite Index)
- **Connection Pool**:
  - `pool_size=10`, `max_overflow=20`
  - `pool_pre_ping=True` (연결 유효성 확인)
- **쿼리 최적화**:
  - Eager loading (`selectinload`, `joinedload`)
  - N+1 쿼리 방지

### 2. 프론트엔드 최적화
- **코드 스플리팅**: (미구현, Vite lazy loading 권장)
- **캐싱**: React Query (기본 5분 캐시)
- **이미지 최적화**: (미구현, WebP 변환 권장)

### 3. 캐싱 전략
- **Redis**: (설정되어 있으나 미사용)
- **계획**:
  - 역량 항목 마스터 데이터 캐싱
  - 프로젝트 목록 캐싱 (5분)
  - 사용자 권한 캐싱

---

## 배포 및 인프라

### 현재 배포 환경
- **Backend**: Railway (FastAPI)
- **Frontend**: Railway (정적 파일 서빙)
- **Database**: Railway PostgreSQL
- **Redis**: Railway Redis (미사용)

### 환경 변수
- Backend `.env` 필수:
  - `DATABASE_URL`: PostgreSQL 연결 문자열
  - `SECRET_KEY`: JWT 서명 키 (32자 이상)
  - `BACKEND_CORS_ORIGINS`: 프론트엔드 URL

### CI/CD
- **현재**: 수동 배포 (Git push → Railway 자동 감지)
- **계획**: GitHub Actions (테스트 자동 실행)

---

## 참고 문서

- **상세 설계서**: `coach_db_service_final_v3.md`
- **개발 가이드**: `CLAUDE.md`
- **환경 변수**: `backend/.env.example`
- **마이그레이션 이력**: `backend/alembic/versions/`

---

## 변경 이력

- 2025-01-22: ARCHITECTURE.md 최초 작성
