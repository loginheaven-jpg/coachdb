# Coach Competency Database - 빠른 시작 체크리스트

## ✅ 설치 전 체크리스트

- [ ] Windows 10/11 (64-bit)
- [ ] 최소 8GB RAM (16GB 권장)
- [ ] 최소 10GB 디스크 공간
- [ ] 안정적인 인터넷 연결

## ✅ 1단계: Docker Desktop 설치

- [ ] Docker Desktop 다운로드 (https://www.docker.com/products/docker-desktop)
- [ ] "Use WSL 2" 옵션 체크하여 설치
- [ ] 설치 후 컴퓨터 재시작 (필요시)
- [ ] Docker Desktop 실행
- [ ] 시스템 트레이에서 Docker 아이콘이 **초록색**인지 확인
- [ ] PowerShell에서 `docker --version` 실행하여 확인

**예상 소요 시간:** 10-15분

## ✅ 2단계: 프로젝트 준비

```powershell
# PowerShell 실행 후
cd C:\dev\coachdb
ls  # 파일 확인
```

- [ ] 프로젝트 폴더 확인 (backend/, frontend/, docker-compose.yml 존재)
- [ ] backend/.env 파일 존재 확인

**예상 소요 시간:** 1분

## ✅ 3단계: Docker 서비스 시작

```powershell
docker compose up -d --build
```

- [ ] 명령어 실행 (5-10분 소요, 인터넷 속도에 따라)
- [ ] 에러 없이 완료될 때까지 대기
- [ ] `docker compose ps` 실행하여 5개 서비스 모두 "Up" 상태 확인

**체크포인트:**
```
NAME               STATUS
coachdb-backend    Up
coachdb-frontend   Up
coachdb-minio      Up (healthy)
coachdb-postgres   Up (healthy)
coachdb-redis      Up (healthy)
```

**예상 소요 시간:** 5-10분

## ✅ 4단계: 데이터베이스 초기화

### 4-1. 마이그레이션 생성

```powershell
docker compose exec backend alembic revision --autogenerate -m "Initial migration with all 14 tables"
```

- [ ] 명령어 실행
- [ ] "Generating" 메시지 확인
- [ ] 에러 없이 완료

### 4-2. 마이그레이션 적용

```powershell
docker compose exec backend alembic upgrade head
```

- [ ] 명령어 실행
- [ ] "Running upgrade" 메시지 확인
- [ ] 에러 없이 완료

### 4-3. 테이블 생성 확인

```powershell
docker compose exec postgres psql -U coachdb -d coachdb -c "\dt"
```

- [ ] 14개 테이블 (+ alembic_version) 확인:
  - users
  - projects
  - project_staff
  - competency_items
  - project_items
  - scoring_criteria
  - coach_competencies
  - applications
  - application_data
  - files
  - review_locks
  - competency_reminders
  - data_retention_policy
  - alembic_version

**예상 소요 시간:** 2-3분

## ✅ 5단계: 설치 확인

브라우저에서 다음 URL들을 열어서 확인:

### Frontend
- [ ] http://localhost:5173 접속 가능

### Backend API 문서
- [ ] http://localhost:8000/docs 접속 가능 (Swagger UI)
- [ ] http://localhost:8000/redoc 접속 가능 (ReDoc)

### MinIO Console
- [ ] http://localhost:9001 접속 가능
- [ ] `minioadmin` / `minioadmin` 로그인 가능

**예상 소요 시간:** 2분

---

## 🎉 설치 완료!

**총 예상 소요 시간:** 20-30분

모든 체크박스를 체크했다면 설치가 완료된 것입니다!

---

## 🚨 문제 발생 시

### 문제 1: Docker Desktop이 시작되지 않음

```powershell
# 시스템 트레이에서 Docker 종료
# 30초 대기 후 재시작
```

### 문제 2: "port already in use" 오류

```powershell
# 실행 중인 컨테이너 확인
docker ps -a

# 충돌하는 컨테이너 중지
docker stop <container-id>

# 다시 시도
docker compose up -d
```

### 문제 3: 서비스가 계속 재시작됨

```powershell
# 로그 확인
docker compose logs backend --tail=100
docker compose logs postgres --tail=100

# 에러 메시지를 확인하고 INSTALLATION_GUIDE.md 문제 해결 섹션 참조
```

### 문제 4: 빌드 중 패키지 오류

```powershell
# Docker 캐시 정리
docker system prune -f

# 컨테이너와 볼륨 모두 삭제 후 재시작
docker compose down -v
docker compose up -d --build
```

---

## 📚 추가 문서

상세한 문제 해결은 다음 문서를 참조하세요:

- **[완전 설치 가이드](INSTALLATION_GUIDE.md)** - 단계별 상세 설명
- **[README.md](README.md)** - 프로젝트 개요 및 기술 스택
- **[SETUP_COMPLETE.md](SETUP_COMPLETE.md)** - 완료된 작업 내역

---

## 🔧 유용한 명령어

### 서비스 관리

```powershell
# 모든 서비스 시작
docker compose up -d

# 모든 서비스 중지
docker compose down

# 특정 서비스 재시작
docker compose restart backend

# 서비스 상태 확인
docker compose ps

# 로그 확인 (실시간)
docker compose logs -f backend
```

### 데이터베이스

```powershell
# PostgreSQL 접속
docker compose exec postgres psql -U coachdb -d coachdb

# 테이블 목록 확인
docker compose exec postgres psql -U coachdb -d coachdb -c "\dt"

# 백업
docker compose exec postgres pg_dump -U coachdb coachdb > backup.sql
```

### 개발

```powershell
# Backend 컨테이너 쉘 접속
docker compose exec backend bash

# 새 마이그레이션 생성
docker compose exec backend alembic revision --autogenerate -m "description"

# 마이그레이션 적용
docker compose exec backend alembic upgrade head

# 마이그레이션 롤백
docker compose exec backend alembic downgrade -1
```

---

## 다음 단계

설치가 완료되면 다음 기능들을 구현할 차례입니다:

1. **인증 시스템** - 회원가입/로그인
2. **관리자 기능** - 프로젝트 관리
3. **코치 기능** - 역량 관리 및 지원
4. **심사위원 기능** - 리뷰 시스템
5. **선발 시스템** - 자동 점수 계산

자세한 개발 로드맵은 [SETUP_COMPLETE.md](SETUP_COMPLETE.md) 파일의 "What Needs to Be Done Next" 섹션을 참조하세요.

---

**Happy Coding!** 🚀
