/**
 * 인증 관련 E2E 테스트
 */
import { test, expect } from '@playwright/test'

test.describe('인증 기능', () => {
  test('로그인 페이지가 정상 로드됨', async ({ page }) => {
    await page.goto('/login')

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle')

    // 로그인 폼 확인 (Ant Design 폼)
    await expect(page.locator('.ant-card, .ant-form')).toBeVisible({ timeout: 15000 })

    // 로그인 버튼 확인
    await expect(page.getByRole('button', { name: /로그인/i })).toBeVisible()
  })

  test('잘못된 이메일로 로그인 시도 시 에러 표시', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // 이메일과 비밀번호 입력
    await page.locator('input').first().fill('wrong@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.click('button[type="submit"]')

    // 에러 메시지 확인 (toast 또는 form error)
    await expect(
      page.locator('.ant-message-error, .ant-form-item-explain-error, .ant-message-notice-error')
    ).toBeVisible({ timeout: 15000 })
  })

  test('회원가입 페이지가 정상 로드됨', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.ant-card, .ant-form')).toBeVisible({ timeout: 15000 })
  })

  test('비밀번호 재설정 페이지가 정상 로드됨', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.ant-card, .ant-form')).toBeVisible({ timeout: 15000 })
  })
})
