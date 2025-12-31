/**
 * 인증 헬퍼 함수
 */
import { Page } from '@playwright/test'

// 테스트 계정 정보 (환경변수 또는 기본값 사용)
// NOTE: 테스트 실행 시 환경변수로 실제 계정 정보 제공 필요
// TEST_COACH_EMAIL, TEST_COACH_PASSWORD, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
export const TEST_ACCOUNTS = {
  coach: {
    email: process.env.TEST_COACH_EMAIL || '',
    password: process.env.TEST_COACH_PASSWORD || '',
    name: '테스트코치'
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || '',
    password: process.env.TEST_ADMIN_PASSWORD || '',
    name: '관리자'
  }
}

// 테스트 계정이 설정되어 있는지 확인
export function hasTestCredentials(account: 'coach' | 'admin' = 'coach'): boolean {
  const creds = TEST_ACCOUNTS[account]
  return !!(creds.email && creds.password)
}

// 로그인 시도 - 성공 시 true, 실패 시 false 반환
export async function tryLogin(page: Page, account: 'coach' | 'admin' = 'coach'): Promise<boolean> {
  const creds = TEST_ACCOUNTS[account]

  if (!creds.email || !creds.password) {
    console.log(`[Auth] ${account} 계정 정보가 설정되지 않음. 환경변수를 확인하세요.`)
    return false
  }

  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('#login_email, input[id*="email"]', { timeout: 30000 })

  const emailInput = page.locator('#login_email, input[placeholder="이메일"]').first()
  await emailInput.fill(creds.email)

  const passwordInput = page.locator('#login_password, input[placeholder="비밀번호"]').first()
  await passwordInput.fill(creds.password)

  await page.click('button[type="submit"]')

  try {
    // 5초 내에 대시보드/프로젝트 페이지로 이동하는지 확인
    await page.waitForURL(/\/(dashboard|projects|profile)/, { timeout: 10000 })
    return true
  } catch {
    console.log(`[Auth] ${account} 계정 로그인 실패`)
    return false
  }
}

export async function login(page: Page, account: 'coach' | 'admin' = 'coach') {
  const creds = TEST_ACCOUNTS[account]

  if (!creds.email || !creds.password) {
    throw new Error(
      `테스트 계정 정보가 설정되지 않았습니다. 환경변수를 설정하세요:\n` +
        `  TEST_${account.toUpperCase()}_EMAIL=<이메일>\n` +
        `  TEST_${account.toUpperCase()}_PASSWORD=<비밀번호>`
    )
  }

  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('#login_email, input[id*="email"]', { timeout: 30000 })

  const emailInput = page.locator('#login_email, input[placeholder="이메일"]').first()
  await emailInput.fill(creds.email)

  const passwordInput = page.locator('#login_password, input[placeholder="비밀번호"]').first()
  await passwordInput.fill(creds.password)

  await page.click('button[type="submit"]')

  // 대시보드로 이동될 때까지 대기
  await page.waitForURL(/\/(dashboard|projects|profile)/, { timeout: 30000 })
}

export async function logout(page: Page) {
  // 사용자 메뉴 클릭
  await page.click('.ant-avatar')
  await page.click('text=로그아웃')
  await page.waitForURL('/login', { timeout: 10000 })
}
