# Coach Competency Database - 완전 설치 가이드

이 가이드는 Windows 환경에서 Docker를 사용하여 Coach Competency Database 시스템을 처음부터 설치하는 방법을 단계별로 설명합니다.

## 목차

1. [사전 준비사항](#사전-준비사항)
2. [Docker Desktop 설치](#docker-desktop-설치)
3. [프로젝트 다운로드](#프로젝트-다운로드)
4. [환경 설정](#환경-설정)
5. [Docker 서비스 시작](#docker-서비스-시작)
6. [데이터베이스 초기화](#데이터베이스-초기화)
7. [설치 확인](#설치-확인)
8. [문제 해결](#문제-해결)

---

## 사전 준비사항

### 필수 소프트웨어

- **Windows 10/11** (64-bit)
- **WSL 2** (Windows Subsystem for Linux)
- **Docker Desktop** (최신 버전)
- **Git** (선택사항)

### 시스템 요구사항

- RAM: 최소 8GB (16GB 권장)
- 디스크 공간: 최소 10GB
- 인터넷 연결 (Docker 이미지 다운로드용)

---

## 1. Docker Desktop 설치

### 1.1 Docker Desktop 다운로드

1. https://www.docker.com/products/docker-desktop 접속
2. "Download for Windows" 버튼 클릭
3. 다운로드한 `Docker Desktop Installer.exe` 실행

### 1.2 설치 과정

1. 설치 마법사에서 **"Use WSL 2 instead of Hyper-V"** 옵션 체크
2. "Install" 버튼 클릭
3. 설치 완료 후 컴퓨터 재시작 (필요시)

### 1.3 Docker Desktop 시작 확인

1. Windows 시작 메뉴에서 "Docker Desktop" 검색하여 실행
2. Docker Desktop이 시작될 때까지 대기 (1-2분 소요)
3. 시스템 트레이(작업 표시줄 오른쪽 하단)에서 Docker 아이콘 확인
4. Docker 아이콘이 **초록색**이면 정상 실행 중

### 1.4 Docker 설치 확인

PowerShell 또는 명령 프롬프트를 열고 다음 명령어 실행:

```powershell
docker --version
docker compose version
```

**정상 출력 예시:**
```
Docker version 28.5.1, build e180ab8
Docker Compose version v2.40.3-desktop.1
```

---

## 2. 프로젝트 다운로드

### 2.1 프로젝트 폴더 생성

PowerShell을 열고 다음 명령어 실행:

```powershell
# C:\dev 폴더 생성 (없는 경우)
mkdir C:\dev

# 프로젝트 폴더로 이동
cd C:\dev
```

### 2.2 프로젝트 파일 복사

프로젝트 파일을 `C:\dev\coachdb` 폴더에 복사합니다.

Git을 사용하는 경우:
```powershell
git clone <repository-url> coachdb
cd coachdb
```

### 2.3 폴더 구조 확인

```powershell
ls
```

**예상 출력:**
```
backend/
frontend/
docker-compose.yml
README.md
INSTALLATION_GUIDE.md
```

---

## 3. 환경 설정

### 3.1 Backend 환경 변수 설정

이미 `.env` 파일이 준비되어 있습니다. 확인만 하면 됩니다:

```powershell
cat backend\.env
```

**주요 설정값:**
- `DATABASE_URL`: PostgreSQL 연결 정보
- `REDIS_URL`: Redis 연결 정보
- `SECRET_KEY`: JWT 토큰용 비밀키
- `MINIO_*`: 파일 저장소 설정

> **참고**: 프로덕션 환경에서는 `SECRET_KEY`를 반드시 변경하세요!

---

## 4. Docker 서비스 시작

### 4.1 Docker 이미지 다운로드 (선택사항)

서비스 시작 전 수동으로 이미지를 다운로드할 수 있습니다:

```powershell
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker pull minio/minio:latest
```

이 단계는 선택사항이며, `docker compose up` 명령어가 자동으로 이미지를 다운로드합니다.

### 4.2 모든 서비스 시작

```powershell
docker compose up -d --build
```

**명령어 설명:**
- `up`: 서비스 시작
- `-d`: 백그라운드 실행 (detached mode)
- `--build`: 이미지 빌드 (처음 실행 시)

**예상 소요 시간:** 5-10분 (인터넷 속도에 따라 다름)

### 4.3 진행 상황 확인

빌드 과정이 진행되는 동안 다음과 같은 메시지가 표시됩니다:

```
[+] Building 120.5s (22/22) FINISHED
 => [backend] downloading packages...
 => [frontend] npm install...
```

### 4.4 서비스 상태 확인

```powershell
docker compose ps
```

**정상 출력 예시:**
```
NAME               IMAGE                COMMAND                   SERVICE    STATUS
coachdb-backend    coachdb-backend      "uvicorn app.main:ap…"   backend    Up
coachdb-frontend   coachdb-frontend     "docker-entrypoint.s…"   frontend   Up
coachdb-minio      minio/minio:latest   "/usr/bin/docker-ent…"   minio      Up (healthy)
coachdb-postgres   postgres:15-alpine   "docker-entrypoint.s…"   postgres   Up (healthy)
coachdb-redis      redis:7-alpine       "docker-entrypoint.s…"   redis      Up (healthy)
```

**모든 서비스의 STATUS가 "Up" 또는 "Up (healthy)"여야 합니다.**

---

## 5. 데이터베이스 초기화

### 5.1 데이터베이스 마이그레이션 생성

```powershell
docker compose exec backend alembic revision --autogenerate -m "Initial migration with all 14 tables"
```

**예상 출력:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.autogenerate.compare] Detected added table 'users'
INFO  [alembic.autogenerate.compare] Detected added table 'projects'
...
Generating ...\alembic\versions\xxxx_initial_migration_with_all_14_tables.py
```

### 5.2 마이그레이션 실행

```powershell
docker compose exec backend alembic upgrade head
```

**예상 출력:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> b054bbeabdb8, Initial migration with all 14 tables
```

### 5.3 테이블 생성 확인

```powershell
docker compose exec postgres psql -U coachdb -d coachdb -c "\dt"
```

**예상 출력 (14개 테이블):**
```
                List of relations
 Schema |         Name          | Type  |  Owner
--------+-----------------------+-------+---------
 public | alembic_version       | table | coachdb
 public | application_data      | table | coachdb
 public | applications          | table | coachdb
 public | coach_competencies    | table | coachdb
 public | competency_items      | table | coachdb
 public | competency_reminders  | table | coachdb
 public | data_retention_policy | table | coachdb
 public | files                 | table | coachdb
 public | project_items         | table | coachdb
 public | project_staff         | table | coachdb
 public | projects              | table | coachdb
 public | review_locks          | table | coachdb
 public | scoring_criteria      | table | coachdb
 public | users                 | table | coachdb
(14 rows)
```

---

## 6. 설치 확인

### 6.1 웹 브라우저로 접속

다음 URL들을 브라우저에서 열어서 확인하세요:

#### Frontend (React 애플리케이션)
- URL: http://localhost:5173
- 예상: React 앱 로딩 화면 또는 로그인 페이지

#### Backend API 문서 (Swagger UI)
- URL: http://localhost:8000/docs
- 예상: FastAPI 자동 생성 API 문서

#### Backend API 문서 (ReDoc)
- URL: http://localhost:8000/redoc
- 예상: 깔끔한 API 문서

#### MinIO Console (파일 저장소 관리)
- URL: http://localhost:9001
- 사용자명: `minioadmin`
- 비밀번호: `minioadmin`

### 6.2 서비스 로그 확인

각 서비스의 로그를 확인하여 오류가 없는지 점검:

```powershell
# Backend 로그
docker compose logs backend --tail=50

# Frontend 로그
docker compose logs frontend --tail=50

# PostgreSQL 로그
docker compose logs postgres --tail=50
```

---

## 7. 문제 해결

### 문제 1: "Docker Desktop is unable to start"

**증상:**
```
Error response from daemon: Docker Desktop is unable to start
```

**해결 방법:**
1. Docker Desktop을 완전히 종료
   - 시스템 트레이에서 Docker 아이콘 우클릭 → "Quit Docker Desktop"
2. 30초 대기
3. Docker Desktop 재시작
4. Docker 엔진이 완전히 시작될 때까지 대기 (1-2분)
5. PowerShell에서 `docker version` 명령어로 확인

### 문제 2: "unable to get image 'postgres:15-alpine': unexpected end of JSON input"

**증상:**
Docker 이미지 다운로드 중 JSON 파싱 오류

**해결 방법:**
```powershell
# Docker 캐시 정리
docker system prune -f

# 개별 이미지 수동 다운로드
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker pull minio/minio:latest

# 다시 시도
docker compose up -d --build
```

### 문제 3: "NameError: name 'relationship' is not defined"

**증상:**
Alembic 마이그레이션 실행 시 relationship 오류

**해결 방법:**
이미 수정되어 있습니다. 만약 오류가 발생하면:

```powershell
# Backend 컨테이너 재시작
docker compose restart backend

# 다시 마이그레이션 실행
docker compose exec backend alembic upgrade head
```

### 문제 4: Port Already in Use (포트 충돌)

**증상:**
```
Error: port 5432 is already allocated
```

**해결 방법:**

**옵션 A - 기존 서비스 중지:**
```powershell
# PostgreSQL이 이미 실행 중인 경우
Stop-Service postgresql-x64-15  # 서비스 이름 확인 필요

# 또는 다른 Docker 컨테이너가 사용 중인 경우
docker ps
docker stop <container-id>
```

**옵션 B - 포트 변경:**
`docker-compose.yml` 파일에서 포트 수정:
```yaml
postgres:
  ports:
    - "5433:5432"  # 5432 → 5433으로 변경
```

### 문제 5: 서비스가 계속 재시작됨

**증상:**
```powershell
docker compose ps
# STATUS가 "Restarting" 반복
```

**해결 방법:**
```powershell
# 특정 서비스 로그 확인
docker compose logs backend --tail=100

# 오류 메시지 확인 후 해당 문제 해결
```

**흔한 원인:**
- 데이터베이스 연결 실패 → PostgreSQL 서비스 확인
- 환경 변수 오류 → `.env` 파일 확인
- 포트 충돌 → 위 "문제 4" 참조

### 문제 6: 패키지 의존성 충돌

**증상:**
```
ERROR: Cannot install email-validator==2.1.0 and fastapi-users
```

**해결 방법:**
이미 `requirements.txt`에서 수정되었습니다 (`email-validator==2.0.0`). 최신 코드를 사용하면 문제없습니다.

---

## 8. 일반 관리 명령어

### 서비스 시작/중지

```powershell
# 모든 서비스 시작
docker compose up -d

# 모든 서비스 중지
docker compose down

# 특정 서비스만 재시작
docker compose restart backend
docker compose restart frontend

# 모든 서비스 중지 및 데이터 삭제 (주의!)
docker compose down -v
```

### 로그 확인

```powershell
# 실시간 로그 확인 (Ctrl+C로 종료)
docker compose logs -f backend

# 최근 50줄만 확인
docker compose logs backend --tail=50

# 모든 서비스 로그
docker compose logs
```

### 컨테이너 접속

```powershell
# Backend 컨테이너 쉘 접속
docker compose exec backend bash

# PostgreSQL 데이터베이스 접속
docker compose exec postgres psql -U coachdb -d coachdb

# Redis CLI 접속
docker compose exec redis redis-cli
```

### 데이터베이스 백업

```powershell
# PostgreSQL 백업
docker compose exec postgres pg_dump -U coachdb coachdb > backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql

# 백업 복원
Get-Content backup_20251103_093000.sql | docker compose exec -T postgres psql -U coachdb -d coachdb
```

---

## 9. 다음 단계

설치가 완료되었습니다! 이제 다음 작업을 진행할 수 있습니다:

### Phase 2: 기능 구현

1. **인증 시스템** (Week 3)
   - 회원가입 API
   - 로그인/로그아웃
   - JWT 토큰 관리
   - 역할 기반 접근 제어

2. **관리자 기능** (Week 4)
   - 프로젝트 생성/관리
   - 평가 항목 설정
   - 채점 기준 정의
   - 심사위원 배정

3. **코치 기능** (Week 5-7)
   - 역량 관리 (전자 지갑)
   - 프로젝트 지원
   - 역량 재사용
   - 지원서 제출

4. **심사위원 기능** (Week 8-9)
   - 지원서 리뷰
   - 동시 리뷰 방지
   - 점수 부여
   - 보완 요청

5. **선발 시스템** (Week 10)
   - 자동 점수 계산
   - 후보자 랭킹
   - 선발 결과 확정

### 개발 환경 설정

로컬 개발을 위해 IDE를 설정하세요:

**Backend (Python):**
- VS Code 또는 PyCharm 사용
- Python Extension 설치
- 가상환경 설정

**Frontend (React):**
- VS Code 사용
- ESLint, Prettier Extension 설치
- Node.js 18+ 설치

자세한 개발 가이드는 `README.md`를 참고하세요.

---

## 10. 유용한 팁

### Docker Compose 명령어 단축

PowerShell Profile에 alias 추가:

```powershell
# PowerShell Profile 열기
notepad $PROFILE

# 다음 내용 추가
function dcu { docker compose up -d }
function dcd { docker compose down }
function dcp { docker compose ps }
function dcl { docker compose logs -f $args }
```

### 개발 중 자동 재시작

Backend와 Frontend는 코드 변경 시 자동으로 재시작됩니다:

- **Backend**: Uvicorn의 `--reload` 옵션
- **Frontend**: Vite의 HMR (Hot Module Replacement)

파일을 수정하고 저장하면 자동으로 반영됩니다!

### 디버깅 모드

Backend 디버깅을 위해:

```yaml
# docker-compose.yml에서 backend 서비스 수정
backend:
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug
```

---

## 부록: 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                     웹 브라우저                         │
│              http://localhost:5173                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Frontend (React + Vite)                    │
│              Port: 5173                                 │
│              - Ant Design UI                            │
│              - Zustand State                            │
│              - React Query                              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST API
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (FastAPI)                          │
│              Port: 8000                                 │
│              - Uvicorn Server                           │
│              - JWT Authentication                       │
│              - SQLAlchemy ORM                           │
└────┬──────────┬───────────┬──────────────┬──────────────┘
     │          │           │              │
     ▼          ▼           ▼              ▼
┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐
│PostgreSQL│ │ Redis  │ │  MinIO  │ │   Celery     │
│ Port:    │ │Port:   │ │Port:    │ │  (Phase 2)   │
│  5432    │ │ 6379   │ │9000,9001│ │              │
│          │ │        │ │         │ │              │
│ 14 Tables│ │ Cache  │ │ S3 API  │ │ Background   │
│          │ │        │ │         │ │ Tasks        │
└─────────┘ └────────┘ └─────────┘ └──────────────┘
```

---

## 지원 및 문서

- **API 문서**: http://localhost:8000/docs
- **프로젝트 README**: [README.md](README.md)
- **설정 완료 보고서**: [SETUP_COMPLETE.md](SETUP_COMPLETE.md)
- **데이터베이스 ERD**: 추후 제공 예정

---

## 라이선스

[Your License Here]

---

**설치 완료를 축하합니다!** 🎉

문제가 발생하면 [문제 해결](#7-문제-해결) 섹션을 참고하거나 개발팀에 문의하세요.
