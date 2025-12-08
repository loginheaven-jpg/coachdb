#!/bin/bash

###############################################################################
# CoachDB Interactive Deployment Helper
# 단계별 안내와 함께 배포를 도와주는 인터랙티브 스크립트
###############################################################################

set -e

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

ask_yes_no() {
    while true; do
        read -p "$1 (y/n): " -n 1 -r
        echo
        case $REPLY in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "y 또는 n을 입력하세요.";;
        esac
    done
}

press_enter() {
    echo -e "\n${YELLOW}계속하려면 Enter를 누르세요...${NC}"
    read
}

# 배너
clear
echo -e "${BLUE}"
cat << "EOF"
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║       CoachDB Interactive Deployment Helper             ║
║                                                          ║
║       코치DB 파일럿 배포 도우미                          ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo "이 스크립트는 CoachDB 파일럿 배포를 단계별로 안내합니다."
echo ""

# 환경 확인
log_step "STEP 1: 배포 환경 확인"

echo "배포할 환경을 선택하세요:"
echo "  1) 로컬 테스트 (Windows에서 프로덕션 설정 테스트)"
echo "  2) 실제 서버 배포 (Linux 서버에 배포)"
echo ""
read -p "선택 (1 또는 2): " DEPLOY_ENV

if [ "$DEPLOY_ENV" == "1" ]; then
    DEPLOY_TYPE="local"
    log_info "로컬 테스트 모드 선택됨"
elif [ "$DEPLOY_ENV" == "2" ]; then
    DEPLOY_TYPE="production"
    log_info "실제 서버 배포 모드 선택됨"
else
    log_error "잘못된 선택입니다."
    exit 1
fi

press_enter

# Pre-flight 체크
log_step "STEP 2: Pre-flight 체크"

echo "배포 전 필수 항목을 확인합니다..."
echo ""

if [ -f "scripts/preflight_check.sh" ]; then
    if bash scripts/preflight_check.sh; then
        log_info "Pre-flight 체크 통과!"
    else
        log_error "Pre-flight 체크 실패!"
        echo ""
        if ask_yes_no "오류를 무시하고 계속하시겠습니까?"; then
            log_warn "오류 무시하고 계속합니다..."
        else
            log_error "배포를 중단합니다."
            exit 1
        fi
    fi
else
    log_warn "preflight_check.sh를 찾을 수 없습니다."
fi

press_enter

# 환경 변수 설정
log_step "STEP 3: 환경 변수 설정"

if [ ! -f ".env.production" ]; then
    log_warn ".env.production 파일이 없습니다."

    if [ "$DEPLOY_TYPE" == "local" ]; then
        log_info "로컬 테스트용 환경 변수를 자동 생성합니다..."
        cp .env.production.example .env.production

        # 테스트용 값으로 자동 설정
        sed -i 's/CHANGE_THIS_TO_STRONG_PASSWORD_123!@#/test_password_123456/g' .env.production
        SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "test_secret_key_for_local_testing_only_$(date +%s)")
        sed -i "s|CHANGE_THIS_TO_RANDOM_32_CHAR_STRING_OR_LONGER|$SECRET_KEY|g" .env.production
        sed -i 's|https://coachdb-pilot.yourdomain.com|http://localhost|g' .env.production
        sed -i 's|"https://coachdb-pilot.yourdomain.com"|"http://localhost:5173","http://localhost"|g' .env.production

        log_info "테스트용 환경 변수 생성 완료!"
        log_warn "이것은 로컬 테스트용입니다. 실제 배포시 수정 필요!"
    else
        log_info ".env.production.example을 .env.production으로 복사합니다..."
        cp .env.production.example .env.production

        echo ""
        log_warn "중요: .env.production 파일을 수정해야 합니다!"
        echo ""
        echo "필수 수정 항목:"
        echo "  1. DB_PASSWORD - 강력한 비밀번호"
        echo "  2. SECRET_KEY - 랜덤 32자 이상 문자열"
        echo "  3. CORS_ORIGINS - 실제 도메인"
        echo "  4. VITE_API_BASE_URL - 실제 API URL"
        echo ""

        if ask_yes_no ".env.production 파일을 지금 편집하시겠습니까?"; then
            ${EDITOR:-nano} .env.production

            log_info "환경 변수 설정 완료!"
        else
            log_error "환경 변수 설정이 필요합니다!"
            echo "nano .env.production 또는 vim .env.production 명령으로 수정하세요."
            exit 1
        fi
    fi
