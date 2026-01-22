# DEPLOYMENT.md

PCMS (Professional Coach Management System) Railway 배포 가이드

---

## 📋 목차

1. [배포 아키텍처](#배포-아키텍처)
2. [사전 준비](#사전-준비)
3. [Railway 프로젝트 설정](#railway-프로젝트-설정)
4. [환경 변수 설정](#환경-변수-설정)
5. [배포 프로세스](#배포-프로세스)
6. [배포 후 확인](#배포-후-확인)
7. [트러블슈팅](#트러블슈팅)

---

## 배포 아키텍처

PCMS는 Railway에서 다음 3개의 서비스로 구성됩니다:

```
┌─────────────────────────────────────────────────┐
│              Railway Platform                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │   Frontend   │  │   Backend    │           │
│  │  (React SPA) │  │  (FastAPI)   │           │
│  │  Port: $PORT │  │  Port: $PORT │           │
│  └──────┬───────┘  └──────┬───────┘           │
│         │                  │                    │
│         │                  │                    │
│         │         ┌────────▼────────┐          │
│         │         │   PostgreSQL    │          │
│         │         │   (Railway DB)  │          │
│         │         └─────────────────┘          │
│         │                                       │
│         └────────────────────────────────────► │
│              (API 호출)                         │
└─────────────────────────────────────────────────┘
```

**서비스 구성**:
1. **Frontend**: React + TypeScript + Vite
   - 빌드 결과(dist)를 serve로 정적 서빙
   - Backend API 호출
2. **Backend**: FastAPI + SQLAlchemy
   - REST API 제공
   - PostgreSQL 연결
   - 파일 업로드/다운로드
3. **PostgreSQL**: Railway Postgres Plugin
   - 역량, 프로젝트, 지원서 데이터 저장

---

## 사전 준비

### 1. 필수 계정
- [Railway 계정](https://railway.app/) (GitHub 계정으로 가입 권장)
- [GitHub 계정](https://github.com/)

### 2. 로컬 개발 환경
```bash
# Railway CLI 설치 (선택사항)
npm install -g @railway/cli

# 또는 Homebrew (macOS)
brew install railway

# 로그인 확인
railway login
```

### 3. 저장소 준비
```bash
# 코드가 GitHub에 push되어 있는지 확인
git remote -v
# origin	https://github.com/loginheaven-jpg/coachdb.git (fetch)
# origin	https://github.com/loginheaven-jpg/coachdb.git (push)

git push origin main
```

---

## Railway 프로젝트 설정

### 방법 1: Railway 대시보드에서 설정 (권장)

#### 1. 새 프로젝트 생성
1. [Railway 대시보드](https://railway.app/dashboard) 접속
2. **"New Project"** 클릭
3. **"Deploy from GitHub repo"** 선택
4. `loginheaven-jpg/coachdb` 저장소 선택

#### 2. PostgreSQL 추가
1. 프로젝트 대시보드에서 **"+ New"** 클릭
2. **"Database"** → **"Add PostgreSQL"** 선택
3. 자동으로 `DATABASE_URL` 환경 변수가 생성됩니다

#### 3. Backend 서비스 설정
1. **"+ New"** → **"GitHub Repo"** → `coachdb` 선택
2. 서비스 이름: **"backend"**
3. **Settings** → **Source**:
   - Root Directory: `backend`
   - Build Command: (자동 감지)
   - Start Command: (자동 감지, Dockerfile 사용)
4. **Settings** → **Networking**:
   - Generate Domain (공개 URL 생성)

#### 4. Frontend 서비스 설정
1. **"+ New"** → **"GitHub Repo"** → `coachdb` 선택
2. 서비스 이름: **"frontend"**
3. **Settings** → **Source**:
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npx serve -s dist -l tcp://0.0.0.0:$PORT`
4. **Settings** → **Networking**:
   - Generate Domain (공개 URL 생성)

### 방법 2: Railway CLI 사용

```bash
# 프로젝트 연결
railway link

# PostgreSQL 추가
railway add --database postgres

# Backend 배포
cd backend
railway up

# Frontend 배포
cd ../frontend
railway up
```

---

## 환경 변수 설정

### Backend 환경 변수

Railway 대시보드 → Backend 서비스 → **Variables** 탭:

```bash
# 필수 환경 변수
DATABASE_URL=${{Postgres.DATABASE_URL}}  # PostgreSQL 연결 (자동 생성)
SECRET_KEY=your-super-secret-key-min-32-chars-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS 설정 (Frontend URL로 변경 필요)
BACKEND_CORS_ORIGINS=["https://your-frontend-url.up.railway.app"]

# 파일 스토리지 (로컬 또는 클라우드)
FILE_STORAGE_TYPE=local
FILE_STORAGE_PATH=./uploads
FILE_MAX_SIZE_MB=10

# 프론트엔드 URL (비밀번호 재설정 이메일용)
FRONTEND_URL=https://your-frontend-url.up.railway.app

# 이메일 설정 (선택, SendGrid 사용 시)
SENDGRID_API_KEY=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=CoachDB

# 앱 설정
APP_NAME=Coach Competency Database Service
APP_VERSION=1.0.0
DEBUG=False
DATABASE_ECHO=False
```

**중요**:
- `SECRET_KEY`는 반드시 변경하세요 (32자 이상 랜덤 문자열)
- `BACKEND_CORS_ORIGINS`에 Frontend URL을 정확히 입력하세요
- `DATABASE_URL`은 Railway가 자동으로 생성 (수동 입력 불필요)

### Frontend 환경 변수

Railway 대시보드 → Frontend 서비스 → **Variables** 탭:

```bash
# Backend API URL
VITE_API_BASE_URL=https://your-backend-url.up.railway.app
```

**설정 방법**:
1. Backend 배포 완료 후 공개 URL 확인
2. Frontend 환경 변수에 `VITE_API_BASE_URL` 추가
3. Frontend 재배포 (Redeploy)

---

## 배포 프로세스

### 자동 배포 (권장)

Railway는 GitHub 저장소와 연동되어 있으면 자동 배포됩니다:

```bash
# 코드 수정 후
git add .
git commit -m "Update feature"
git push origin main
```

**자동 배포 흐름**:
1. GitHub에 push
2. Railway가 변경 감지
3. 자동으로 빌드 시작
4. 테스트 통과 시 배포
5. 이전 버전은 자동 롤백 가능

### 수동 배포

Railway 대시보드에서:
1. 서비스 선택
2. **Deployments** 탭
3. **Deploy** 버튼 클릭

### CLI 배포

```bash
# Backend 배포
cd backend
railway up

# Frontend 배포
cd ../frontend
railway up
```

---

## 배포 후 확인

### 1. Health Check

Backend 상태 확인:
```bash
curl https://your-backend-url.up.railway.app/health
```

응답 예시:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-22T06:00:00.000Z"
}
```

### 2. Frontend 접속 확인

브라우저에서 `https://your-frontend-url.up.railway.app` 접속
- 로그인 페이지 정상 표시 확인
- 네트워크 탭에서 API 호출 확인 (CORS 에러 없어야 함)

### 3. Database 연결 확인

Railway 대시보드 → PostgreSQL 서비스 → **Data** 탭:
- 테이블 생성 확인 (users, projects, applications 등)
- Alembic 마이그레이션 완료 확인

### 4. 로그 확인

Railway 대시보드 → 서비스 선택 → **Deployments** → 최신 배포 클릭:

**Backend 로그 예시**:
```
=== Starting CoachDB Backend ===
PORT: 8080
=== Fixing missing columns (direct SQL) ===
[OK] projects.support_program_name ensured
[OK] Database columns and categories fixed
=== Running migrations ===
INFO  [alembic.runtime.migration] Running upgrade -> head
=== Starting uvicorn ===
INFO:     Started server process [1]
INFO:     Waiting for application startup.
[START] Starting Coach Competency Database Service...
[OK] Database initialized
```

**Frontend 로그 예시**:
```
> coachdb@1.0.0 build
> tsc && vite build

vite v5.0.8 building for production...
✓ 2847 modules transformed.
dist/index.html                   0.65 kB │ gzip: 0.40 kB
dist/assets/index-abc123.css     45.23 kB │ gzip: 12.34 kB
dist/assets/index-xyz789.js     678.90 kB │ gzip: 234.56 kB
✓ built in 23.45s

serve: Running on port 3000
```

---

## 트러블슈팅

### 문제 1: CORS 에러

**증상**:
```
Access to XMLHttpRequest at 'https://backend.railway.app/api/...'
from origin 'https://frontend.railway.app' has been blocked by CORS policy
```

**해결**:
1. Backend 환경 변수 `BACKEND_CORS_ORIGINS` 확인
2. Frontend URL을 정확히 입력했는지 확인
3. Backend 재배포

```bash
# 올바른 형식
BACKEND_CORS_ORIGINS=["https://your-frontend-url.up.railway.app","http://localhost:5173"]
```

### 문제 2: Database 연결 실패

**증상**:
```
sqlalchemy.exc.OperationalError: could not connect to server
```

**해결**:
1. PostgreSQL 서비스가 실행 중인지 확인
2. `DATABASE_URL` 환경 변수 확인
3. Backend와 PostgreSQL이 같은 프로젝트에 있는지 확인

```bash
# DATABASE_URL 형식 확인
echo $DATABASE_URL
# postgresql://user:pass@hostname:5432/dbname
```

### 문제 3: 빌드 실패

**증상**:
```
npm ERR! code ELIFECYCLE
npm ERR! errno 1
```

**해결**:
1. `package.json`의 scripts 확인
2. 로컬에서 빌드 테스트
3. Node.js 버전 확인 (Railway는 Node 18 사용)

```bash
# 로컬 빌드 테스트
cd frontend
npm install
npm run build

cd ../backend
pip install -r requirements.txt
alembic upgrade head
```

### 문제 4: 환경 변수 적용 안 됨

**증상**:
환경 변수 변경 후에도 이전 값 사용

**해결**:
1. Railway 대시보드에서 서비스 재배포 (Redeploy)
2. 또는 CLI: `railway up --detach`

### 문제 5: 파일 업로드 실패

**증상**:
```
FileNotFoundError: [Errno 2] No such file or directory: './uploads/...'
```

**해결**:
Railway는 ephemeral 파일 시스템 사용 (재배포 시 삭제됨)
- **권장**: Cloudflare R2 또는 AWS S3 사용
- Backend 환경 변수:
  ```bash
  FILE_STORAGE_TYPE=r2
  R2_ACCOUNT_ID=your-account-id
  R2_ACCESS_KEY_ID=your-access-key
  R2_SECRET_ACCESS_KEY=your-secret-key
  R2_BUCKET=coachdb-files
  ```

### 문제 6: Alembic 마이그레이션 실패

**증상**:
```
[WARN] Alembic migration failed, continuing...
```

**해결**:
`start.sh` 스크립트가 자동으로 스키마를 수정합니다.
- 대부분의 경우 경고는 무시 가능
- 테이블이 생성되지 않으면 Railway PostgreSQL 콘솔에서 수동 확인

```sql
-- PostgreSQL 콘솔에서 테이블 확인
\dt
SELECT * FROM alembic_version;
```

---

## 배포 체크리스트

배포 전 확인사항:

- [ ] 코드가 GitHub에 최신 상태로 push됨
- [ ] `.env.example` 파일이 최신 상태
- [ ] Backend `SECRET_KEY` 변경됨 (프로덕션용)
- [ ] Frontend `VITE_API_BASE_URL` 설정됨
- [ ] Backend `BACKEND_CORS_ORIGINS`에 Frontend URL 추가됨
- [ ] PostgreSQL 서비스 추가됨
- [ ] 로컬에서 빌드 테스트 완료
- [ ] Alembic 마이그레이션 확인

배포 후 확인사항:

- [ ] Backend `/health` 엔드포인트 정상 응답
- [ ] Frontend 접속 가능
- [ ] 로그인 기능 동작
- [ ] API 호출 정상 (CORS 에러 없음)
- [ ] Database 테이블 생성 확인
- [ ] 파일 업로드 테스트 (로컬 스토리지인 경우 주의)

---

## 추가 리소스

- [Railway 공식 문서](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
- [FastAPI 배포 가이드](https://fastapi.tiangolo.com/deployment/)
- [Vite 프로덕션 빌드](https://vitejs.dev/guide/build.html)

---

## 참고사항

### 비용
- Railway는 월 $5 크레딧 무료 제공 (Hobby Plan)
- 초과 사용 시 종량제 과금
- 모니터링: Railway 대시보드 → Usage 탭

### 모니터링
```bash
# 실시간 로그 확인 (CLI)
railway logs --service backend
railway logs --service frontend

# 메트릭 확인
railway status
```

### 롤백
배포 실패 시 이전 버전으로 롤백:
1. Railway 대시보드 → Deployments
2. 이전 버전 선택 → **Rollback** 클릭

---

**작성일**: 2026-01-22
**작성자**: Claude Code
**최종 업데이트**: 2026-01-22
