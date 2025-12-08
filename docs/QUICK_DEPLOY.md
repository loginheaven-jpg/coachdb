# 빠른 배포 가이드 (Quick Deploy)

**30분 안에 배포 완료하기** ⚡

---

## 🎯 배포 전 체크리스트

- [ ] 서버 준비 완료 (DigitalOcean, AWS 등)
- [ ] 도메인 구입 완료
- [ ] SSH 접속 가능
- [ ] 모든 문서 확인 완료

---

## 📦 Step 1: 서버 접속 및 기본 설정 (5분)

```bash
# SSH 접속
ssh root@YOUR_SERVER_IP

# 시스템 업데이트
apt update && apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com | sh

# Git 설치
apt install git -y

# 사용자 생성
adduser coachdb
usermod -aG sudo,docker coachdb

# 사용자 전환
su - coachdb
```

---

## 📂 Step 2: 코드 배포 (3분)

```bash
# 코드 Clone
cd ~
git clone https://github.com/yourusername/coachdb.git
cd coachdb

# 또는 로컬에서 업로드
# scp -r C:\dev\coachdb coachdb@YOUR_SERVER_IP:~/
```

---

## ⚙️ Step 3: 환경 설정 (5분)

```bash
# .env.production 생성
cp .env.production.example .env.production
nano .env.production
```

**필수 수정 항목**:
```bash
# 강력한 비밀번호 생성
DB_PASSWORD=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -hex 32)

# 도메인 설정
CORS_ORIGINS=["https://your-domain.com"]
VITE_API_BASE_URL=https://your-domain.com/api
```

**저장**: `Ctrl+X` → `Y` → `Enter`

---

## 🚀 Step 4: 배포 실행 (10분)

```bash
# 실행 권한 부여
chmod +x scripts/*.sh

# 배포 스크립트 실행
./scripts/deploy.sh
```

**기다리는 동안 확인**:
- ✅ 이미지 빌드 중...
- ✅ 컨테이너 시작 중...
- ✅ 헬스 체크 중...
- ✅ 마이그레이션 실행 중...

**완료 메시지**:
```
✅ 배포 완료!
========================================
접속 URL: https://your-domain.com
========================================
```

---

## 🌐 Step 5: DNS 및 SSL 설정 (7분)

### DNS 설정 (도메인 등록 업체에서)

```
Type: A
Name: your-subdomain (또는 @)
Value: YOUR_SERVER_IP
TTL: 3600
```

**확인**:
```bash
nslookup your-domain.com
# IP가 맞으면 성공
```

### SSL 인증서 발급

```bash
# Certbot 설치
sudo apt install certbot -y

# Nginx 임시 중지
docker-compose -f docker-compose.prod.yml stop nginx

# 인증서 발급
sudo certbot certonly --standalone \
  -d your-domain.com \
  --email your-email@example.com \
  --agree-tos

# 인증서 복사
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
sudo chown -R coachdb:coachdb nginx/ssl

# Nginx 재시작
docker-compose -f docker-compose.prod.yml up -d nginx
```

---

## 👥 Step 6: 파일럿 사용자 생성 (3분)

```bash
# 파일럿 사용자 생성 (관리자 2명 + 코치 10명)
docker-compose -f docker-compose.prod.yml exec backend \
  python /app/scripts/create_pilot_users.py

# 출력 확인:
# ✅ 생성 완료: 12명
#
# 📋 로그인 정보:
# admin1@test.com / Pilot2025!
# admin2@test.com / Pilot2025!
# coach1@test.com / Pilot2025!
# ...
```

---

## ✅ Step 7: 배포 확인 (2분)

### 브라우저에서 확인

```
https://your-domain.com
```

- [ ] HTTPS 자물쇠 표시 ✅
- [ ] 로그인 페이지 로드 ✅
- [ ] 로그인 성공 ✅
- [ ] 과제 목록 확인 ✅

### 서버에서 확인

```bash
# 컨테이너 상태
docker-compose -f docker-compose.prod.yml ps
# 모두 "Up" 상태여야 함

# 헬스 체크
curl https://your-domain.com/api/health
# {"status":"healthy"} 응답

# 로그 확인
docker-compose -f docker-compose.prod.yml logs --tail=50
```

---

## 🔧 Step 8: 백업 설정 (2분)

```bash
# 백업 스크립트 테스트
./scripts/backup.sh

# Cron 등록 (매일 새벽 2시)
crontab -e

# 추가
0 2 * * * /home/coachdb/coachdb/scripts/backup.sh >> /home/coachdb/backup.log 2>&1
```

---

## 📊 Step 9: 모니터링 설정 (선택, 3분)

```bash
# Uptime Kuma 설치
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  --restart always \
  louislam/uptime-kuma:1

# 접속: http://YOUR_SERVER_IP:3001
# 모니터링 추가: https://your-domain.com
```

---

## 🎉 완료!

총 소요 시간: **약 30분**

### 다음 단계

1. **파일럿 테스터에게 안내**
   - 접속 URL 공유
   - 테스트 계정 배포
   - 테스트 가이드 배포

2. **모니터링 시작**
   - 시스템 로그 확인
   - 에러 발생 모니터링
   - 성능 측정

3. **피드백 수집 준비**
   - 피드백 채널 오픈
   - 정기 미팅 일정 공유

---

## 🆘 문제 발생 시

### 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs backend

# 재시작
docker-compose -f docker-compose.prod.yml restart
```

### 502 Bad Gateway

```bash
# Backend 상태 확인
docker-compose -f docker-compose.prod.yml ps backend

# Backend 로그
docker-compose -f docker-compose.prod.yml logs backend

# 재시작
docker-compose -f docker-compose.prod.yml restart backend
```

### SSL 인증서 오류

```bash
# 인증서 확인
sudo certbot certificates

# 인증서 재발급
sudo certbot certonly --standalone -d your-domain.com --force-renewal

# 인증서 복사 (다시)
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem nginx/ssl/
```

### 데이터베이스 연결 오류

```bash
# PostgreSQL 상태
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U coachdb

# 로그 확인
docker-compose -f docker-compose.prod.yml logs postgres

# 재시작
docker-compose -f docker-compose.prod.yml restart postgres
```

---

## 📞 지원

**긴급 상황**:
- 이메일: support@yourdomain.com
- 전화: 010-xxxx-xxxx

**문서**:
- 상세 배포 가이드: `docs/DEPLOYMENT_GUIDE.md`
- 파일럿 테스트 가이드: `docs/PILOT_TEST_GUIDE.md`
- 문제 해결: `docs/DEPLOYMENT_GUIDE.md` 섹션 8

---

## 🔑 중요 명령어 요약

```bash
# 배포
./scripts/deploy.sh

# 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 로그
docker-compose -f docker-compose.prod.yml logs -f

# 재시작
docker-compose -f docker-compose.prod.yml restart

# 정지
docker-compose -f docker-compose.prod.yml down

# 백업
./scripts/backup.sh

# 복구
./scripts/restore.sh backup/coachdb_20251105.sql.gz
```

---

**배포 성공을 기원합니다!** 🚀✨