else
    log_info ".env.production 파일이 존재합니다."

    # 주요 값 확인
    source .env.production

    if [ "$DB_PASSWORD" == "CHANGE_THIS_TO_STRONG_PASSWORD_123!@#" ]; then
        log_error "DB_PASSWORD를 변경하지 않았습니다!"
        if ask_yes_no ".env.production을 편집하시겠습니까?"; then
            ${EDITOR:-nano} .env.production
        else
            exit 1
        fi
    fi

    if [ "$SECRET_KEY" == "CHANGE_THIS_TO_RANDOM_32_CHAR_STRING_OR_LONGER" ]; then
        log_error "SECRET_KEY를 변경하지 않았습니다!"
        if ask_yes_no ".env.production을 편집하시겠습니까?"; then
            ${EDITOR:-nano} .env.production
        else
            exit 1
        fi
    fi

    log_info "환경 변수 검증 완료!"
fi

press_enter

# 배포 실행
log_step "STEP 4: 배포 실행"

if [ "$DEPLOY_TYPE" == "local" ]; then
    log_info "로컬 프로덕션 환경 시작..."

    if [ -f "scripts/local_test_prod.sh" ]; then
        bash scripts/local_test_prod.sh
    else
        log_warn "local_test_prod.sh를 찾을 수 없습니다. 수동 배포 진행..."

        log_info "Docker 이미지 빌드 중..."
        docker-compose -f docker-compose.prod.yml build

        log_info "컨테이너 시작 중..."
        docker-compose -f docker-compose.prod.yml up -d

        log_info "서비스 시작 대기 중..."
        sleep 20

        log_info "마이그레이션 실행 중..."
        docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

        log_info "배포 완료!"
    fi
else
    log_info "실제 서버 배포 시작..."

    if [ -f "scripts/deploy.sh" ]; then
        bash scripts/deploy.sh
    else
        log_error "deploy.sh를 찾을 수 없습니다!"
        exit 1
    fi
fi

press_enter

# 파일럿 사용자 생성
log_step "STEP 5: 파일럿 사용자 생성"

if ask_yes_no "파일럿 테스트 사용자를 생성하시겠습니까?"; then
    log_info "사용자 생성 중..."

    if docker-compose -f docker-compose.prod.yml exec -T backend python scripts/create_pilot_users.py; then
        log_info "파일럿 사용자 생성 완료!"
        echo ""
        echo "생성된 계정:"
        echo "  관리자: admin1@test.com, admin2@test.com"
        echo "  코치: coach1@test.com ~ coach10@test.com"
        echo "  비밀번호: Pilot2025!"
        echo ""
        log_warn "파일럿 사용자에게 첫 로그인 후 비밀번호 변경을 안내하세요!"
    else
        log_warn "사용자 생성 실패 (이미 존재할 수 있음)"
    fi
else
    log_info "사용자 생성 건너뜀"
fi

press_enter

# 상태 확인
log_step "STEP 6: 배포 상태 확인"

log_info "시스템 상태 확인 중..."
echo ""

if [ -f "scripts/deployment_status.sh" ]; then
    bash scripts/deployment_status.sh
else
    log_warn "deployment_status.sh를 찾을 수 없습니다. 수동 확인..."
    docker-compose -f docker-compose.prod.yml ps
fi

press_enter

