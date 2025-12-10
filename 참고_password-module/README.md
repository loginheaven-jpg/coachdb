# 비밀번호 변경 모듈 패키지

**버전**: 1.0  
**작성일**: 2025년 1월 20일  
**작성자**: Manus AI

---

## 📦 패키지 내용

이 패키지는 **비밀번호 찾기, 재설정, 변경** 기능을 포함한 완전한 비밀번호 관리 모듈의 설계 문서와 구현 예시를 제공합니다.

### 📁 파일 구조

```
password-module/
├── README.md                                    (이 파일)
├── 비밀번호_변경_모듈_설계서.md                  (메인 설계 문서)
└── implementation-examples/                     (구현 예시 코드)
    ├── auth-router.ts                           (tRPC 라우터 구현)
    ├── db-functions.ts                          (데이터베이스 함수)
    └── email-service.ts                         (이메일 발송 서비스)
```

---

## 📖 문서 가이드

### 1. 비밀번호_변경_모듈_설계서.md (메인 문서)

**대상 독자**: 백엔드 개발자, 시스템 설계자  

**내용**:
- **개요**: 모듈의 목적, 설계 원칙, 기술 스택
- **시스템 아키텍처**: 전체 흐름도, 컴포넌트 구조
- **기능 명세**: 비밀번호 찾기, 재설정, 변경 상세 명세
- **데이터베이스 설계**: 테이블 스키마, ORM 예시, 정리 작업
- **API 명세**: 4개 API 엔드포인트 상세 명세 (요청/응답/오류)
- **이메일 템플릿**: HTML + Plain Text 템플릿 2개
- **보안 고려사항**: 8가지 보안 원칙 및 구현 방법
- **구현 가이드**: 5단계 구현 가이드
- **테스트 시나리오**: 3가지 기능별 테스트 케이스
- **배포 체크리스트**: 배포 전 확인 사항

**사용 방법**:
1. 전체 문서를 읽어 모듈의 구조와 설계를 이해합니다
2. 시스템 아키텍처를 참고하여 전체 흐름을 파악합니다
3. 기능 명세를 읽고 각 기능의 입력/출력/처리 과정을 이해합니다
4. 구현 가이드를 따라 단계별로 개발을 진행합니다

### 2. implementation-examples/ (구현 예시 코드)

**대상 독자**: 백엔드 개발자

#### auth-router.ts (tRPC 라우터)

**내용**:
- `forgotPassword`: 비밀번호 찾기 API 구현
- `resetPassword`: 비밀번호 재설정 API 구현
- `changePassword`: 비밀번호 변경 API 구현
- `verifyResetToken`: 토큰 검증 API 구현 (선택사항)
- 유틸리티 함수: `generateResetToken()`, `validatePasswordStrength()`

**특징**:
- tRPC + Zod를 사용한 타입 안전 API
- 상세한 주석으로 각 단계 설명
- 오류 처리 및 보안 고려사항 포함

**사용 방법**:
1. 파일을 열어 전체 코드 구조를 파악합니다
2. 각 API의 구현을 읽고 로직을 이해합니다
3. 코드를 프로젝트에 복사하고 필요한 부분을 수정합니다
4. 다른 프레임워크(Express, FastAPI 등)를 사용하는 경우 로직만 참고합니다

#### db-functions.ts (데이터베이스 함수)

**내용**:
- `findUserByEmail()`: 이메일로 사용자 조회
- `findUserById()`: ID로 사용자 조회
- `createResetToken()`: 재설정 토큰 생성
- `findResetToken()`: 토큰 조회
- `invalidateResetToken()`: 토큰 무효화
- `invalidateUserResetTokens()`: 사용자의 모든 토큰 무효화
- `updateUserPassword()`: 비밀번호 업데이트
- `deleteExpiredTokens()`: 만료된 토큰 삭제 (정리 작업)
- `savePasswordHistory()`: 비밀번호 히스토리 저장 (선택사항)
- `checkPasswordHistory()`: 이전 비밀번호 확인 (선택사항)

**특징**:
- Drizzle ORM을 사용한 구현
- 각 함수의 역할과 사용 방법 설명
- 선택사항 기능 포함 (비밀번호 히스토리)

**사용 방법**:
1. Drizzle ORM을 사용하는 경우 코드를 그대로 복사합니다
2. 다른 ORM(Prisma, TypeORM 등)을 사용하는 경우 로직을 참고하여 구현합니다
3. 선택사항 기능은 필요에 따라 구현합니다

#### email-service.ts (이메일 발송 서비스)

**내용**:
- `sendPasswordResetEmail()`: 비밀번호 재설정 이메일 발송
- `sendPasswordChangedEmail()`: 비밀번호 변경 알림 이메일 발송
- `getPasswordResetEmailTemplate()`: 재설정 이메일 HTML 템플릿
- `getPasswordChangedEmailTemplate()`: 변경 알림 이메일 HTML 템플릿

