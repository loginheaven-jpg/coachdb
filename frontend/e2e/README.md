# E2E 테스트 가이드

## 개요

이 프로젝트는 Playwright를 사용한 E2E(End-to-End) 테스트를 포함하고 있습니다.

## 테스트 실행 방법

### 1. 기본 테스트 (로그인 불필요)

```bash
# 인증 페이지 로드 테스트만 실행
npm run test:e2e
```

### 2. 전체 테스트 (로그인 필요)

전체 테스트를 실행하려면 환경변수로 테스트 계정을 설정해야 합니다:

```bash
# Windows (PowerShell)
$env:TEST_COACH_EMAIL="your-coach@email.com"
$env:TEST_COACH_PASSWORD="your-password"
$env:TEST_ADMIN_EMAIL="your-admin@email.com"
$env:TEST_ADMIN_PASSWORD="admin-password"
npm run test:e2e

# Windows (CMD)
set TEST_COACH_EMAIL=your-coach@email.com
set TEST_COACH_PASSWORD=your-password
set TEST_ADMIN_EMAIL=your-admin@email.com
set TEST_ADMIN_PASSWORD=admin-password
npm run test:e2e

# Linux/Mac
TEST_COACH_EMAIL=your-coach@email.com \
TEST_COACH_PASSWORD=your-password \
TEST_ADMIN_EMAIL=your-admin@email.com \
TEST_ADMIN_PASSWORD=admin-password \
npm run test:e2e
```

### 3. 특정 테스트 파일 실행

```bash
npx playwright test e2e/auth.spec.ts
npx playwright test e2e/dashboard.spec.ts
```

### 4. 테스트 URL 변경

기본적으로 Railway 프로덕션 사이트(https://copms.up.railway.app)에서 테스트합니다.
다른 URL을 사용하려면:

```bash
TEST_URL=https://your-test-server.com npm run test:e2e
```

## 테스트 파일 구조

| 파일 | 설명 | 필요 계정 |
|------|------|----------|
| auth.spec.ts | 인증 페이지 로드 테스트 | 없음 |
| dashboard.spec.ts | 대시보드 및 네비게이션 | Coach/Admin |
| application.spec.ts | 지원서 기능 | Coach |
| competency.spec.ts | 세부정보(역량) 관리 | Coach |
| project-participate.spec.ts | 과제참여 기능 | Coach |
| project-manage.spec.ts | 과제관리 기능 | Admin |

## 환경변수 목록

| 변수 | 설명 | 필수 여부 |
|------|------|----------|
| TEST_URL | 테스트 대상 URL | 선택 (기본: https://copms.up.railway.app) |
| TEST_COACH_EMAIL | 코치 계정 이메일 | 로그인 필요 테스트 |
| TEST_COACH_PASSWORD | 코치 계정 비밀번호 | 로그인 필요 테스트 |
| TEST_ADMIN_EMAIL | 관리자 계정 이메일 | 관리자 테스트 |
| TEST_ADMIN_PASSWORD | 관리자 계정 비밀번호 | 관리자 테스트 |

## 로컬 개발 서버 실행

테스트 전 프론트엔드 서버를 실행해야 합니다.

### 옵션 1: 프로덕션 백엔드 사용 (권장)

```bash
# 프로덕션 백엔드를 사용하도록 빌드
VITE_API_URL=https://coachdbbackend-production.up.railway.app npm run build

# 로컬 서버 시작
npm run dev
```

### 옵션 2: 로컬 Docker 백엔드 사용

```bash
# Docker 백엔드 시작
docker-compose up -d

# 프론트엔드 빌드 및 시작
npm run build && npm run dev
```

### 옵션 3: Railway 배포 사이트에서 직접 테스트 (기본값)

```bash
# 기본 URL이 Railway이므로 별도 설정 없이 테스트 가능
npm run test:e2e
```

## 테스트 리포트

테스트 결과는 `playwright-report/` 디렉토리에 HTML 형식으로 저장됩니다:

```bash
npx playwright show-report
```

## 문제 해결

### 테스트 계정 미설정 오류

```
Error: 테스트 계정 정보가 설정되지 않았습니다.
```

→ 환경변수 `TEST_COACH_EMAIL`, `TEST_COACH_PASSWORD` 등을 설정하세요.

### 페이지 로드 타임아웃

→ 네트워크 연결을 확인하고, 백엔드 서버가 실행 중인지 확인하세요.

### 선택자를 찾을 수 없음

→ 페이지 구조가 변경되었을 수 있습니다. 개발자 도구로 현재 요소를 확인하세요.
