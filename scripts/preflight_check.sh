#!/bin/bash

###############################################################################
# CoachDB Deployment Pre-flight Check
# 배포 전 필수 항목 체크
###############################################################################

set -e

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS+1))
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS+1))
}

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}"
}

# 배너
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════╗
║   CoachDB Deployment Pre-flight Check   ║
╚═══════════════════════════════════════════╝
EOF
echo -e "${NC}"

# 1. Docker 확인
log_section "1. Docker 환경 확인"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    log_info "Docker 설치됨: v$DOCKER_VERSION"
else
    log_error "Docker가 설치되지 않았습니다"
fi

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
    log_info "Docker Compose 설치됨: v$COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version --short)
    log_info "Docker Compose 설치됨 (Plugin): v$COMPOSE_VERSION"
else
    log_error "Docker Compose가 설치되지 않았습니다"
fi

if docker ps &> /dev/null; then
    log_info "Docker 데몬 실행 중"
else
    log_error "Docker 데몬이 실행되지 않았습니다"
fi

# 2. 필수 파일 확인
log_section "2. 필수 파일 확인"

REQUIRED_FILES=(
    "docker-compose.prod.yml"
    "backend/Dockerfile.prod"
    "frontend/Dockerfile.prod"
    "nginx/nginx.conf"
    ".env.production.example"
    "scripts/deploy.sh"
    "scripts/backup.sh"
    "scripts/restore.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_info "$file 존재"
    else
        log_error "$file 없음"
    fi
done

# 3. 환경 변수 확인
log_section "3. 환경 변수 확인"

if [ -f ".env.production" ]; then
    log_info ".env.production 파일 존재"

    # 필수 환경 변수 체크
    source .env.production

    if [ "$DB_PASSWORD" == "CHANGE_THIS_TO_STRONG_PASSWORD_123!@#" ]; then
        log_error "DB_PASSWORD를 변경하지 않았습니다"
    else
        log_info "DB_PASSWORD 설정됨"
    fi

    if [ "$SECRET_KEY" == "CHANGE_THIS_TO_RANDOM_32_CHAR_STRING_OR_LONGER" ]; then
        log_error "SECRET_KEY를 변경하지 않았습니다"
    else
        if [ ${#SECRET_KEY} -lt 32 ]; then
            log_warn "SECRET_KEY가 32자 미만입니다 (현재: ${#SECRET_KEY}자)"
        else
            log_info "SECRET_KEY 설정됨 (${#SECRET_KEY}자)"
        fi
    fi

    if [[ "$CORS_ORIGINS" == *"yourdomain.com"* ]]; then
        log_error "CORS_ORIGINS를 실제 도메인으로 변경하세요"
    else
        log_info "CORS_ORIGINS 설정됨: $CORS_ORIGINS"
    fi

    if [[ "$VITE_API_BASE_URL" == *"yourdomain.com"* ]]; then
        log_error "VITE_API_BASE_URL를 실제 도메인으로 변경하세요"
    else
        log_info "VITE_API_BASE_URL 설정됨: $VITE_API_BASE_URL"
    fi
else
    log_error ".env.production 파일이 없습니다"
    log_warn "cp .env.production.example .env.production 실행 후 수정하세요"
fi

# 4. 디렉토리 확인
log_section "4. 필수 디렉토리 확인"

REQUIRED_DIRS=(
    "backend"
    "frontend"
    "nginx"
    "scripts"
    "backup"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log_info "$dir/ 존재"
    else
        if [ "$dir" == "backup" ]; then
            log_warn "$dir/ 없음 (배포 시 자동 생성)"
            mkdir -p "$dir"
        else
            log_error "$dir/ 없음"
        fi
    fi
done

# SSL 디렉토리 확인
if [ -d "nginx/ssl" ]; then
    log_info "nginx/ssl/ 존재"

    if [ -f "nginx/ssl/fullchain.pem" ] && [ -f "nginx/ssl/privkey.pem" ]; then
        log_info "SSL 인증서 파일 존재"
    else
        log_warn "SSL 인증서 파일 없음 (Let's Encrypt로 생성 필요)"
    fi
else
    log_warn "nginx/ssl/ 없음 (SSL 인증서 디렉토리)"
    mkdir -p nginx/ssl
fi

# 5. 백엔드 확인
log_section "5. 백엔드 파일 확인"

if [ -f "backend/requirements.txt" ]; then
    log_info "requirements.txt 존재"
else
    log_error "requirements.txt 없음"
fi

if [ -f "backend/app/main.py" ]; then
    log_info "app/main.py 존재"
else
    log_error "app/main.py 없음"
fi

if [ -d "backend/alembic" ]; then
    log_info "alembic/ 마이그레이션 디렉토리 존재"
else
    log_warn "alembic/ 없음"
fi

# 6. 프론트엔드 확인
log_section "6. 프론트엔드 파일 확인"

if [ -f "frontend/package.json" ]; then
    log_info "package.json 존재"
else
    log_error "package.json 없음"
fi

if [ -f "frontend/vite.config.ts" ] || [ -f "frontend/vite.config.js" ]; then
    log_info "vite.config 존재"
else
    log_warn "vite.config 없음"
fi

# 7. 포트 확인
log_section "7. 포트 사용 확인"

check_port() {
    local port=$1
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            log_warn "포트 $port 사용 중"
        else
            log_info "포트 $port 사용 가능"
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            log_warn "포트 $port 사용 중"
        else
            log_info "포트 $port 사용 가능"
        fi
    else
        log_warn "포트 확인 도구 없음 (netstat/ss)"
    fi
}

check_port 80
check_port 443
check_port 5432

# 8. 디스크 공간 확인
log_section "8. 시스템 리소스 확인"

if command -v df &> /dev/null; then
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    DISK_AVAIL=$(df -h . | awk 'NR==2 {print $4}')

    if [ "$DISK_USAGE" -lt 80 ]; then
        log_info "디스크 공간: $DISK_AVAIL 사용 가능 (사용률: ${DISK_USAGE}%)"
    else
        log_warn "디스크 사용률 높음: ${DISK_USAGE}% (사용 가능: $DISK_AVAIL)"
    fi
fi

# 9. Git 확인 (선택사항)
log_section "9. Git 저장소 확인"

if [ -d ".git" ]; then
    log_info "Git 저장소 확인됨"

    if git diff-index --quiet HEAD -- 2>/dev/null; then
        log_info "커밋되지 않은 변경사항 없음"
    else
        log_warn "커밋되지 않은 변경사항 있음"
    fi

    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
    log_info "현재 브랜치: $CURRENT_BRANCH"
else
    log_warn "Git 저장소 아님"
fi

# 10. 스크립트 실행 권한 확인
log_section "10. 스크립트 실행 권한 확인"

SCRIPTS=(
    "scripts/deploy.sh"
    "scripts/backup.sh"
    "scripts/restore.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            log_info "$script 실행 가능"
        else
            log_warn "$script 실행 권한 없음"
            chmod +x "$script" 2>/dev/null && log_info "실행 권한 추가됨" || log_error "실행 권한 추가 실패"
        fi
    fi
done

# 결과 요약
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Pre-flight 체크 결과          ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ 모든 체크 통과!${NC}"
    echo -e "${GREEN}  배포 준비가 완료되었습니다.${NC}"
    echo ""
    echo -e "${BLUE}다음 단계:${NC}"
    echo "  1. ./scripts/deploy.sh 실행"
    echo "  2. DNS 설정 확인"
    echo "  3. SSL 인증서 설치"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ 경고: $WARNINGS개${NC}"
    echo -e "${YELLOW}  배포 가능하나 경고 사항을 확인하세요.${NC}"
    echo ""
    echo -e "${BLUE}다음 단계:${NC}"
    echo "  1. 경고 사항 검토"
    echo "  2. 필요시 수정 후 재확인"
    echo "  3. ./scripts/deploy.sh 실행"
    exit 0
else
    echo -e "${RED}✗ 오류: $ERRORS개, 경고: $WARNINGS개${NC}"
    echo -e "${RED}  배포 전 오류를 수정하세요.${NC}"
    echo ""
    echo -e "${BLUE}해결 방법:${NC}"
    echo "  1. .env.production.example을 .env.production으로 복사"
    echo "  2. .env.production 파일 수정 (비밀번호, 도메인 등)"
    echo "  3. 누락된 파일 확인"
    echo "  4. 다시 pre-flight 체크 실행"
    exit 1
fi
