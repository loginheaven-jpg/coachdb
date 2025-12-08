#!/bin/bash

###############################################################################
# CoachDB Database Backup Script
# Cron: 0 2 * * * /home/coachdb/coachdb/scripts/backup.sh
###############################################################################

set -e

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# 설정
PROJECT_DIR="/home/coachdb/coachdb"
BACKUP_DIR="$PROJECT_DIR/backup"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="coachdb_${DATE}.sql"
KEEP_DAYS=7  # 보관 일수

log_info "백업 시작..."

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# PostgreSQL 백업
cd $PROJECT_DIR

if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    log_info "데이터베이스 덤프 중..."

    docker-compose -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U coachdb -Fc coachdb > $BACKUP_DIR/$FILENAME

    # 압축
    log_info "압축 중..."
    gzip $BACKUP_DIR/$FILENAME

    # 파일 크기 확인
    SIZE=$(du -h $BACKUP_DIR/${FILENAME}.gz | cut -f1)
    log_info "백업 완료: ${FILENAME}.gz (크기: $SIZE)"

    # 오래된 백업 삭제
    log_info "${KEEP_DAYS}일 이상 된 백업 삭제 중..."
    find $BACKUP_DIR -name "coachdb_*.sql.gz" -mtime +$KEEP_DAYS -delete

    # 백업 목록
    log_info "현재 백업 목록:"
    ls -lh $BACKUP_DIR/coachdb_*.sql.gz | tail -5

    # 선택사항: 원격 저장소에 업로드 (S3, Google Drive 등)
    # upload_to_s3 $BACKUP_DIR/${FILENAME}.gz

else
    log_error "PostgreSQL 컨테이너가 실행 중이지 않습니다!"
    exit 1
fi

log_info "백업 완료!"
