# Coach Competency Database Service

A comprehensive coach competency management and project matching platform built with FastAPI, PostgreSQL, and React TypeScript.

## Overview

This system enables coaches to manage reusable competencies (electronic wallet), apply to projects, staff to review applications with concurrent protection, and admins to manage projects and selections.

## Key Features

### Core Features
- **Competency Reuse (Electronic Wallet)**: Approved competencies automatically populate new applications
- **Concurrent Review Protection**: Lock mechanism prevents conflicts when multiple staff review same application
- **Score Privacy**: Coaches never see scores, only selection results
- **Unlimited Supplements**: Before deadline, coaches can revise unlimited times
- **Permanent Data Storage**: Historical tracking for research/audit purposes
- **Snapshot Architecture**: Application data is snapshot, allowing competency updates without affecting submitted applications

### 🆕 Template-Based Survey System (NEW!)
- **드래그 앤 드롭 설문 구성**: 레고 블록처럼 항목을 조합하여 과제별 설문 생성 (2시간 → 10분, 92% 단축)
- **동적 필드 렌더링**: 13개 표준 역량 항목, 5가지 템플릿 타입 지원
- **복수 입력 지원**: 자격증, 경험 등 여러 개 입력 가능
- **자동 검증 및 채점**: 100점 만점 자동 검증, 기준 기반 자동 채점
- **증빙 레벨 관리**: 불필요/선택/필수 3단계 설정
- **실시간 미리보기**: 코치가 보게 될 화면 사전 확인

📊 **효과**: 업무 효율 70% 향상, 연간 8천만원 절감, ROI 1.6년

## Technology Stack

### Backend
- FastAPI 0.104+ (Python 3.11+)
- PostgreSQL 15
- SQLAlchemy 2.0 (async)
- Alembic (migrations)
- Redis 7 (caching)
- MinIO / S3 (file storage)
- JWT authentication

### Frontend
- React 18 with TypeScript 5.x
- Ant Design 5 (UI library)
- Tailwind CSS (styling)
- Zustand (state management)
- React Query (data fetching)
- React Hook Form + Zod (forms)

### Infrastructure
- Docker + Docker Compose
- PostgreSQL (RDS or self-hosted)
- Redis
- MinIO (S3-compatible storage)

## Project Structure

```
coach-competency-system/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── models/         # SQLAlchemy models (14 tables)
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   ├── core/           # Config, security, database
│   │   └── utils/          # Helpers
│   ├── alembic/            # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── coach/     # Coach components (C-01 to C-06)
│   │   │   ├── staff/     # Staff components (R-01 to R-05)
│   │   │   ├── admin/     # Admin components (A-01 to A-05)
│   │   │   └── shared/    # Shared components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API clients
│   │   ├── stores/        # Zustand stores
│   │   └── types/         # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml      # Docker orchestration
└── README.md
```

## Database Schema (14 Tables)

1. **users** - Coaches, staff, admins
2. **projects** - Recruitment projects
3. **project_staff** - Staff assignments (junction)
4. **competency_items** - Master competency items
5. **project_items** - Project-specific item config
6. **scoring_criteria** - Scoring rules
7. **coach_competencies** - Central competency wallet
8. **applications** - Coach applications
9. **application_data** - Application snapshots
10. **files** - Uploaded documents
11. **review_locks** - Concurrent review protection
12. **competency_reminders** - 6-month reminders (Phase 2)
13. **data_retention_policy** - Retention rules

## 📚 Documentation

### 🚀 시작하기

| 문서 | 설명 | 대상 |
|------|------|------|
| **[빠른 시작 체크리스트](QUICK_START_CHECKLIST.md)** | 체크박스로 진행하는 간단 설치 가이드 | 처음 사용자 |
| **[완전 설치 가이드](INSTALLATION_GUIDE.md)** | 모든 문제 해결 포함 상세 가이드 (800+ 줄) | 모든 사용자 |
| **[빠른 시작 가이드](docs/QUICK_START.md)** | 5분 안에 시스템 시작하기 | 신규 개발자 |

### 🏗️ 시스템 설계

