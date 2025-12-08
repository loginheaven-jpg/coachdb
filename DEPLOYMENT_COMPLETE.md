# 🚀 CoachDB 파일럿 배포 준비 완료

## 배포 준비 상태: ✅ 완료

CoachDB 시스템이 파일럿 배포를 위해 완전히 준비되었습니다!

---

## 📦 배포 패키지 내용

### 1. 프로덕션 설정 파일

| 파일 | 설명 | 상태 |
|------|------|------|
| `docker-compose.prod.yml` | 프로덕션 Docker 구성 | ✅ |
| `backend/Dockerfile.prod` | 백엔드 프로덕션 이미지 | ✅ |
| `frontend/Dockerfile.prod` | 프론트엔드 프로덕션 이미지 | ✅ |
| `nginx/nginx.conf` | Nginx 리버스 프록시 설정 | ✅ |
| `.env.production.example` | 환경 변수 템플릿 | ✅ |

### 2. 배포 스크립트 (scripts/)

| 스크립트 | 목적 | 사용 시점 |
|----------|------|-----------|
| `deploy_helper.sh` | 🌟 **인터랙티브 배포 도우미** | 처음 배포시 |
| `preflight_check.sh` | 배포 전 필수 항목 체크 | 배포 전 검증 |
| `local_test_prod.sh` | 로컬에서 프로덕션 테스트 | 로컬 검증 |
| `deploy.sh` | 자동화된 실제 배포 | 서버 배포 |
| `backup.sh` | 데이터베이스 백업 | 정기 백업 |
| `restore.sh` | 데이터베이스 복구 | 복구 필요시 |
| `deployment_status.sh` | 배포 상태 확인 | 배포 후 점검 |
| `create_pilot_users.py` | 파일럿 사용자 생성 | 초기 설정 |

### 3. 문서

| 문서 | 대상 독자 | 내용 |
|------|-----------|------|
| **DEPLOY_README.md** | DevOps/개발자 | 배포 스크립트 상세 설명 |
| **docs/QUICK_DEPLOY.md** | 모든 사용자 | 30분 배포 체크리스트 |
| **docs/DEPLOYMENT_GUIDE.md** | DevOps/관리자 | 완전한 배포 가이드 |
| **docs/PILOT_TEST_GUIDE.md** | 파일럿 테스터 | 사용자 테스트 시나리오 |
| **INSTALLATION_GUIDE.md** | 개발자 | 로컬 개발 환경 구성 |
| **docs/SURVEY_SYSTEM_DESIGN.md** | 개발자/아키텍트 | 기술 설계 문서 |
| **docs/BUSINESS_REPORT.md** | 경영진/의사결정자 | ROI 및 비즈니스 가치 |

---

## 🎯 배포 방법 선택

### 방법 1: 인터랙티브 배포 (추천 ⭐)

가장 쉬운 방법! 스크립트가 단계별로 안내합니다.

```bash
bash scripts/deploy_helper.sh
```

**특징:**
- 🎓 초보자 친화적
- 🤖 자동 검증 및 안내
- ⚠️ 실시간 오류 감지
- 📝 단계별 설명 제공

### 방법 2: 빠른 배포 (30분)

체크리스트 따라하기:

```bash
# 1. 가이드 열기
cat docs/QUICK_DEPLOY.md

# 2. 체크리스트대로 진행
# ✅ 항목을 하나씩 완료
```

### 방법 3: 완전 수동 배포

완전한 제어가 필요한 경우:

```bash
# 1. 상세 가이드 참조
cat docs/DEPLOYMENT_GUIDE.md

# 2. 각 단계 수동 실행
```

### 방법 4: 로컬 테스트 (Windows)

실제 배포 전 로컬에서 테스트:

```bash
# 프로덕션 설정을 로컬에서 테스트
bash scripts/local_test_prod.sh

# 접속: http://localhost
```

---

## 🔍 배포 전 체크리스트

### Windows에서 로컬 테스트

- [ ] Docker Desktop 실행 중
- [ ] WSL 2 활성화
- [ ] `bash scripts/preflight_check.sh` 통과
- [ ] `bash scripts/local_test_prod.sh` 실행
- [ ] http://localhost 접속 가능
- [ ] admin1@test.com / Pilot2025! 로그인 성공
- [ ] 프로젝트 생성/지원 테스트 완료

