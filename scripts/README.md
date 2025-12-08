# CoachDB Deployment Scripts

이 디렉토리에는 CoachDB 파일럿 배포를 위한 모든 스크립트가 포함되어 있습니다.

## 📜 스크립트 목록

### 🌟 메인 스크립트

#### 1. `deploy_helper.sh` - 인터랙티브 배포 도우미

**가장 추천하는 방법!** 단계별 안내와 함께 배포를 진행합니다.

```bash
bash scripts/deploy_helper.sh
```

**기능:**
- 배포 환경 선택 (로컬/서버)
- Pre-flight 자동 체크
- 환경 변수 대화형 설정
- 배포 자동 실행
- 파일럿 사용자 생성
- 상태 확인
- SSL 설정 안내
- 백업 크론 설정

**사용 시점:** 처음 배포할 때

---

### 🔍 검증 스크립트

#### 2. `preflight_check.sh` - 배포 전 필수 항목 체크

배포 전 모든 필수 조건을 자동으로 확인합니다.

```bash
bash scripts/preflight_check.sh
```

**체크 항목:**
- ✓ Docker 설치 및 실행
- ✓ 필수 파일 존재
- ✓ 환경 변수 검증
- ✓ 디렉토리 구조
- ✓ 포트 사용 가능
- ✓ 디스크 공간
- ✓ 스크립트 권한

**결과:**
- ✓ 녹색: 통과
- ⚠ 노란색: 경고
- ✗ 빨간색: 오류

**사용 시점:** 배포 전 검증

---

### 🧪 테스트 스크립트

#### 3. `local_test_prod.sh` - 로컬 프로덕션 테스트

Windows 환경에서 프로덕션 설정을 테스트합니다.

```bash
bash scripts/local_test_prod.sh
```

**수행 작업:**
1. 테스트용 환경 변수 자동 생성
2. 프로덕션 이미지 빌드
3. 컨테이너 시작 및 헬스 체크
4. 마이그레이션 실행
5. 파일럿 사용자 생성

**접속:**
- Frontend: http://localhost
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

**사용 시점:** 실제 배포 전 로컬 검증

---

### 🚀 배포 스크립트

#### 4. `deploy.sh` - 실제 배포

서버에서 실제 배포를 자동으로 수행합니다.

```bash
bash scripts/deploy.sh
```

**수행 작업:**
1. 환경 변수 로드
2. Git pull (선택)
3. 데이터베이스 자동 백업
4. 컨테이너 정지
5. 새 이미지 빌드
6. 컨테이너 시작
7. 헬스 체크
8. 마이그레이션 실행

**사용 시점:** 서버 배포 및 업데이트

---

### 💾 백업/복구 스크립트

#### 5. `backup.sh` - 데이터베이스 백업

데이터베이스를 백업합니다.

```bash
bash scripts/backup.sh
```

**특징:**
- Custom 포맷 (pg_dump -Fc)
- Gzip 압축
- 7일 이상 백업 자동 삭제
- 백업 목록 출력

**크론 설정 (매일 새벽 2시):**
```bash
crontab -e
# 추가:
0 2 * * * /home/coachdb/coachdb/scripts/backup.sh >> /home/coachdb/coachdb/backup/backup.log 2>&1
```

**사용 시점:** 수동 백업 또는 크론 자동 실행

---

#### 6. `restore.sh` - 데이터베이스 복구

백업에서 데이터베이스를 복구합니다.

```bash
bash scripts/restore.sh <backup_file.sql.gz>
```

**예시:**
```bash
bash scripts/restore.sh backup/coachdb_20250107_020000.sql.gz
```

**안전 기능:**
- 복구 전 현재 DB 자동 백업
- 확인 프롬프트
- 압축 파일 자동 감지
- 마이그레이션 자동 실행

**사용 시점:** 데이터 복구 필요시

---

### 📊 모니터링 스크립트

#### 7. `deployment_status.sh` - 배포 상태 확인

실행 중인 시스템의 상태를 종합적으로 확인합니다.

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

**사용 시점:** 언제든지 상태 확인 필요시

---

### 👥 사용자 관리 스크립트

#### 8. `create_pilot_users.py` - 파일럿 사용자 생성

테스트용 사용자 계정을 자동으로 생성합니다.

```bash
# Docker 컨테이너 내부에서
docker-compose -f docker-compose.prod.yml exec backend python scripts/create_pilot_users.py
```

**생성되는 계정:**
- 관리자 2명: admin1@test.com, admin2@test.com
- 코치 10명: coach1@test.com ~ coach10@test.com
- 비밀번호: Pilot2025!

**사용 시점:** 초기 배포 후 테스트 계정 생성

---

## 📋 사용 시나리오

### 시나리오 1: 처음 배포 (초보자)

```bash
# 1. 인터랙티브 배포 도우미 실행
bash scripts/deploy_helper.sh

# 스크립트가 모든 것을 안내합니다!
```

### 시나리오 2: 로컬 테스트 후 배포 (신중한 접근)

