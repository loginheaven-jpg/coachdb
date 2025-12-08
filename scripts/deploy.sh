#!/bin/bash

###############################################################################
# CoachDB Production Deployment Script
# 이 스크립트는 서버에서 실행됩니다.
###############################################################################

set -e  # 오류 발생 시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수 정의
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 설정
PROJECT_DIR="/home/coachdb/coachdb"
BACKUP_DIR="$PROJECT_DIR/backup"
ENV_FILE="$PROJECT_DIR/.env.production"

log_info "CoachDB 배포 시작..."

# 1. 환경 변수 확인
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env.production 파일이 없습니다!"
    log_error ".env.production.example을 복사하고 수정하세요."
    exit 1
fi

log_info "환경 변수 로드 중..."
export $(grep -v '^#' $ENV_FILE | xargs)

# 2. 디렉토리 이동
cd $PROJECT_DIR

# 3. Git Pull (선택사항)
if [ -d ".git" ]; then
    log_info "최신 코드 가져오기..."
    git pull origin main
fi

# 4. 백업 생성
log_info "데이터베이스 백업 중..."
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 컨테이너가 실행 중인지 확인
if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    docker-compose -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U coachdb coachdb > $BACKUP_DIR/pre_deploy_$DATE.sql
    log_info "백업 완료: pre_deploy_$DATE.sql"
else
    log_warn "PostgreSQL 컨테이너가 실행 중이지 않아 백업을 건너뜁니다."
fi

# 5. 기존 컨테이너 정지
log_info "기존 컨테이너 정지 중..."
docker-compose -f docker-compose.prod.yml down

# 6. 이미지 빌드
log_info "Docker 이미지 빌드 중..."
docker-compose -f docker-compose.prod.yml build --no-cache

# 7. 컨테이너 시작
log_info "컨테이너 시작 중..."
docker-compose -f docker-compose.prod.yml up -d

# 8. 헬스 체크 대기
log_info "서비스 시작 대기 중..."
sleep 10

# Backend 헬스 체크
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker-compose -f docker-compose.prod.yml exec -T backend curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        log_info "Backend 정상 시작됨!"
        break
    fi
    RETRY=$((RETRY+1))
    log_warn "Backend 시작 대기 중... ($RETRY/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    log_error "Backend 시작 실패!"
    log_error "로그를 확인하세요: docker-compose -f docker-compose.prod.yml logs backend"
    exit 1
fi

# 9. 마이그레이션 실행
log_info "데이터베이스 마이그레이션 실행 중..."
docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

# 10. 컨테이너 상태 확인
log_info "컨테이너 상태 확인..."
docker-compose -f docker-compose.prod.yml ps

# 11. 로그 확인
log_info "최근 로그 확인..."
docker-compose -f docker-compose.prod.yml logs --tail=20 backend

# 12. 오래된 백업 정리 (30일 이상)
log_info "오래된 백업 정리 중..."
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# 13. 완료
log_info "========================================="
log_info "배포 완료!"
log_info "========================================="
log_info "접속 URL: https://coachdb-pilot.yourdomain.com"
log_info ""
log_info "유용한 명령어:"
log_info "  로그 확인: docker-compose -f docker-compose.prod.yml logs -f"
log_info "  재시작: docker-compose -f docker-compose.prod.yml restart"
log_info "  정지: docker-compose -f docker-compose.prod.yml down"
log_info "========================================="
