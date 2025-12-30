/**
 * 지원서 관련 E2E 테스트
 */
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('지원서 기능', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'coach')
  })

  test('내 지원서 페이지 접근 가능', async ({ page }) => {
    await page.click('text=내 지원서')
    await page.waitForURL('/my-applications', { timeout: 10000 })

    // 페이지 제목 확인
    await expect(page.locator('h2', { hasText: '내 지원서' })).toBeVisible()
  })

  test('지원서 목록이 표시됨', async ({ page }) => {
    await page.goto('/my-applications')

    // 테이블 로드 대기
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 })
  })

  test('지원서 상태 필터 동작', async ({ page }) => {
    await page.goto('/my-applications')

    // 상태 필터 확인
    const statusFilter = page.locator('.ant-select').first()
    await expect(statusFilter).toBeVisible()
  })
})

test.describe('과제 지원 프로세스', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'coach')
  })

  test('과제 지원 페이지 로드', async ({ page }) => {
    await page.goto('/projects')

    // 테이블 로드 대기
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    // 지원하기 버튼이 있는 과제 찾기
    const applyButton = page.locator('button:has-text("지원하기")').first()
    if (await applyButton.isVisible()) {
      await applyButton.click()

      // 지원 페이지 로드 확인
      await page.waitForURL(/\/projects\/\d+\/apply/, { timeout: 10000 })

      // 폼 요소 확인
      await expect(page.locator('.ant-form')).toBeVisible({ timeout: 10000 })
    }
  })

  test('지원서 작성 폼 요소 확인', async ({ page }) => {
    await page.goto('/projects')

    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const applyButton = page.locator('button:has-text("지원하기")').first()
    if (await applyButton.isVisible()) {
      await applyButton.click()
      await page.waitForURL(/\/projects\/\d+\/apply/, { timeout: 10000 })

      // 기본정보 탭 확인
      await expect(page.locator('text=기본정보')).toBeVisible()

      // 제출 버튼 확인
      await expect(page.getByRole('button', { name: /제출/i })).toBeVisible()
    }
  })
})
