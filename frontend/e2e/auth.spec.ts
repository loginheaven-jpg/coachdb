/**
 * 인증 관련 E2E 테스트
 */
import { test, expect } from '@playwright/test'

test.describe('인증 기능', () => {
  test('로그인 페이지가 정상 로드됨', async ({ page }) => {
    await page.goto('/login')

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle')

    // 로그인 폼 확인 - 이메일 입력 필드 대기
    await page.waitForSelector('#login_email, input[placeholder="이메일"]', { timeout: 30000 })

    // 로그인 버튼 확인 (submit 버튼만 선택)
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('잘못된 이메일로 로그인 시도 시 에러 표시', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Ant Design 폼 필드 대기
    await page.waitForSelector('#login_email, input[placeholder="이메일"]', { timeout: 30000 })

    // 이메일과 비밀번호 입력
    const emailInput = page.locator('#login_email, input[placeholder="이메일"]').first()
    await emailInput.fill('wrong@example.com')

    const passwordInput = page.locator('#login_password, input[placeholder="비밀번호"]').first()
    await passwordInput.fill('wrongpassword')

    await page.click('button[type="submit"]')

    // 에러 메시지 확인 (ant-message 컨테이너 내부)
    await expect(
      page.locator('.ant-message-notice-error').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('회원가입 페이지가 정상 로드됨', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    // 회원가입 폼 필드 대기
    await page.waitForSelector('input[placeholder*="이름"], #register_name', { timeout: 30000 })

    await expect(page.getByRole('button', { name: /가입/i })).toBeVisible()
  })

  test('비밀번호 재설정 페이지가 정상 로드됨', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    // 이메일 입력 필드 대기
    await page.waitForSelector('input[placeholder*="이메일"], input[id*="email"]', { timeout: 30000 })

    await expect(page.getByRole('button', { name: /재설정|리셋|발송/i })).toBeVisible()
  })
})
