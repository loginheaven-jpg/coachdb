# 파일럿 배포 가이드

**프로덕션 환경 배포 완전 가이드**

---

## 📋 목차

1. [배포 개요](#1-배포-개요)
2. [사전 준비](#2-사전-준비)
3. [서버 설정](#3-서버-설정)
4. [배포 실행](#4-배포-실행)
5. [도메인 및 SSL 설정](#5-도메인-및-ssl-설정)
6. [모니터링 및 유지보수](#6-모니터링-및-유지보수)
7. [백업 및 복구](#7-백업-및-복구)
8. [문제 해결](#8-문제-해결)

---

## 1. 배포 개요

### 1.1 배포 아키텍처

```
Internet
    ↓
[Cloudflare / DNS]
    ↓
[Domain: coachdb-pilot.yourdomain.com]
    ↓ HTTPS (443)
┌─────────────────────────────────────────┐
│         서버 (VPS / Cloud VM)            │
│                                          │
│  ┌────────────────────────────────┐     │
│  │  Nginx (Reverse Proxy + SSL)   │     │
│  └────────────────────────────────┘     │
│              ↓ :80                      │
│  ┌────────────────────────────────┐     │
│  │  Frontend (React) :3000        │     │
│  └────────────────────────────────┘     │
│              ↓ API                      │
│  ┌────────────────────────────────┐     │
│  │  Backend (FastAPI) :8000       │     │
│  └────────────────────────────────┘     │
│              ↓ SQL                      │
│  ┌────────────────────────────────┐     │
│  │  PostgreSQL :5432              │     │
│  └────────────────────────────────┘     │
│                                          │
│  All running in Docker Containers       │
└─────────────────────────────────────────┘
```

### 1.2 권장 서버 스펙

**최소 사양** (파일럿 10~20명):
- CPU: 2 Core
- RAM: 4GB
- Storage: 50GB SSD
- 월 비용: 약 2~3만원

**권장 사양** (파일럿 50명 이상):
- CPU: 4 Core
- RAM: 8GB
- Storage: 100GB SSD
- 월 비용: 약 5~7만원

### 1.3 서비스 제공자 추천

| 서비스 | 장점 | 월 비용 | 추천도 |
|--------|------|---------|--------|
| **DigitalOcean** | 간단, 빠름, 한국 리전 | $24 (~3만원) | ⭐⭐⭐⭐⭐ |
| **AWS Lightsail** | 안정적, 확장 용이 | $20 (~2.5만원) | ⭐⭐⭐⭐ |
| **Vultr** | 가성비 좋음 | $18 (~2.2만원) | ⭐⭐⭐⭐ |
| **Cafe24** | 한국어 지원 | 3~5만원 | ⭐⭐⭐ |

**이 가이드는 DigitalOcean 기준으로 작성되었으나, 다른 서비스도 유사합니다.**

---

## 2. 사전 준비

### 2.1 필요한 것

- [ ] 서버 (VPS 또는 클라우드)
- [ ] 도메인 (예: yourdomain.com)
- [ ] GitHub 계정 (코드 저장소)
- [ ] SSH 클라이언트 (PuTTY, Terminal 등)
- [ ] 이메일 계정 (알림용)

### 2.2 도메인 구입

**추천 도메인 등록 업체**:
- 가비아: https://www.gabia.com (한국어)
- Cloudflare: https://www.cloudflare.com (영어, 저렴)
- GoDaddy: https://www.godaddy.com (영어)

**비용**: 연간 1~2만원 (.com 기준)

**서브도메인 설정 예시**:
```
coachdb-pilot.yourdomain.com  → 파일럿 서버
coachdb.yourdomain.com        → 정식 서버 (추후)
```

### 2.3 서버 생성 (DigitalOcean 예시)

1. **계정 생성**
   - https://www.digitalocean.com 가입
   - 결제 수단 등록 (신용카드)

2. **Droplet 생성**
   - "Create" → "Droplets" 클릭
   - **Region**: Singapore (한국과 가장 가까움)
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic → $24/mo (4GB RAM, 2 CPU)
   - **Authentication**: SSH Key 또는 Password
   - **Hostname**: coachdb-pilot
   - "Create Droplet" 클릭

3. **IP 주소 확인**
   - 생성 완료 후 IP 주소 메모 (예: 123.45.67.89)

---

## 3. 서버 설정

### 3.1 SSH 접속

**Windows (PowerShell)**:
```powershell
ssh root@123.45.67.89
```

**Mac / Linux**:
```bash
ssh root@123.45.67.89
```

비밀번호 입력 후 접속 성공

### 3.2 기본 설정

#### 시스템 업데이트

```bash
# 패키지 업데이트
apt update && apt upgrade -y

# 타임존 설정 (서울)
timedatectl set-timezone Asia/Seoul

# 한국어 로케일 설정
locale-gen ko_KR.UTF-8
```

#### 방화벽 설정

```bash
# UFW 방화벽 활성화
ufw allow OpenSSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw enable

# 상태 확인
ufw status
```

#### 일반 사용자 생성 (보안)

```bash
# 새 사용자 생성
adduser coachdb

# sudo 권한 부여
usermod -aG sudo coachdb

# 사용자 전환
su - coachdb
```

### 3.3 Docker 설치

```bash
# Docker 설치 스크립트 실행
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 로그아웃 후 재로그인 (그룹 권한 적용)
exit
# 다시 SSH 접속

# Docker 설치 확인
docker --version
docker-compose --version
```

**Expected Output**:
```
Docker version 24.0.x
Docker Compose version 2.x.x
```

### 3.4 Git 설치 및 코드 Clone

```bash
# Git 설치
sudo apt install git -y

# 코드 저장소 Clone
cd /home/coachdb
git clone https://github.com/yourusername/coachdb.git

# 또는 기존 코드 업로드
# scp -r C:\dev\coachdb coachdb@123.45.67.89:/home/coachdb/
```

---

## 4. 배포 실행

### 4.1 Production 환경 설정

#### docker-compose.prod.yml 생성

```bash
cd /home/coachdb/coachdb
nano docker-compose.prod.yml
```

**내용**:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: coachdb-postgres
    environment:
      POSTGRES_DB: coachdb
      POSTGRES_USER: coachdb
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
    restart: always
    networks:
      - coachdb-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U coachdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: coachdb-backend
    environment:
      DATABASE_URL: postgresql+asyncpg://coachdb:${DB_PASSWORD}@postgres:5432/coachdb
      SECRET_KEY: ${SECRET_KEY}
      ALGORITHM: HS256
      ACCESS_TOKEN_EXPIRE_MINUTES: 60
      CORS_ORIGINS: '["https://coachdb-pilot.yourdomain.com"]'
      ENVIRONMENT: production
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
    restart: always
    networks:
      - coachdb-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        VITE_API_BASE_URL: https://coachdb-pilot.yourdomain.com/api
    container_name: coachdb-frontend
    restart: always
    networks:
      - coachdb-network

  nginx:
    image: nginx:alpine
    container_name: coachdb-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
      - frontend
    restart: always
    networks:
      - coachdb-network

volumes:
  postgres_data:

networks:
  coachdb-network:
    driver: bridge
```

#### .env.production 생성

```bash
nano .env.production
```

**내용**:
```bash
# Database
DB_PASSWORD=your_strong_password_here_123!@#

# Backend
SECRET_KEY=your_secret_key_minimum_32_characters_long_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Frontend
VITE_API_BASE_URL=https://coachdb-pilot.yourdomain.com/api

# Email (선택)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Monitoring (선택)
SENTRY_DSN=https://...
```

**보안 팁**:
```bash
# 강력한 비밀번호 생성
openssl rand -base64 32

# SECRET_KEY 생성
openssl rand -hex 32
```

#### Dockerfile.prod 생성

**Backend**:
```bash
nano backend/Dockerfile.prod
```

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 앱 코드 복사
COPY . .

# 비root 사용자 생성
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Gunicorn으로 실행 (production)
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
```

**Frontend**:
```bash
nano frontend/Dockerfile.prod
```

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 빌드
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Nginx로 서빙
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

#### Nginx 설정

```bash
mkdir -p nginx
nano nginx/nginx.conf
```

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Upstream
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:80;
    }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name coachdb-pilot.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name coachdb-pilot.yourdomain.com;

        # SSL certificates (Let's Encrypt)
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # SSL settings
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # API proxy
        location /api {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket support (if needed)
        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;

            # SPA fallback
            try_files $uri $uri/ /index.html;
        }

        # Static files caching
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### 4.2 빌드 및 배포

```bash
# 환경 변수 로드
export $(cat .env.production | xargs)

# 빌드 및 시작
docker-compose -f docker-compose.prod.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f
```

**Expected Output**:
```
Creating coachdb-postgres ... done
Creating coachdb-backend  ... done
Creating coachdb-frontend ... done
Creating coachdb-nginx    ... done
```

### 4.3 데이터베이스 초기화

```bash
# 마이그레이션 실행
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Seed 데이터 생성
docker-compose -f docker-compose.prod.yml exec backend python scripts/seed_template_competency_items.py

# 테스트 데이터 생성 (선택)
docker-compose -f docker-compose.prod.yml exec backend python scripts/create_test_data.py
```

---

## 5. 도메인 및 SSL 설정

### 5.1 DNS 설정

**도메인 등록 업체 (가비아, Cloudflare 등)에서**:

```
Type: A
Name: coachdb-pilot
Value: 123.45.67.89 (서버 IP)
TTL: 3600
```

**확인**:
```bash
nslookup coachdb-pilot.yourdomain.com
# 서버 IP가 나오면 성공
```

### 5.2 SSL 인증서 (Let's Encrypt)

#### Certbot 설치

```bash
# Certbot 설치
sudo apt install certbot -y

# Nginx 정지
docker-compose -f docker-compose.prod.yml stop nginx

# 인증서 발급
sudo certbot certonly --standalone \
  -d coachdb-pilot.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# 인증서 경로
# /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/privkey.pem
```

#### 인증서 복사

```bash
# SSL 디렉토리 생성
mkdir -p /home/coachdb/coachdb/nginx/ssl

# 인증서 복사
sudo cp /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/fullchain.pem \
  /home/coachdb/coachdb/nginx/ssl/

sudo cp /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/privkey.pem \
  /home/coachdb/coachdb/nginx/ssl/

# 권한 설정
sudo chown -R coachdb:coachdb /home/coachdb/coachdb/nginx/ssl
```

#### Nginx 재시작

```bash
docker-compose -f docker-compose.prod.yml up -d nginx
```

#### 자동 갱신 설정

```bash
# Crontab 편집
sudo crontab -e

# 매월 1일 새벽 3시에 갱신
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/coachdb-pilot.yourdomain.com/*.pem /home/coachdb/coachdb/nginx/ssl/ && docker-compose -f /home/coachdb/coachdb/docker-compose.prod.yml restart nginx
```

### 5.3 접속 확인

```
https://coachdb-pilot.yourdomain.com
```

- ✅ HTTPS 자물쇠 아이콘 확인
- ✅ 로그인 페이지 로드
- ✅ API 응답 확인 (개발자 도구 Network 탭)

---

## 6. 모니터링 및 유지보수

### 6.1 컨테이너 상태 확인

```bash
# 실행 중인 컨테이너
docker ps

# 리소스 사용량
docker stats

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### 6.2 헬스 체크

```bash
# Backend 헬스 체크
curl https://coachdb-pilot.yourdomain.com/api/health

# Database 연결 확인
docker-compose -f docker-compose.prod.yml exec postgres psql -U coachdb -c "SELECT version();"
```

### 6.3 서버 모니터링 (선택)

#### Uptime Kuma 설치 (무료)

```bash
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  --restart always \
  louislam/uptime-kuma:1
```

접속: `http://123.45.67.89:3001`

모니터링 설정:
- URL: https://coachdb-pilot.yourdomain.com
- Interval: 60초
- 알림: 이메일, 카카오톡, Slack 등

---

## 7. 백업 및 복구

### 7.1 데이터베이스 백업

#### 자동 백업 스크립트

```bash
nano /home/coachdb/backup.sh
```

```bash
#!/bin/bash

# 설정
BACKUP_DIR="/home/coachdb/coachdb/backup"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="coachdb_${DATE}.sql"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# PostgreSQL 백업
docker-compose -f /home/coachdb/coachdb/docker-compose.prod.yml \
  exec -T postgres pg_dump -U coachdb coachdb > $BACKUP_DIR/$FILENAME

# 압축
gzip $BACKUP_DIR/$FILENAME

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $FILENAME.gz"
```

```bash
# 실행 권한
chmod +x /home/coachdb/backup.sh

# 테스트
/home/coachdb/backup.sh
```

#### Cron 설정 (매일 새벽 2시)

```bash
crontab -e

# 추가
0 2 * * * /home/coachdb/backup.sh >> /home/coachdb/backup.log 2>&1
```

### 7.2 복구

```bash
# 백업 파일 압축 해제
gunzip /home/coachdb/coachdb/backup/coachdb_20251105_020000.sql.gz

# 복구
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U coachdb coachdb < /home/coachdb/coachdb/backup/coachdb_20251105_020000.sql
```

### 7.3 전체 시스템 백업

```bash
# 코드 + 데이터 + 설정 전체 백업
tar -czf coachdb_full_backup_$(date +%Y%m%d).tar.gz \
  /home/coachdb/coachdb \
  /home/coachdb/coachdb/backup

# 원격 저장소에 백업 (선택)
# S3, Google Drive, Dropbox 등
```

---

## 8. 문제 해결

### 8.1 일반적인 문제

#### 문제 1: 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs backend

# 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart backend

# 전체 재빌드
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

#### 문제 2: 502 Bad Gateway

**원인**: Backend가 응답하지 않음

```bash
# Backend 상태 확인
docker-compose -f docker-compose.prod.yml ps backend

# Backend 로그
docker-compose -f docker-compose.prod.yml logs backend

# Backend 재시작
docker-compose -f docker-compose.prod.yml restart backend
```

#### 문제 3: 데이터베이스 연결 오류

```bash
# PostgreSQL 상태 확인
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U coachdb

# 연결 테스트
docker-compose -f docker-compose.prod.yml exec backend python -c "from app.database import engine; print('DB OK')"
```

#### 문제 4: 디스크 공간 부족

```bash
# 디스크 사용량 확인
df -h

# Docker 정리
docker system prune -a --volumes

# 오래된 백업 삭제
find /home/coachdb/coachdb/backup -name "*.gz" -mtime +30 -delete
```

#### 문제 5: 메모리 부족

```bash
# 메모리 사용량 확인
free -h

# 컨테이너별 메모리 사용량
docker stats --no-stream

# 스왑 메모리 추가
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 8.2 성능 최적화

#### Backend 워커 수 조정

```bash
# Gunicorn 워커 수 = (CPU 코어 * 2) + 1
# 2 Core → 5 workers
# 4 Core → 9 workers

# Dockerfile.prod 수정
CMD ["gunicorn", "app.main:app", "-w", "5", "-k", "uvicorn.workers.UvicornWorker", ...]
```

#### Database 튜닝

```yaml
# docker-compose.prod.yml
postgres:
  command: postgres -c max_connections=100 -c shared_buffers=256MB
```

#### Nginx 캐싱

```nginx
# nginx.conf에 추가
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

location /api {
    proxy_cache my_cache;
    proxy_cache_valid 200 10m;
    ...
}
```

### 8.3 보안 강화

#### 1. 정기 업데이트

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 이미지 업데이트
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

#### 2. 방화벽 강화

```bash
# 특정 IP만 SSH 허용
sudo ufw allow from 1.2.3.4 to any port 22

# Fail2ban 설치 (brute-force 방어)
sudo apt install fail2ban -y
```

#### 3. 비밀번호 정책

```bash
# .env.production 정기 변경 (3개월마다)
# 강력한 비밀번호 사용
# 다른 서비스와 다른 비밀번호
```

---

## 9. 배포 체크리스트

### 배포 전

- [ ] 서버 생성 완료
- [ ] 도메인 구입 및 DNS 설정
- [ ] SSL 인증서 발급
- [ ] .env.production 설정
- [ ] 백업 스크립트 설정

### 배포 시

- [ ] 코드 빌드 성공
- [ ] 모든 컨테이너 실행 중
- [ ] 데이터베이스 마이그레이션 완료
- [ ] Seed 데이터 생성 완료
- [ ] HTTPS 접속 확인

### 배포 후

- [ ] 헬스 체크 정상
- [ ] 로그인 테스트
- [ ] 주요 기능 테스트
- [ ] 모니터링 설정
- [ ] 백업 자동화 확인
- [ ] 파일럿 테스터에게 안내

---

## 부록

### A. 빠른 명령어 참조

```bash
# 배포
docker-compose -f docker-compose.prod.yml up -d --build

# 정지
docker-compose -f docker-compose.prod.yml down

# 재시작
docker-compose -f docker-compose.prod.yml restart

# 로그
docker-compose -f docker-compose.prod.yml logs -f

# 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 백업
/home/coachdb/backup.sh

# 복구
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U coachdb coachdb < backup.sql
```

### B. 연락처

- 기술 지원: tech@yourdomain.com
- 긴급 상황: 010-xxxx-xxxx

---

**배포 완료!** 🚀

파일럿 테스트를 시작하세요.