### Linux 서버 실제 배포

- [ ] 서버 준비 (Ubuntu 22.04 권장)
- [ ] Docker & Docker Compose 설치
- [ ] 도메인 DNS A 레코드 설정
- [ ] 방화벽 포트 오픈 (80, 443)
- [ ] `.env.production` 설정 완료
- [ ] `bash scripts/deploy.sh` 실행
- [ ] SSL 인증서 설치 (Let's Encrypt)
- [ ] HTTPS 접속 확인
- [ ] 파일럿 사용자 생성
- [ ] 자동 백업 크론 설정

---

## 💡 빠른 시작 가이드

### 1분 안에 시작하기

```bash
# Step 1: 인터랙티브 배포 도우미 실행
bash scripts/deploy_helper.sh

# 스크립트가 모든 것을 안내합니다!
# 1. 로컬/서버 선택
# 2. 자동 검증
# 3. 환경 변수 설정
# 4. 배포 실행
# 5. 테스트 사용자 생성
# 6. 상태 확인
# 7. SSL 설정 안내
# 8. 백업 크론 설정
```

### 상태 확인

```bash
# 언제든지 시스템 상태 확인
bash scripts/deployment_status.sh
```

---

## 🎓 스크립트 사용법

### 1. deploy_helper.sh - 인터랙티브 배포

```bash
bash scripts/deploy_helper.sh
```

**기능:**
- 배포 환경 선택 (로컬/서버)
- Pre-flight 자동 체크
- 환경 변수 대화형 설정
- 자동 배포 실행
- 파일럿 사용자 생성
- 상태 확인
- SSL 설정 안내 (서버 배포시)
- 백업 크론 설정 (서버 배포시)

### 2. preflight_check.sh - 배포 전 검증

```bash
bash scripts/preflight_check.sh
```

**검증 항목:**
- ✓ Docker 설치 및 실행
- ✓ 필수 파일 존재
- ✓ 환경 변수 검증
- ✓ 디렉토리 구조
- ✓ 포트 사용 가능
- ✓ 디스크 공간
- ✓ 스크립트 권한

### 3. local_test_prod.sh - 로컬 테스트

```bash
bash scripts/local_test_prod.sh
```

**수행 작업:**
1. 테스트용 환경 변수 자동 생성
2. 프로덕션 이미지 빌드
3. 컨테이너 시작
4. 헬스 체크
5. 마이그레이션 실행
6. 파일럿 사용자 생성 (선택)
7. 접속 정보 출력

**접속:**
- Frontend: http://localhost
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 4. deployment_status.sh - 상태 확인

```bash
bash scripts/deployment_status.sh
```

**확인 항목:**
- 컨테이너 실행 상태
- 서비스 헬스 체크
- 데이터베이스 통계
- 디스크 사용량
- 백업 상태
- 최근 에러 로그
- 리소스 사용량
- 업타임 정보

---

## 🔐 보안 설정

### 필수 보안 항목

1. **환경 변수 보안**
   ```bash
   # SECRET_KEY 생성 (32자 이상)
   openssl rand -hex 32

   # 강력한 DB 비밀번호
   openssl rand -base64 24
   ```

2. **파일 권한 설정**
   ```bash
   chmod 600 .env.production
   chmod 700 nginx/ssl
   chmod 600 nginx/ssl/*.pem
   ```

3. **방화벽 설정**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

4. **SSL 인증서 (Let's Encrypt)**
   ```bash
   # deploy_helper.sh에서 자동 안내
   # 또는 수동 설정
   sudo certbot certonly --standalone -d your-domain.com
   ```

---

## 📊 파일럿 테스트 계정

### 자동 생성되는 계정

**관리자 (2명):**
- admin1@test.com / Pilot2025!
- admin2@test.com / Pilot2025!

**코치 (10명):**
- coach1@test.com / Pilot2025!
- coach2@test.com / Pilot2025!
- ...
- coach10@test.com / Pilot2025!

**⚠️ 보안 주의:**
- 첫 로그인 후 반드시 비밀번호 변경 안내
- 실제 사용자 추가 후 테스트 계정 비활성화 고려

---

## 🛠️ 유용한 명령어

### Docker 관리

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그
docker-compose -f docker-compose.prod.yml logs -f backend

# 재시작
docker-compose -f docker-compose.prod.yml restart

# 정지
docker-compose -f docker-compose.prod.yml down

# 재배포
bash scripts/deploy.sh
```

### 데이터베이스

```bash
# 백업
bash scripts/backup.sh

# 복구
bash scripts/restore.sh backup/coachdb_20250107_020000.sql.gz

# 백업 목록
ls -lh backup/coachdb_*.sql.gz
```

### 상태 확인

```bash
# 전체 상태
bash scripts/deployment_status.sh

# 컨테이너 상태
docker-compose -f docker-compose.prod.yml ps

# 리소스 사용
docker stats
```

---

## 📞 문제 해결

### 배포 실패시

```bash
# 1. Pre-flight 체크
bash scripts/preflight_check.sh

# 2. 로그 확인
docker-compose -f docker-compose.prod.yml logs

# 3. 환경 변수 확인
cat .env.production

# 4. 재배포
bash scripts/deploy.sh
```

### 서비스 응답 없음

```bash
# 1. 상태 확인
bash scripts/deployment_status.sh

# 2. 특정 서비스 재시작
docker-compose -f docker-compose.prod.yml restart backend

# 3. 전체 재시작
docker-compose -f docker-compose.prod.yml restart
```

### 데이터 복구 필요

```bash
# 1. 백업 목록 확인
ls -lh backup/

# 2. 복구 실행
bash scripts/restore.sh backup/coachdb_20250107_020000.sql.gz
```

---

## 🎯 다음 단계

### 로컬 테스트 완료 후

1. ✅ 로컬에서 모든 기능 테스트
2. 🌐 서버 준비 (DigitalOcean, AWS 등)
3. 🚀 실제 배포 실행
4. 🔒 SSL 인증서 설치
5. 👥 파일럿 사용자 초대
6. 📊 피드백 수집

### 배포 완료 후

1. 📧 파일럿 사용자에게 접속 정보 전달
2. 📝 [PILOT_TEST_GUIDE.md](docs/PILOT_TEST_GUIDE.md) 배포
3. 🔄 정기 백업 확인
4. 📈 사용 현황 모니터링
5. 🐛 버그 리포트 수집
6. 🔧 개선 사항 반영

---

## 📚 참고 문서

### 배포 관련
- **[DEPLOY_README.md](DEPLOY_README.md)** - 배포 스크립트 상세 설명
- **[docs/QUICK_DEPLOY.md](docs/QUICK_DEPLOY.md)** - 30분 배포 가이드
- **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** - 완전 배포 가이드

### 테스트 관련
- **[docs/PILOT_TEST_GUIDE.md](docs/PILOT_TEST_GUIDE.md)** - 파일럿 테스트 시나리오

### 기술 문서
- **[docs/SURVEY_SYSTEM_DESIGN.md](docs/SURVEY_SYSTEM_DESIGN.md)** - 시스템 설계서
- **[docs/API_REFERENCE_SURVEY.md](docs/API_REFERENCE_SURVEY.md)** - API 레퍼런스

### 비즈니스
- **[docs/BUSINESS_REPORT.md](docs/BUSINESS_REPORT.md)** - ROI 및 효과 분석

### 개발 환경
- **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)** - 로컬 개발 환경
- **[QUICK_START_CHECKLIST.md](QUICK_START_CHECKLIST.md)** - 빠른 시작

---

## ✅ 배포 준비 완료!

모든 배포 파일과 스크립트가 준비되었습니다.

**이제 시작하세요:**

```bash
# Windows에서 로컬 테스트
bash scripts/local_test_prod.sh

# 또는 서버에 배포
bash scripts/deploy_helper.sh
```

**파일럿 배포 성공을 기원합니다! 🚀**

---

**문의사항:**
- 기술 문제: 개발팀
- 사용 가이드: [PILOT_TEST_GUIDE.md](docs/PILOT_TEST_GUIDE.md)
- 배포 이슈: [DEPLOY_README.md](DEPLOY_README.md)

**생성일:** 2025-01-07
**버전:** 1.0.0 (Pilot)
**상태:** ✅ 배포 준비 완료
