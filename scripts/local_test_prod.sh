#!/bin/bash

###############################################################################
# CoachDB Production Configuration Local Test
# 프로덕션 설정을 로컬에서 테스트
###############################################################################

set -e

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}"
}

# 배너
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════╗
║  CoachDB Production Local Test           ║
╚═══════════════════════════════════════════╝
EOF
echo -e "${NC}"

# 1. 환경 변수 준비
log_section "1. 로컬 테스트 환경 준비"

# 임시 환경 변수 파일 생성
if [ ! -f ".env.production" ]; then
    log_info "테스트용 .env.production 생성 중..."
    cp .env.production.example .env.production

    # 테스트용 값으로 자동 설정
    sed -i 's/CHANGE_THIS_TO_STRONG_PASSWORD_123!@#/test_password_123456/g' .env.production
    sed -i "s|CHANGE_THIS_TO_RANDOM_32_CHAR_STRING_OR_LONGER|$(openssl rand -hex 32)|g" .env.production
    sed -i 's|https://coachdb-pilot.yourdomain.com|http://localhost|g' .env.production
    sed -i 's|"https://coachdb-pilot.yourdomain.com"|"http://localhost:5173","http://localhost"|g' .env.production

    log_info "테스트용 환경 변수 설정 완료"
    log_warn "이것은 테스트용입니다. 실제 배포시 .env.production을 수정하세요!"
fi

# 2. 기존 개발 환경 정리
log_section "2. 기존 개발 컨테이너 확인"

if docker ps -a --format '{{.Names}}' | grep -q "coachdb-"; then
    log_warn "기존 CoachDB 컨테이너가 실행 중입니다"
    read -p "기존 개발 환경을 정지하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "기존 환경 정지 중..."
        docker-compose down 2>/dev/null || true
    fi
fi

# 3. 프로덕션 빌드 시작
log_section "3. 프로덕션 이미지 빌드"

log_info "Docker 이미지 빌드 시작... (몇 분 소요)"
log_warn "초기 빌드는 시간이 걸립니다. 기다려주세요..."

if docker-compose -f docker-compose.prod.yml build; then
    log_info "빌드 완료!"
else
    log_error "빌드 실패!"
    exit 1
fi

# 4. 컨테이너 시작
log_section "4. 컨테이너 시작"

log_info "프로덕션 컨테이너 시작 중..."
docker-compose -f docker-compose.prod.yml up -d

# 5. 헬스 체크
log_section "5. 서비스 헬스 체크"

log_info "서비스 시작 대기 중... (30초)"
sleep 10

# PostgreSQL 체크
log_info "PostgreSQL 체크 중..."
MAX_RETRIES=15
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U coachdb > /dev/null 2>&1; then
        log_info "PostgreSQL 정상!"
        break
    fi
    RETRY=$((RETRY+1))
    echo -n "."
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    log_error "PostgreSQL 시작 실패!"
    docker-compose -f docker-compose.prod.yml logs postgres
    exit 1
fi

# Backend 체크
log_info "Backend 체크 중..."
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        log_info "Backend 정상!"
        break
    fi
    RETRY=$((RETRY+1))
    echo -n "."
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    log_error "Backend 시작 실패!"
    docker-compose -f docker-compose.prod.yml logs backend
    exit 1
fi

# Frontend 체크 (nginx를 통해)
log_info "Frontend 체크 중..."
if curl -f http://localhost/ > /dev/null 2>&1; then
    log_info "Frontend 정상!"
else
    log_warn "Frontend 접근 불가 (SSL 설정 필요할 수 있음)"
fi

# 6. 마이그레이션 실행
log_section "6. 데이터베이스 마이그레이션"

log_info "마이그레이션 실행 중..."
if docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head; then
    log_info "마이그레이션 완료!"
else
    log_error "마이그레이션 실패!"
    exit 1
fi

# 7. 테스트 사용자 생성 (선택)
log_section "7. 파일럿 사용자 생성"

read -p "파일럿 테스트 사용자를 생성하시겠습니까? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "테스트 사용자 생성 중..."
    if docker-compose -f docker-compose.prod.yml exec -T backend python scripts/create_pilot_users.py; then
        log_info "사용자 생성 완료!"
        echo ""
        log_info "테스트 계정:"
        echo "  관리자1: admin1@test.com / Pilot2025!"
        echo "  관리자2: admin2@test.com / Pilot2025!"
        echo "  코치1~10: coach1@test.com ~ coach10@test.com / Pilot2025!"
    else
        log_warn "사용자 생성 실패 (이미 존재할 수 있음)"
    fi
fi

# 8. 컨테이너 상태 확인
log_section "8. 컨테이너 상태"

docker-compose -f docker-compose.prod.yml ps

# 9. 접속 정보
log_section "9. 테스트 접속 정보"

echo ""
echo -e "${GREEN}✓ 로컬 프로덕션 테스트 환경 준비 완료!${NC}"
echo ""
echo -e "${BLUE}접속 URL:${NC}"
echo "  Frontend: http://localhost"
echo "  Backend API: http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo -e "${BLUE}유용한 명령어:${NC}"
echo "  로그 확인: docker-compose -f docker-compose.prod.yml logs -f"
echo "  특정 서비스 로그: docker-compose -f docker-compose.prod.yml logs -f backend"
echo "  재시작: docker-compose -f docker-compose.prod.yml restart"
echo "  정지: docker-compose -f docker-compose.prod.yml down"
echo "  정지 및 데이터 삭제: docker-compose -f docker-compose.prod.yml down -v"
echo ""
echo -e "${YELLOW}주의:${NC}"
echo "  - 이것은 로컬 테스트 환경입니다"
echo "  - 실제 배포시 .env.production 파일을 수정하세요"
echo "  - SSL 인증서가 없어 HTTPS는 동작하지 않습니다"
echo ""
echo -e "${BLUE}다음 단계:${NC}"
echo "  1. 브라우저에서 http://localhost 접속"
echo "  2. 테스트 계정으로 로그인"
echo "  3. 주요 기능 테스트"
echo "  4. 문제 없으면 실제 서버에 배포"
echo ""
