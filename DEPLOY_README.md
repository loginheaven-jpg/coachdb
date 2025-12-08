# CoachDB 파일럿 배포 가이드

## 🚀 빠른 시작 (Quick Start)

### Windows에서 로컬 테스트

```bash
# 1. Pre-flight 체크
bash scripts/preflight_check.sh

# 2. 로컬에서 프로덕션 환경 테스트
bash scripts/local_test_prod.sh

# 3. 상태 확인
bash scripts/deployment_status.sh
```

### Linux 서버에서 실제 배포

```bash
# 1. 서버 준비 및 파일 업로드 후
bash scripts/preflight_check.sh

# 2. 환경 변수 설정
cp .env.production.example .env.production
nano .env.production  # 실제 값으로 수정

# 3. 배포 실행
bash scripts/deploy.sh

# 4. 상태 확인
bash scripts/deployment_status.sh
```

---

## 📋 배포 체크리스트

### Phase 1: 로컬 검증 (Windows)

- [ ] Docker Desktop 설치 및 실행
- [ ] `scripts/preflight_check.sh` 실행
- [ ] `scripts/local_test_prod.sh` 실행
- [ ] http://localhost 접속 확인
- [ ] 테스트 계정으로 로그인 테스트
- [ ] 주요 기능 테스트 (설문 생성, 지원서 작성 등)

### Phase 2: 서버 준비

- [ ] 서버 선택 (DigitalOcean, AWS, Vultr 등)
- [ ] Ubuntu 22.04 LTS 설치
- [ ] Docker 및 Docker Compose 설치
- [ ] 도메인 DNS 설정 (A 레코드)
- [ ] 방화벽 포트 오픈 (80, 443)

### Phase 3: 실제 배포

