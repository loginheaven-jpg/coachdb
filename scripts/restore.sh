#!/bin/bash

###############################################################################
# CoachDB Database Restore Script
# 사용법: ./restore.sh backup_file.sql.gz
###############################################################################

set -e

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
BACKUP_FILE=$1

# 파라미터 확인
if [ -z "$BACKUP_FILE" ]; then
    log_error "사용법: $0 <backup_file.sql.gz>"
    log_info "예시: $0 /home/coachdb/coachdb/backup/coachdb_20251105_020000.sql.gz"
    echo ""
    log_info "사용 가능한 백업 파일:"
    ls -lh $PROJECT_DIR/backup/coachdb_*.sql.gz
    exit 1
fi

# 파일 존재 확인
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "파일을 찾을 수 없습니다: $BACKUP_FILE"
    exit 1
fi

log_warn "========================================="
log_warn "경고: 현재 데이터베이스를 삭제하고 복구합니다!"
log_warn "백업 파일: $BACKUP_FILE"
log_warn "========================================="
read -p "계속하시겠습니까? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_info "취소되었습니다."
    exit 0
fi

cd $PROJECT_DIR

# 현재 데이터베이스 백업
log_info "현재 데이터베이스 백업 중..."
SAFETY_BACKUP="$PROJECT_DIR/backup/before_restore_$(date +%Y%m%d_%H%M%S).sql"
docker-compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U coachdb -Fc coachdb > $SAFETY_BACKUP
log_info "안전 백업 완료: $SAFETY_BACKUP"

# 압축 해제
if [[ $BACKUP_FILE == *.gz ]]; then
    log_info "압축 해제 중..."
    UNCOMPRESSED="${BACKUP_FILE%.gz}"
    gunzip -c $BACKUP_FILE > $UNCOMPRESSED
    RESTORE_FILE=$UNCOMPRESSED
else
    RESTORE_FILE=$BACKUP_FILE
fi

# 데이터베이스 삭제 및 재생성
log_info "데이터베이스 재생성 중..."
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U coachdb -c "DROP DATABASE IF EXISTS coachdb;"
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U coachdb -c "CREATE DATABASE coachdb;"

# 복구
log_info "데이터베이스 복구 중..."
docker-compose -f docker-compose.prod.yml exec -T postgres \
    pg_restore -U coachdb -d coachdb < $RESTORE_FILE

# 임시 파일 정리
if [ "$RESTORE_FILE" != "$BACKUP_FILE" ]; then
    rm $RESTORE_FILE
fi

# 마이그레이션 실행
log_info "마이그레이션 실행 중..."
docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

# 서비스 재시작
log_info "서비스 재시작 중..."
docker-compose -f docker-compose.prod.yml restart backend

log_info "========================================="
log_info "복구 완료!"
log_info "안전 백업: $SAFETY_BACKUP"
log_info "========================================="
