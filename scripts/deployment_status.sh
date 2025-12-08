#!/bin/bash

###############################################################################
# CoachDB Deployment Status Checker
# 배포된 시스템의 상태를 확인
###############################################################################

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}"
}

# 배너
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════╗
║     CoachDB Deployment Status            ║
╚═══════════════════════════════════════════╝
EOF
echo -e "${NC}"

# 프로젝트 디렉토리 확인
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    log_error "docker-compose 파일을 찾을 수 없습니다"
    exit 1
fi

# 1. 컨테이너 상태
log_section "1. 컨테이너 상태"

echo ""
docker-compose -f $COMPOSE_FILE ps
echo ""

# 각 서비스 상태 체크
SERVICES=("postgres" "backend" "frontend" "nginx")
for service in "${SERVICES[@]}"; do
    if docker-compose -f $COMPOSE_FILE ps $service | grep -q "Up"; then
        log_info "$service: 실행 중"
    else
        log_error "$service: 정지됨"
    fi
done

# 2. 헬스 체크
log_section "2. 서비스 헬스 체크"

# PostgreSQL
if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U coachdb > /dev/null 2>&1; then
    log_info "PostgreSQL: 정상"
else
    log_error "PostgreSQL: 응답 없음"
fi

# Backend API
if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
    log_info "Backend API: 정상"

    # API 버전 정보 (있을 경우)
    VERSION=$(curl -s http://localhost:8000/api/health | grep -o '"version":"[^"]*' | cut -d'"' -f4)
    if [ -n "$VERSION" ]; then
        echo "  버전: $VERSION"
    fi
else
    log_error "Backend API: 접근 불가"
fi

# Frontend
if curl -f http://localhost/ > /dev/null 2>&1; then
    log_info "Frontend: 정상"
else
    log_warn "Frontend: 접근 불가"
fi

# 3. 데이터베이스 정보
log_section "3. 데이터베이스 정보"

if docker-compose -f $COMPOSE_FILE exec -T postgres psql -U coachdb -d coachdb -c "\dt" > /dev/null 2>&1; then
    TABLE_COUNT=$(docker-compose -f $COMPOSE_FILE exec -T postgres psql -U coachdb -d coachdb -tc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" | xargs)
    log_info "테이블 수: $TABLE_COUNT"

    USER_COUNT=$(docker-compose -f $COMPOSE_FILE exec -T postgres psql -U coachdb -d coachdb -tc "SELECT COUNT(*) FROM users" 2>/dev/null | xargs || echo "0")
    log_info "사용자 수: $USER_COUNT"

    PROJECT_COUNT=$(docker-compose -f $COMPOSE_FILE exec -T postgres psql -U coachdb -d coachdb -tc "SELECT COUNT(*) FROM projects" 2>/dev/null | xargs || echo "0")
    log_info "프로젝트 수: $PROJECT_COUNT"

    APP_COUNT=$(docker-compose -f $COMPOSE_FILE exec -T postgres psql -U coachdb -d coachdb -tc "SELECT COUNT(*) FROM applications" 2>/dev/null | xargs || echo "0")
    log_info "지원서 수: $APP_COUNT"
else
    log_error "데이터베이스 연결 실패"
fi

# 4. 디스크 사용량
log_section "4. 디스크 사용량"

if command -v df &> /dev/null; then
    DISK_INFO=$(df -h . | awk 'NR==2 {print $4 " 사용 가능 (" $5 " 사용 중)"}')
    log_info "디스크: $DISK_INFO"
fi

# Docker 볼륨 크기
if command -v docker &> /dev/null; then
    VOLUME_SIZE=$(docker system df -v 2>/dev/null | grep "postgres_data" | awk '{print $3}' || echo "N/A")
    if [ "$VOLUME_SIZE" != "N/A" ]; then
        log_info "DB 볼륨: $VOLUME_SIZE"
    fi
fi

# 5. 백업 상태
log_section "5. 백업 상태"

if [ -d "backup" ]; then
    BACKUP_COUNT=$(ls -1 backup/*.sql* 2>/dev/null | wc -l)
    if [ $BACKUP_COUNT -gt 0 ]; then
        log_info "백업 파일: $BACKUP_COUNT개"
        LATEST_BACKUP=$(ls -t backup/*.sql* 2>/dev/null | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            BACKUP_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$LATEST_BACKUP" 2>/dev/null || stat -c "%y" "$LATEST_BACKUP" 2>/dev/null | cut -d'.' -f1)
            BACKUP_SIZE=$(ls -lh "$LATEST_BACKUP" | awk '{print $5}')
            log_info "최근 백업: $(basename $LATEST_BACKUP) ($BACKUP_SIZE)"
            echo "  생성일: $BACKUP_DATE"
        fi
    else
        log_warn "백업 파일 없음"
    fi
else
    log_warn "backup 디렉토리 없음"
fi

# 6. 로그 확인
log_section "6. 최근 에러 로그"

echo ""
echo "Backend 에러 (최근 10줄):"
docker-compose -f $COMPOSE_FILE logs --tail=10 backend 2>/dev/null | grep -i "error\|exception\|fail" || echo "  에러 없음"

echo ""
echo "Nginx 에러 (최근 10줄):"
docker-compose -f $COMPOSE_FILE logs --tail=10 nginx 2>/dev/null | grep -i "error\|warn" || echo "  에러 없음"

# 7. 리소스 사용량
log_section "7. 컨테이너 리소스 사용량"

echo ""
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose -f $COMPOSE_FILE ps -q) 2>/dev/null || log_warn "리소스 정보 확인 불가"

# 8. 네트워크 확인
log_section "8. 포트 바인딩"

echo ""
docker-compose -f $COMPOSE_FILE ps --format "table {{.Name}}\t{{.Ports}}" 2>/dev/null

# 9. 업타임
log_section "9. 서비스 업타임"

for service in "${SERVICES[@]}"; do
    CONTAINER_ID=$(docker-compose -f $COMPOSE_FILE ps -q $service 2>/dev/null)
    if [ -n "$CONTAINER_ID" ]; then
        UPTIME=$(docker inspect --format='{{.State.StartedAt}}' $CONTAINER_ID 2>/dev/null)
        if [ -n "$UPTIME" ]; then
            log_info "$service: 시작 시간 $UPTIME"
        fi
    fi
done

# 10. 요약
log_section "10. 시스템 요약"

echo ""
RUNNING_COUNT=$(docker-compose -f $COMPOSE_FILE ps | grep "Up" | wc -l | xargs)
TOTAL_COUNT=${#SERVICES[@]}

if [ "$RUNNING_COUNT" -eq "$TOTAL_COUNT" ]; then
    echo -e "${GREEN}✓ 모든 서비스 정상 작동 중 ($RUNNING_COUNT/$TOTAL_COUNT)${NC}"
    echo ""
    echo -e "${BLUE}시스템 상태: 정상${NC}"
else
    echo -e "${RED}✗ 일부 서비스 문제 발생 ($RUNNING_COUNT/$TOTAL_COUNT)${NC}"
    echo ""
    echo -e "${YELLOW}문제 해결:${NC}"
    echo "  1. docker-compose -f $COMPOSE_FILE logs <service_name>"
    echo "  2. docker-compose -f $COMPOSE_FILE restart <service_name>"
    echo "  3. docker-compose -f $COMPOSE_FILE up -d"
fi

echo ""
echo -e "${BLUE}유용한 명령어:${NC}"
echo "  전체 로그: docker-compose -f $COMPOSE_FILE logs -f"
echo "  재시작: docker-compose -f $COMPOSE_FILE restart"
echo "  재배포: ./scripts/deploy.sh"
echo "  백업: ./scripts/backup.sh"
echo ""