- [ ] 코드 서버에 업로드 (git clone 또는 scp)
- [ ] `.env.production` 설정
- [ ] `scripts/deploy.sh` 실행
- [ ] SSL 인증서 설치 (Let's Encrypt)
- [ ] 파일럿 사용자 생성
- [ ] 배포 테스트

### Phase 4: 운영 설정

- [ ] 자동 백업 크론 설정
- [ ] 모니터링 설정 (선택사항)
- [ ] 사용자 가이드 배포
- [ ] 파일럿 테스터 초대

---

## 🛠️ 스크립트 설명

### 1. `preflight_check.sh` - 배포 전 검증

배포 전 모든 필수 항목을 자동으로 체크합니다.

**체크 항목:**
- Docker 설치 및 실행 상태
- 필수 파일 존재 여부
- 환경 변수 설정 검증
- 디렉토리 구조 확인
- 포트 사용 가능 여부
- 디스크 공간 확인
- 스크립트 실행 권한

**실행:**
```bash
bash scripts/preflight_check.sh
```

**결과:**
- ✓ 녹색: 통과
- ⚠ 노란색: 경고 (배포 가능하나 확인 필요)
- ✗ 빨간색: 오류 (수정 필요)

### 2. `local_test_prod.sh` - 로컬 프로덕션 테스트

Windows 환경에서 프로덕션 설정을 테스트합니다.

**수행 작업:**
1. 테스트용 환경 변수 자동 생성
2. 프로덕션 Docker 이미지 빌드
3. 컨테이너 시작 및 헬스 체크
4. 데이터베이스 마이그레이션
5. 파일럿 사용자 생성 (선택)

**실행:**
```bash
bash scripts/local_test_prod.sh
```

**접속:**
- Frontend: http://localhost
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

**테스트 계정:**
- 관리자: admin1@test.com / Pilot2025!
- 코치: coach1@test.com / Pilot2025!

### 3. `deploy.sh` - 실제 배포

서버에서 실제 배포를 수행합니다.

**수행 작업:**
1. 환경 변수 로드
2. Git pull (선택)
3. 데이터베이스 자동 백업
4. 컨테이너 정지
5. 새 이미지 빌드
6. 컨테이너 시작
7. 헬스 체크
8. 마이그레이션 실행
9. 오래된 백업 정리

**실행:**
```bash
cd /home/coachdb/coachdb
bash scripts/deploy.sh
```

### 4. `backup.sh` - 데이터베이스 백업

데이터베이스를 백업합니다.

**특징:**
- Custom 포맷 사용 (pg_dump -Fc)
- Gzip 압축
- 7일 이상 된 백업 자동 삭제
- 백업 목록 출력

**실행:**
```bash
bash scripts/backup.sh
```

**크론 설정 (매일 새벽 2시):**
```bash
crontab -e
# 추가:
0 2 * * * /home/coachdb/coachdb/scripts/backup.sh >> /home/coachdb/coachdb/backup/backup.log 2>&1
```

### 5. `restore.sh` - 데이터베이스 복구

백업에서 데이터베이스를 복구합니다.

**안전 기능:**
- 복구 전 현재 DB 자동 백업
- 확인 프롬프트
- 압축 파일 자동 감지
- 마이그레이션 자동 실행

**실행:**
```bash
bash scripts/restore.sh /path/to/backup.sql.gz
```

**사용 가능한 백업 목록:**
```bash
ls -lh backup/coachdb_*.sql.gz
```

### 6. `deployment_status.sh` - 배포 상태 확인

실행 중인 시스템의 상태를 종합적으로 확인합니다.

**확인 항목:**
- 컨테이너 실행 상태
- 서비스 헬스 체크
- 데이터베이스 통계 (사용자 수, 프로젝트 수 등)
- 디스크 사용량
- 백업 상태
- 최근 에러 로그
- 리소스 사용량
- 서비스 업타임

**실행:**
```bash
bash scripts/deployment_status.sh
```

### 7. `create_pilot_users.py` - 파일럿 사용자 생성

테스트용 사용자 계정을 자동으로 생성합니다.

**생성되는 계정:**
- 관리자 2명: admin1@test.com, admin2@test.com
- 코치 10명: coach1@test.com ~ coach10@test.com
- 모든 계정 비밀번호: Pilot2025!

**실행:**
```bash
# Docker 컨테이너 내부에서
docker-compose -f docker-compose.prod.yml exec backend python scripts/create_pilot_users.py

# 또는 로컬 테스트 시 자동 실행됨
```

---

## 🔧 환경 변수 설정

### `.env.production` 필수 항목

```bash
# 데이터베이스 비밀번호 (강력한 비밀번호 사용)
DB_PASSWORD=your_strong_password_here_123!@#

# JWT 시크릿 키 (최소 32자, 랜덤 문자열)
# 생성: openssl rand -hex 32
SECRET_KEY=abc123def456...your_random_32_char_string

# CORS 허용 도메인 (실제 도메인으로 변경)
CORS_ORIGINS=["https://your-domain.com"]

# API URL (실제 도메인으로 변경)
VITE_API_BASE_URL=https://your-domain.com/api
```

### 보안 키 생성 방법

**SECRET_KEY 생성:**
```bash
# Linux/Mac/WSL
openssl rand -hex 32

# Python
python -c "import secrets; print(secrets.token_hex(32))"

# PowerShell (Windows)
[System.Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))
```

**강력한 비밀번호 생성:**
```bash
# Linux/Mac/WSL
openssl rand -base64 24

# PowerShell
Add-Type -AssemblyName 'System.Web'
[System.Web.Security.Membership]::GeneratePassword(20, 5)
```

---

## 🌐 도메인 및 SSL 설정

### 1. 도메인 DNS 설정

**A 레코드 추가:**
```
Type: A
Name: coachdb-pilot (또는 @)
Value: your_server_ip
TTL: 3600
```

**DNS 전파 확인:**
```bash
nslookup coachdb-pilot.yourdomain.com
# 또는
dig coachdb-pilot.yourdomain.com
```

### 2. Let's Encrypt SSL 인증서 설치

**Certbot 설치:**
```bash
sudo apt update
sudo apt install certbot -y
```

**인증서 발급 (Standalone 방식):**
```bash
# Nginx 임시 정지
docker-compose -f docker-compose.prod.yml stop nginx

# 인증서 발급
sudo certbot certonly --standalone \
  -d coachdb-pilot.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# 인증서 파일 복사
sudo cp /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/*.pem

# Nginx 재시작
docker-compose -f docker-compose.prod.yml start nginx
```

**인증서 자동 갱신 (크론 설정):**
```bash
sudo crontab -e

# 추가 (매달 1일 새벽 3시):
0 3 1 * * certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/*.pem /home/coachdb/coachdb/nginx/ssl/ && docker-compose -f /home/coachdb/coachdb/docker-compose.prod.yml restart nginx"
```

### 3. Nginx 설정 확인

SSL 인증서 설치 후 nginx 설정이 올바른지 확인:

```bash
# 설정 테스트
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# 재시작
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## 📊 모니터링 및 로그

### 로그 확인

**전체 로그:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

**특정 서비스 로그:**
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f postgres
docker-compose -f docker-compose.prod.yml logs -f nginx
```

**최근 로그 (마지막 100줄):**
```bash
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

**에러만 필터링:**
```bash
docker-compose -f docker-compose.prod.yml logs backend | grep -i error
```

### 백업 로그

백업 스크립트 실행 로그:
```bash
tail -f backup/backup.log
```

### 시스템 리소스 모니터링

**실시간 리소스 사용량:**
```bash
docker stats
```

**디스크 사용량:**
```bash
df -h
docker system df
```

**메모리 사용량:**
```bash
free -h
```

---

## 🔒 보안 체크리스트

### 배포 전

- [ ] `.env.production`의 모든 기본값 변경
- [ ] SECRET_KEY 32자 이상 랜덤 문자열
- [ ] DB_PASSWORD 강력한 비밀번호 사용
- [ ] CORS_ORIGINS에 실제 도메인만 포함
- [ ] `.env.production` 파일 권한 600으로 설정
- [ ] Git에 `.env.production` 커밋하지 않기

### 배포 후

- [ ] SSL 인증서 설치 (HTTPS)
- [ ] 방화벽 설정 (80, 443만 오픈)
- [ ] SSH 키 기반 인증 사용
- [ ] root 직접 로그인 비활성화
- [ ] 정기 백업 크론 설정
- [ ] 파일럿 사용자에게 비밀번호 변경 안내
- [ ] 불필요한 포트 닫기 (5432, 6379 등)

### 권장 보안 설정

**파일 권한:**
```bash
chmod 600 .env.production
chmod 755 scripts/*.sh
chmod 700 nginx/ssl
chmod 600 nginx/ssl/*.pem
```

**방화벽 (UFW):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 🧪 테스트 시나리오

### 로컬 테스트 (개발자)

1. `scripts/local_test_prod.sh` 실행
2. http://localhost 접속
3. admin1@test.com / Pilot2025! 로그인
4. 새 프로젝트 생성 (템플릿 기반)
5. coach1@test.com으로 로그아웃 후 재로그인
6. 프로젝트에 지원
7. admin1으로 로그인 후 심사
8. 모든 기능 정상 동작 확인

### 파일럿 테스트 (실제 사용자)

[PILOT_TEST_GUIDE.md](docs/PILOT_TEST_GUIDE.md) 참조

---

## 📞 문제 해결

### 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs

# 특정 서비스 재시작
docker-compose -f docker-compose.prod.yml restart backend

# 전체 재시작
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL 상태 확인
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U coachdb

# 로그 확인
docker-compose -f docker-compose.prod.yml logs postgres

# 환경 변수 확인
docker-compose -f docker-compose.prod.yml exec backend env | grep DATABASE_URL
```

### 마이그레이션 오류

```bash
# 현재 버전 확인
docker-compose -f docker-compose.prod.yml exec backend alembic current

# 마이그레이션 히스토리
docker-compose -f docker-compose.prod.yml exec backend alembic history

# 강제 업그레이드
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 백업 복구 실패

```bash
# 백업 파일 무결성 확인
gunzip -t backup/coachdb_20250107_020000.sql.gz

# 수동 복구
gunzip -c backup/coachdb_20250107_020000.sql.gz > backup/restore.sql
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U coachdb -d coachdb < backup/restore.sql
```

### 디스크 공간 부족

```bash
# Docker 정리
docker system prune -a --volumes

# 오래된 백업 삭제
find backup -name "*.sql*" -mtime +30 -delete

# 오래된 로그 삭제
find backend/logs -name "*.log" -mtime +7 -delete
```

---

## 📚 관련 문서

- **[완전 설치 가이드](INSTALLATION_GUIDE.md)** - 로컬 개발 환경 구성
- **[빠른 배포 가이드](docs/QUICK_DEPLOY.md)** - 30분 배포 체크리스트
- **[상세 배포 가이드](docs/DEPLOYMENT_GUIDE.md)** - 프로덕션 배포 완전 가이드
- **[파일럿 테스트 가이드](docs/PILOT_TEST_GUIDE.md)** - 사용자 테스트 시나리오
- **[설문 시스템 설계서](docs/SURVEY_SYSTEM_DESIGN.md)** - 기술 명세
- **[비즈니스 리포트](docs/BUSINESS_REPORT.md)** - ROI 및 효과 분석

---

## ✅ 배포 완료 후 체크리스트

- [ ] 모든 컨테이너 실행 중 (`deployment_status.sh`)
- [ ] HTTPS 접속 가능 (SSL 인증서)
- [ ] 관리자 계정 로그인 성공
- [ ] 코치 계정 로그인 성공
- [ ] 프로젝트 생성 가능
- [ ] 지원서 작성 가능
- [ ] 심사 기능 정상 동작
- [ ] 파일 업로드 가능
- [ ] 자동 백업 크론 설정
- [ ] 파일럿 사용자 초대 완료
- [ ] 사용자 가이드 배포 완료

---

## 🎯 다음 단계

1. **로컬 검증 완료 후**: 서버 준비 및 실제 배포
2. **배포 완료 후**: 파일럿 사용자 초대 및 테스트
3. **파일럿 테스트 중**: 피드백 수집 및 버그 수정
4. **파일럿 완료 후**: 정식 출시 준비

---

## 📧 지원

문제 발생 시:
1. `deployment_status.sh`로 상태 확인
2. 로그 확인 (`docker-compose logs`)
3. [문제 해결](#-문제-해결) 섹션 참조
4. 개발팀 문의

---

**배포 성공을 기원합니다! 🚀**