```bash
# 1. Pre-flight 체크
bash scripts/preflight_check.sh

# 2. 로컬에서 프로덕션 테스트
bash scripts/local_test_prod.sh

# 3. http://localhost 접속 테스트

# 4. 문제 없으면 서버에 배포
bash scripts/deploy.sh
```

### 시나리오 3: 수동 배포 (고급 사용자)

```bash
# 1. Pre-flight 체크
bash scripts/preflight_check.sh

# 2. 환경 변수 수정
nano .env.production

# 3. 배포
bash scripts/deploy.sh

# 4. 파일럿 사용자 생성
docker-compose -f docker-compose.prod.yml exec backend python scripts/create_pilot_users.py

# 5. 상태 확인
bash scripts/deployment_status.sh
```

### 시나리오 4: 정기 백업

```bash
# 수동 백업
bash scripts/backup.sh

# 또는 크론 설정 (자동)
crontab -e
# 추가: 0 2 * * * /path/to/backup.sh
```

### 시나리오 5: 문제 발생 및 복구

```bash
# 1. 상태 확인
bash scripts/deployment_status.sh

# 2. 로그 확인
docker-compose -f docker-compose.prod.yml logs

# 3. 백업에서 복구
bash scripts/restore.sh backup/coachdb_20250107_020000.sql.gz
```

---

## 🔧 스크립트 실행 권한 설정

Linux/Mac에서 스크립트가 실행되지 않으면:

```bash
# 모든 스크립트에 실행 권한 부여
chmod +x scripts/*.sh

# 또는 개별 스크립트
chmod +x scripts/deploy_helper.sh
chmod +x scripts/preflight_check.sh
chmod +x scripts/local_test_prod.sh
chmod +x scripts/deploy.sh
chmod +x scripts/backup.sh
chmod +x scripts/restore.sh
chmod +x scripts/deployment_status.sh
```

---

## 💡 팁 & 트릭

### 1. 로그 실시간 확인

```bash
# 전체 로그
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스
docker-compose -f docker-compose.prod.yml logs -f backend

# 에러만 필터링
docker-compose -f docker-compose.prod.yml logs backend | grep -i error
```

### 2. 빠른 재시작

```bash
# 특정 서비스만
docker-compose -f docker-compose.prod.yml restart backend

# 전체
docker-compose -f docker-compose.prod.yml restart
```

### 3. 디스크 공간 정리

```bash
# Docker 정리
docker system prune -a

# 오래된 백업 삭제
find backup -name "*.sql*" -mtime +30 -delete
```

### 4. 데이터베이스 직접 접근

```bash
# PostgreSQL 콘솔
docker-compose -f docker-compose.prod.yml exec postgres psql -U coachdb -d coachdb

# SQL 실행
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U coachdb -d coachdb -c "SELECT COUNT(*) FROM users;"
```

---

## 📞 문제 해결

### 스크립트가 실행되지 않음

```bash
# 권한 확인
ls -l scripts/*.sh

# 실행 권한 부여
chmod +x scripts/*.sh

# 줄바꿈 문자 확인 (Windows에서 작성한 경우)
dos2unix scripts/*.sh  # dos2unix 설치 필요
```

### 배포 실패

```bash
# 1. Pre-flight 다시 체크
bash scripts/preflight_check.sh

# 2. 환경 변수 확인
cat .env.production

# 3. Docker 상태 확인
docker ps -a

# 4. 로그 확인
docker-compose -f docker-compose.prod.yml logs
```

### 백업 실패

```bash
# PostgreSQL 컨테이너 확인
docker-compose -f docker-compose.prod.yml ps postgres

# 백업 디렉토리 권한
ls -ld backup/
chmod 755 backup/

# 수동 백업
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U coachdb -Fc coachdb > backup/manual_$(date +%Y%m%d).sql
```

---

## 📚 관련 문서

- **[DEPLOY_README.md](../DEPLOY_README.md)** - 배포 스크립트 상세 설명
- **[DEPLOYMENT_COMPLETE.md](../DEPLOYMENT_COMPLETE.md)** - 배포 준비 완료 안내
- **[docs/QUICK_DEPLOY.md](../docs/QUICK_DEPLOY.md)** - 30분 배포 가이드
- **[docs/DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md)** - 완전 배포 가이드

---

## ✅ 체크리스트

배포 전:
- [ ] `preflight_check.sh` 통과
- [ ] `.env.production` 설정 완료
- [ ] 로컬 테스트 완료 (선택)

배포 중:
- [ ] `deploy.sh` 또는 `deploy_helper.sh` 실행
- [ ] 컨테이너 정상 시작 확인
- [ ] 파일럿 사용자 생성

배포 후:
- [ ] `deployment_status.sh`로 상태 확인
- [ ] 웹 브라우저 접속 테스트
- [ ] SSL 인증서 설치
- [ ] 자동 백업 크론 설정
- [ ] 파일럿 사용자 초대

---

**배포 성공을 기원합니다! 🚀**
