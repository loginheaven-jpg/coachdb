/**
 * 과제참여 E2E 테스트
 */
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('과제참여 기능', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'coach')
  })

  test('과제참여 메뉴 클릭 시 과제 목록 표시', async ({ page }) => {
    await page.click('text=과제참여')
    await page.waitForURL('/projects', { timeout: 10000 })

    // 페이지 제목 확인
    await expect(page.locator('h2', { hasText: '과제 참여' })).toBeVisible()

    // 테이블이 로드될 때까지 대기
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 })
  })

  test('통계 카드가 표시됨', async ({ page }) => {
    await page.goto('/projects')

    // 통계 카드 확인
    await expect(page.locator('text=모집중 과제')).toBeVisible()
    await expect(page.locator('text=지원 완료')).toBeVisible()
    await expect(page.locator('text=미지원')).toBeVisible()
  })

  test('과제에 지원하기 버튼이 표시됨', async ({ page }) => {
    await page.goto('/projects')

    // 과제 목록 로드 대기
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    // 테이블 행 확인
    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      // 첫 번째 과제에 지원하기 또는 지원완료 버튼이 있어야 함
      const firstRow = page.locator('.ant-table-row').first()
      const hasApplyButton = await firstRow.locator('text=지원하기').isVisible()
      const hasAppliedTag = await firstRow.locator('text=지원완료').isVisible()
      expect(hasApplyButton || hasAppliedTag).toBeTruthy()
    }
  })
})