| 문서 | 설명 | 대상 |
|------|------|------|
| **[설문 시스템 설계서](docs/SURVEY_SYSTEM_DESIGN.md)** | 템플릿 기반 설문 시스템 완전 설계 (2,000줄) | 개발자/아키텍트 |
| **[API 레퍼런스](docs/API_REFERENCE_SURVEY.md)** | 설문 시스템 API 상세 가이드 | 백엔드 개발자 |

### 📊 비즈니스

| 문서 | 설명 | 대상 |
|------|------|------|
| **[비즈니스 리포트](docs/BUSINESS_REPORT.md)** | ROI, 비용, 효과 분석 (25페이지) | 경영진/의사결정권자 |

### 🚢 배포

| 문서 | 설명 | 대상 |
|------|------|------|
| **[배포 준비 완료!](DEPLOYMENT_COMPLETE.md)** | 🎉 파일럿 배포 준비 완료 안내 | 모든 사용자 ⭐ |
| **[배포 README](DEPLOY_README.md)** | 배포 스크립트 상세 설명 및 가이드 | DevOps/개발자 |
| **[빠른 배포 가이드](docs/QUICK_DEPLOY.md)** | 30분 안에 배포 완료하기 ⚡ | DevOps/개발자 |
| **[배포 가이드](docs/DEPLOYMENT_GUIDE.md)** | 프로덕션 배포 완전 가이드 | DevOps/시스템 관리자 |
| **[파일럿 테스트 가이드](docs/PILOT_TEST_GUIDE.md)** | 파일럿 사용자를 위한 테스트 가이드 | 테스터/사용자 |

**🚀 배포 스크립트:**
```bash
# 인터랙티브 배포 (가장 쉬움!)
bash scripts/deploy_helper.sh

# 로컬에서 프로덕션 테스트
bash scripts/local_test_prod.sh

# 배포 전 검증
bash scripts/preflight_check.sh

# 배포 상태 확인
bash scripts/deployment_status.sh
```

### 📋 프로젝트 관리

| 문서 | 설명 | 대상 |
|------|------|------|
| **[프로젝트 현황](PROJECT_STATUS.md)** | 현재 진행 상황 및 다음 작업 | 개발자/PM |
| **[설정 완료 보고서](SETUP_COMPLETE.md)** | Phase 1 완료 내역 및 구현 가이드 | 개발자 |
| **[수동 설정 가이드](MANUAL_SETUP.md)** | Docker 없이 로컬 개발 환경 구성 | 고급 사용자 |

## 🚀 Quick Start

**⚡ 가장 빠른 시작:** [빠른 시작 체크리스트](QUICK_START_CHECKLIST.md) - 체크박스를 따라 20-30분만에 설치!

**📖 상세한 가이드:** [완전 설치 가이드](INSTALLATION_GUIDE.md) - 단계별 설명, 문제 해결, 스크린샷 포함!

**현재 프로젝트 상태:** Phase 1 완료 (25%) - [상세 현황 보기](PROJECT_STATUS.md)

### 간단 요약 (이미 설치 경험이 있는 경우)

#### Prerequisites

- Docker Desktop installed and running
- Windows 10/11 with WSL 2
- 8GB+ RAM, 10GB+ disk space

#### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd coachdb
   ```

2. **Create environment file**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations**
   ```bash
   docker-compose exec backend alembic upgrade head
   ```

5. **Seed initial data** (optional)
   ```bash
   docker-compose exec backend python -m app.scripts.seed_data
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - MinIO Console: http://localhost:9001

### Local Development Setup

#### Backend Setup

1. **Create virtual environment**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up PostgreSQL**
   ```bash
   docker run -d --name coachdb-postgres \
     -e POSTGRES_USER=coachdb \
     -e POSTGRES_PASSWORD=coachdb123 \
     -e POSTGRES_DB=coachdb \
     -p 5432:5432 \
     postgres:15-alpine
   ```

4. **Run migrations**
   ```bash
   alembic upgrade head
   ```

5. **Start backend server**
   ```bash
   uvicorn app.main:app --reload
   ```

#### Frontend Setup

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Access frontend**
   - http://localhost:5173

### Database Migrations

#### Create a new migration
```bash
cd backend
alembic revision --autogenerate -m "Description of changes"
```

#### Apply migrations
```bash
alembic upgrade head
```