# SSL 설정 안내 (실제 배포인 경우)
if [ "$DEPLOY_TYPE" == "production" ]; then
    log_step "STEP 7: SSL 인증서 설정"

    log_warn "HTTPS를 위한 SSL 인증서 설정이 필요합니다!"
    echo ""
    echo "Let's Encrypt 인증서 발급 방법:"
    echo ""
    echo "1. Nginx 임시 정지:"
    echo "   docker-compose -f docker-compose.prod.yml stop nginx"
    echo ""
    echo "2. Certbot으로 인증서 발급:"
    echo "   sudo certbot certonly --standalone \\"
    echo "     -d your-domain.com \\"
    echo "     --email your-email@example.com \\"
    echo "     --agree-tos"
    echo ""
    echo "3. 인증서 복사:"
    echo "   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/"
    echo "   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/"
    echo "   sudo chmod 644 nginx/ssl/*.pem"
    echo ""
    echo "4. Nginx 재시작:"
    echo "   docker-compose -f docker-compose.prod.yml start nginx"
    echo ""

    if ask_yes_no "SSL 인증서를 지금 설정하시겠습니까?"; then
        read -p "도메인 이름 입력: " DOMAIN
        read -p "이메일 주소 입력: " EMAIL

        log_info "Nginx 정지 중..."
        docker-compose -f docker-compose.prod.yml stop nginx

        log_info "인증서 발급 중..."
        if sudo certbot certonly --standalone \
            -d $DOMAIN \
            --email $EMAIL \
            --agree-tos \
            --non-interactive; then

            log_info "인증서 복사 중..."
            sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/
            sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/
            sudo chmod 644 nginx/ssl/*.pem

            log_info "Nginx 재시작 중..."
            docker-compose -f docker-compose.prod.yml start nginx

            log_info "SSL 인증서 설치 완료!"
            log_info "https://$DOMAIN 으로 접속하세요."
        else
            log_error "인증서 발급 실패!"
            log_warn "수동으로 설정하거나 DNS 설정을 확인하세요."
        fi
    else
        log_warn "SSL 설정을 나중에 진행하세요."
    fi

    press_enter
fi

# 백업 크론 설정 안내
if [ "$DEPLOY_TYPE" == "production" ]; then
    log_step "STEP 8: 자동 백업 설정"

    log_info "자동 백업 크론 설정을 권장합니다."
    echo ""
    echo "매일 새벽 2시 자동 백업 설정:"
    echo ""
    echo "crontab -e"
    echo ""
    echo "다음 줄 추가:"
    echo "0 2 * * * $(pwd)/scripts/backup.sh >> $(pwd)/backup/backup.log 2>&1"
    echo ""

    if ask_yes_no "자동 백업 크론을 지금 설정하시겠습니까?"; then
        CRON_JOB="0 2 * * * $(pwd)/scripts/backup.sh >> $(pwd)/backup/backup.log 2>&1"
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

        log_info "자동 백업 크론 설정 완료!"
        log_info "매일 새벽 2시에 자동 백업됩니다."
    else
        log_warn "나중에 수동으로 설정하세요."
    fi

    press_enter
fi

# 완료
log_step "배포 완료!"

echo -e "${GREEN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║              🎉 배포 성공! 🎉                            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

if [ "$DEPLOY_TYPE" == "local" ]; then
    echo -e "${BLUE}로컬 테스트 접속 정보:${NC}"
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
else
    echo -e "${BLUE}배포 완료 정보:${NC}"
    echo "  서버가 실행 중입니다."
    echo "  도메인 DNS 설정을 확인하세요."
    echo "  SSL 인증서 설치를 완료하세요."
fi

echo ""
echo -e "${BLUE}테스트 계정:${NC}"
echo "  관리자: admin1@test.com / Pilot2025!"
echo "  코치: coach1@test.com / Pilot2025!"

echo ""
echo -e "${BLUE}다음 단계:${NC}"
echo "  1. 웹 브라우저로 접속"
echo "  2. 테스트 계정으로 로그인"
echo "  3. 주요 기능 테스트"
echo "  4. 파일럿 사용자 초대"

echo ""
echo -e "${BLUE}유용한 명령어:${NC}"
echo "  상태 확인: bash scripts/deployment_status.sh"
echo "  로그 확인: docker-compose -f docker-compose.prod.yml logs -f"
echo "  재시작: docker-compose -f docker-compose.prod.yml restart"
echo "  백업: bash scripts/backup.sh"

echo ""
echo -e "${BLUE}관련 문서:${NC}"
echo "  파일럿 테스트 가이드: docs/PILOT_TEST_GUIDE.md"
echo "  배포 README: DEPLOY_README.md"
echo "  배포 가이드: docs/DEPLOYMENT_GUIDE.md"

echo ""
echo -e "${GREEN}배포를 축하합니다! 🚀${NC}"
echo ""
