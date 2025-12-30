/**
 * 인증 헬퍼 함수
 */
import { Page } from '@playwright/test'

// 테스트 계정 정보 (환경변수 또는 기본값 사용)
export const TEST_ACCOUNTS = {
  coach: {
    email: process.env.TEST_COACH_EMAIL || 'test@example.com',
    password: process.env.TEST_COACH_PASSWORD || 'test1234',
    name: '테스트코치'
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'loginheaven@gmail.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'admin1234',
    name: '관리자'
  }
}

export async function login(page: Page, account: 'coach' | 'admin' = 'coach') {
  const creds = TEST_ACCOUNTS[account]
  await page.goto('/login')

  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.click('button[type="submit"]')

  // 대시보드로 이동될 때까지 대기
  await page.waitForURL(/\/(dashboard|projects)/, { timeout: 15000 })
}

export async function logout(page: Page) {
  // 사용자 메뉴 클릭
  await page.click('.ant-avatar')
  await page.click('text=로그아웃')
  await page.waitForURL('/login', { timeout: 5000 })
}
