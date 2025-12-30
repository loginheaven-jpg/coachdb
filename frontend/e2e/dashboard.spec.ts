/**
 * 대시보드 E2E 테스트
 */
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('대시보드', () => {
  test('로그인 후 대시보드로 이동', async ({ page }) => {
    await login(page, 'coach')

    // 대시보드 URL 확인
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('대시보드 메뉴 표시', async ({ page }) => {
    await login(page, 'coach')

    // 메뉴 항목 확인
    await expect(page.locator('text=대시보드')).toBeVisible()
    await expect(page.locator('text=과제참여')).toBeVisible()
    await expect(page.locator('text=내 지원서')).toBeVisible()
  })

  test('관리자 메뉴 표시 (관리자)', async ({ page }) => {
    await login(page, 'admin')

    // 관리자 전용 메뉴 확인
    await expect(page.locator('text=과제관리')).toBeVisible()
  })

  test('사용자 드롭다운 메뉴 표시', async ({ page }) => {
    await login(page, 'coach')

    // 아바타 클릭
    await page.click('.ant-avatar')

    // 드롭다운 메뉴 항목 확인
    await expect(page.locator('text=프로필 수정')).toBeVisible()
    await expect(page.locator('text=세부정보 관리')).toBeVisible()
    await expect(page.locator('text=로그아웃')).toBeVisible()
  })
})

test.describe('네비게이션', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'coach')
  })

  test('대시보드 메뉴 클릭', async ({ page }) => {
    await page.click('text=대시보드')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('과제참여 메뉴 클릭', async ({ page }) => {
    await page.click('text=과제참여')
    await expect(page).toHaveURL(/\/projects/)
  })

  test('내 지원서 메뉴 클릭', async ({ page }) => {
    await page.click('text=내 지원서')
    await expect(page).toHaveURL(/\/my-applications/)
  })

  test('PPMS 로고 클릭 시 대시보드로 이동', async ({ page }) => {
    await page.goto('/projects')
    await page.click('text=PPMS')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