**특징**:
- Nodemailer를 사용한 SMTP 이메일 발송
- SendGrid, AWS SES 대안 구현 예시 포함 (주석)
- HTML + Plain Text 이중 템플릿

**사용 방법**:
1. Nodemailer를 사용하는 경우 코드를 그대로 복사합니다
2. SendGrid, AWS SES를 사용하는 경우 주석 처리된 코드를 참고합니다
3. 이메일 템플릿을 서비스에 맞게 수정합니다 (색상, 로고, 문구 등)

---

## 🚀 빠른 시작 가이드

### Step 1: 문서 읽기 (60분)

1. `비밀번호_변경_모듈_설계서.md`를 읽어 전체 구조를 이해합니다
2. 특히 "시스템 아키텍처"와 "기능 명세" 섹션을 집중적으로 읽습니다
3. 데이터베이스 설계와 API 명세를 확인합니다

### Step 2: 환경 설정 (30분)

1. 데이터베이스 마이그레이션 실행:
   ```bash
   # Drizzle ORM
   npx drizzle-kit generate
   npx drizzle-kit migrate
   
   # Prisma
   npx prisma migrate dev --name add_password_reset_tokens
   ```

2. 환경 변수 설정 (`.env`):
   ```env
   # SMTP 설정
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # 프론트엔드 URL
   FRONTEND_URL=https://example.com
   
   # 서비스 이름
   SERVICE_NAME=서비스명
   ```

3. 필요한 패키지 설치:
   ```bash
   npm install bcrypt nodemailer
   npm install -D @types/bcrypt @types/nodemailer
   ```

### Step 3: 코드 구현 (120분)

1. **데이터베이스 함수 구현** (30분):
   - `implementation-examples/db-functions.ts`를 참고하여 구현
   - ORM에 맞게 코드 수정

2. **이메일 서비스 구현** (30분):
   - `implementation-examples/email-service.ts`를 참고하여 구현
   - 이메일 템플릿 커스터마이징

3. **API 라우터 구현** (60분):
   - `implementation-examples/auth-router.ts`를 참고하여 구현
   - 프레임워크에 맞게 코드 수정

### Step 4: 테스트 (60분)

1. **비밀번호 찾기 테스트**:
   - 존재하는 이메일로 요청
   - 존재하지 않는 이메일로 요청
   - 이메일 수신 확인

2. **비밀번호 재설정 테스트**:
   - 유효한 토큰으로 재설정
   - 만료된 토큰으로 재설정 시도
   - 이미 사용된 토큰으로 재설정 시도

3. **비밀번호 변경 테스트**:
   - 로그인 상태에서 변경
   - 잘못된 현재 비밀번호로 시도
   - 약한 비밀번호로 시도

### Step 5: 배포 (30분)

1. 배포 체크리스트 확인 (설계서 참고)
2. 환경 변수 프로덕션 설정
3. HTTPS 사용 확인
4. Rate Limiting 설정
5. 정리 작업 Cron Job 설정

---

## 🎯 주요 기능

### 1. 비밀번호 찾기 (Forgot Password)

사용자가 이메일을 입력하면 재설정 링크를 이메일로 발송합니다.

**특징**:
- 타이밍 공격 방지 (사용자 존재 여부 노출 안 함)
- Rate Limiting (5분 내 3회 제한)
- 토큰 1시간 유효

**API**: `POST /api/auth/forgot-password`

### 2. 비밀번호 재설정 (Reset Password)

이메일로 받은 링크를 통해 새로운 비밀번호를 설정합니다.

**특징**:
- 토큰 유효성 검증 (존재, 만료, 사용 여부)
- 비밀번호 강도 검증
- 토큰 일회용 (사용 후 무효화)

**API**: `POST /api/auth/reset-password`

### 3. 비밀번호 변경 (Change Password)

로그인 상태에서 현재 비밀번호를 확인한 후 변경합니다.

**특징**:
- 현재 비밀번호 검증
- 새 비밀번호 강도 검증
- 변경 알림 이메일 발송

**API**: `POST /api/auth/change-password`

---

## 🔒 보안 고려사항

### 1. 비밀번호 해싱

**bcrypt** 사용 (Salt rounds 10-12)

```typescript
const hashedPassword = await bcrypt.hash(password, 10);
```

### 2. 토큰 생성

**암호학적으로 안전한 난수** 사용

```typescript
const token = crypto.randomBytes(32).toString('hex');
```

### 3. Rate Limiting

**5분 내 3회 제한**

```typescript
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
});
```

### 4. 타이밍 공격 방지

사용자가 존재하지 않더라도 **동일한 처리 시간** 유지

```typescript
if (!user) {
  await bcrypt.hash('dummy', 10); // 가짜 해싱
  return { success: true };
}
```

### 5. HTTPS 사용

모든 통신은 **HTTPS**를 통해 전송

### 6. CSRF 보호

비밀번호 변경 요청에 **CSRF 토큰** 포함

### 7. 토큰 해싱 (권장)