#### Rollback migration
```bash
alembic downgrade -1
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Projects (Admin/Staff)
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `POST /api/projects/{id}/staff` - Assign staff

### Competencies (Coach)
- `GET /api/competencies/my` - Get my competencies
- `POST /api/competencies` - Create competency
- `PUT /api/competencies/{id}` - Update competency
- `DELETE /api/competencies/{id}` - Delete competency
- `POST /api/competencies/{id}/file` - Upload proof

### Applications (Coach)
- `GET /api/applications/my` - Get my applications
- `POST /api/applications` - Create application
- `PUT /api/applications/{id}` - Update application (auto-save)
- `POST /api/applications/{id}/submit` - Submit application
- `POST /api/applications/{id}/reuse-competency` - Reuse competency

### Reviews (Staff)
- `GET /api/reviews/projects/{id}/applications` - List applications
- `GET /api/reviews/applications/{id}` - Get application
- `POST /api/reviews/applications/{id}/items/{itemId}/lock` - Lock item
- `POST /api/reviews/applications/{id}/items/{itemId}/approve` - Approve
- `POST /api/reviews/applications/{id}/items/{itemId}/reject` - Reject (supplement)

### Selections (Admin)
- `GET /api/selections/projects/{id}/candidates` - Get ranked candidates
- `POST /api/selections/projects/{id}/select` - Select coaches

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/{id}` - Download file

## User Roles

1. **Coach**: Manage competencies, apply to projects, view own applications
2. **Staff**: Review applications for assigned projects
3. **Admin**: Full system access, manage projects, users, view all data

## Development Workflow

### Adding a New Feature

1. Create database model (if needed) in `backend/app/models/`
2. Create migration: `alembic revision --autogenerate -m "Add feature"`
3. Apply migration: `alembic upgrade head`
4. Create Pydantic schemas in `backend/app/schemas/`
5. Create service layer in `backend/app/services/`
6. Create API endpoints in `backend/app/api/endpoints/`
7. Create TypeScript types in `frontend/src/types/`
8. Create React components in `frontend/src/components/`
9. Add API service in `frontend/src/services/`
10. Test the feature

### Code Style

- Backend: Follow PEP 8, use `black` for formatting
- Frontend: Follow ESLint rules, use Prettier for formatting

## Environment Variables

### Backend (.env)

```bash
DATABASE_URL=postgresql+asyncpg://coachdb:coachdb123@localhost:5432/coachdb
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-change-in-production-min-32-chars-long
FILE_STORAGE_TYPE=local  # or 'minio' or 's3'
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:8000
```

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### E2E Tests
```bash
cd frontend
npm run test:e2e
```

## Deployment

### Production Build

#### Backend
```bash
cd backend
docker build -t coachdb-backend:latest .
```

#### Frontend
```bash
cd frontend
npm run build
docker build -t coachdb-frontend:latest .
```

### Deploy to AWS (Free Tier)

1. **Set up RDS PostgreSQL**
2. **Set up ElastiCache Redis**
3. **Set up S3 bucket**
4. **Deploy backend to EC2 or ECS**
5. **Deploy frontend to S3 + CloudFront**
6. **Configure environment variables**

## Critical Implementation Notes

1. **Supplement Reason**: `rejection_reason` column added to both `coach_competencies` and `application_data`
2. **Unique Constraint**: `UNIQUE(project_id, user_id)` on applications prevents duplicates
3. **Lock Expiry**: Background job auto-releases locks after 30 minutes
4. **Score Privacy**: API filters out scores when role=coach
5. **Competency Linking**: `competency_id` in application_data maintains reuse link
6. **Snapshot Architecture**: application_data is immutable after submission (except supplements)

## Phase 1 (MVP) - 12 Weeks

- Week 1: Project foundation
- Week 2: Database schema
- Week 3: Authentication & user management
- Week 4: Admin - Project management
- Week 5: Coach - Competency management
- Week 6-7: Coach - Application system with competency reuse
- Week 8-9: Staff - Review system with concurrent lock protection
- Week 10: Admin - Selection system
- Week 11: File management
- Week 12: Testing & refinement

## Phase 2 (Enhancements) - 8 Weeks

- Email/SMS notifications
- Automatic 6-month competency update reminders
- Excel import/export
- Advanced statistics & reports
- Identity verification integration

## Support

For issues and questions, please contact the development team or create an issue in the repository.

## License

[Your License Here]