토큰을 데이터베이스에 저장할 때 **해시화**

```typescript
const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
```

### 8. 세션 무효화 (선택사항)

비밀번호 변경 후 **모든 활성 세션 무효화**

---

## 🛠️ 기술 스택

### 권장 스택

| 구성 요소 | 기술 |
|-----------|------|
| **백엔드 프레임워크** | Node.js + tRPC |
| **데이터베이스** | PostgreSQL |
| **ORM** | Drizzle ORM |
| **비밀번호 해싱** | bcrypt |
| **이메일 발송** | Nodemailer |
| **토큰 생성** | crypto (Node.js) |
| **프론트엔드** | React + TypeScript |

### 대체 가능

| 구성 요소 | 대체 기술 |
|-----------|-----------|
| **백엔드 프레임워크** | Express, FastAPI, Spring Boot |
| **데이터베이스** | MySQL, MongoDB, SQLite |
| **ORM** | Prisma, TypeORM, Sequelize |
| **비밀번호 해싱** | Argon2, scrypt |
| **이메일 발송** | SendGrid, AWS SES, Mailgun |

---

## 📋 체크리스트

### 구현 체크리스트

- [ ] 데이터베이스 테이블 생성 (`password_reset_tokens`)
- [ ] 데이터베이스 함수 구현 (10개 함수)
- [ ] 이메일 서비스 구현 (2개 함수 + 2개 템플릿)
- [ ] API 라우터 구현 (4개 엔드포인트)
- [ ] 프론트엔드 페이지 구현 (3개 페이지)
- [ ] 환경 변수 설정 (SMTP, FRONTEND_URL 등)
- [ ] 정리 작업 Cron Job 설정

### 테스트 체크리스트

- [ ] 비밀번호 찾기 정상 요청
- [ ] 비밀번호 찾기 존재하지 않는 이메일
- [ ] 비밀번호 찾기 Rate Limiting
- [ ] 비밀번호 재설정 정상 요청
- [ ] 비밀번호 재설정 만료된 토큰
- [ ] 비밀번호 재설정 이미 사용된 토큰
- [ ] 비밀번호 변경 정상 요청
- [ ] 비밀번호 변경 잘못된 현재 비밀번호
- [ ] 이메일 발송 확인 (2가지)

### 배포 체크리스트

- [ ] 환경 변수 프로덕션 설정
- [ ] HTTPS 사용 확인
- [ ] Rate Limiting 설정
- [ ] CSRF 보호 활성화
- [ ] bcrypt Salt rounds 10 이상
- [ ] 이메일 SPF, DKIM, DMARC 설정
- [ ] 정리 작업 Cron Job 설정

---

## ❓ FAQ

### Q1: bcrypt 대신 Argon2를 사용할 수 있나요?

**A**: 네, 가능합니다. Argon2는 bcrypt보다 더 안전한 최신 알고리즘입니다. `auth-router.ts`에서 `bcrypt.hash()`와 `bcrypt.compare()`를 `argon2.hash()`와 `argon2.verify()`로 변경하면 됩니다.

### Q2: Nodemailer 대신 SendGrid를 사용할 수 있나요?

**A**: 네, 가능합니다. `email-service.ts`에 SendGrid 구현 예시가 주석으로 포함되어 있습니다. 주석을 해제하고 API 키를 설정하면 됩니다.

### Q3: tRPC 대신 Express를 사용할 수 있나요?

**A**: 네, 가능합니다. `auth-router.ts`의 로직을 참고하여 Express 라우터로 변환하면 됩니다. 입력 검증은 Zod 대신 express-validator를 사용할 수 있습니다.

### Q4: 토큰 유효 시간을 변경할 수 있나요?

**A**: 네, 가능합니다. `auth-router.ts`의 `forgotPassword` 함수에서 `expiresAt` 계산 부분을 수정하면 됩니다. 기본값은 1시간(60 * 60 * 1000)입니다.

### Q5: 비밀번호 히스토리 기능을 추가할 수 있나요?

**A**: 네, 가능합니다. `db-functions.ts`에 `savePasswordHistory()`와 `checkPasswordHistory()` 함수가 주석으로 포함되어 있습니다. 설계서의 "데이터베이스 설계" 섹션을 참고하여 `password_history` 테이블을 생성하고 함수를 구현하면 됩니다.

### Q6: 다른 시스템에 통합할 때 주의할 점은?

**A**: 다음 사항을 확인하세요:
1. 환경 변수 설정 (SMTP, FRONTEND_URL 등)
2. 데이터베이스 테이블 생성 (마이그레이션)
3. 이메일 템플릿 커스터마이징 (색상, 로고, 문구)
4. 프론트엔드 라우팅 설정 (`/reset-password` 등)
5. HTTPS 사용 확인

---

## 📞 지원

추가 질문이나 구현 중 어려움이 있다면 언제든지 문의해주세요.

---

**작성일**: 2025년 1월 20일  
**작성자**: Manus AI  
**버전**: 1.0
