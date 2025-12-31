/**
 * 심사 및 선발 E2E 테스트
 *
 * 이 테스트들은 관리자 로그인이 필요하므로 환경변수로 테스트 계정을 설정해야 합니다:
 *   TEST_ADMIN_EMAIL=<관리자 이메일>
 *   TEST_ADMIN_PASSWORD=<관리자 비밀번호>
 */
import { test, expect } from '@playwright/test'
import { login, hasTestCredentials } from './helpers/auth'

const skipIfNoCredentials = !hasTestCredentials('admin')

test.describe('심사 및 선발 기능', () => {
  test.skip(skipIfNoCredentials, '관리자 계정 미설정 - TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD 환경변수 필요')

  test.beforeEach(async ({ page }) => {
    await login(page, 'admin')
  })

  test('과제관리 페이지에서 과제 상세로 이동', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      // 첫 번째 과제의 상세 버튼 클릭
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      // 과제 상세 페이지 확인
      await expect(page.locator('.ant-card').first()).toBeVisible()
    }
  })

  test('과제 상세에서 심사 및 선발 버튼 존재', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      // 심사 및 선발 버튼 확인
      await expect(page.getByRole('button', { name: /심사 및 선발/i })).toBeVisible()
    }
  })

  test('심사 및 선발 페이지 접근', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      // 심사 및 선발 버튼 클릭
      await page.getByRole('button', { name: /심사 및 선발/i }).click()
      await page.waitForURL(/\/projects\/manage\/\d+\/review/, { timeout: 10000 })

      // 페이지 제목 확인
      await expect(page.locator('h2:has-text("심사 및 선발")')).toBeVisible()
    }
  })

  test('심사 페이지 통계 카드 표시', async ({ page }) => {
    // 직접 심사 페이지로 이동 (첫 번째 과제)
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      await page.getByRole('button', { name: /심사 및 선발/i }).click()
      await page.waitForURL(/\/projects\/manage\/\d+\/review/, { timeout: 10000 })

      // 통계 카드들 확인
      await expect(page.locator('.ant-statistic-title:has-text("전체 응모")')).toBeVisible()
      await expect(page.locator('.ant-statistic-title:has-text("평가 완료")')).toBeVisible()
      await expect(page.locator('.ant-statistic-title:has-text("선발 완료")')).toBeVisible()
    }
  })

  test('점수 계산 버튼 동작', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      await page.getByRole('button', { name: /심사 및 선발/i }).click()
      await page.waitForURL(/\/projects\/manage\/\d+\/review/, { timeout: 10000 })

      // 정량점수 계산 버튼 확인
      await expect(page.getByRole('button', { name: /정량점수 계산/i })).toBeVisible()

      // 최종점수 집계 버튼 확인
      await expect(page.getByRole('button', { name: /최종점수 집계/i })).toBeVisible()

      // 선발 추천 버튼 확인
      await expect(page.getByRole('button', { name: /선발 추천/i })).toBeVisible()
    }
  })

  test('가중치 설정 모달', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      await page.getByRole('button', { name: /심사 및 선발/i }).click()
      await page.waitForURL(/\/projects\/manage\/\d+\/review/, { timeout: 10000 })

      // 가중치 설정 버튼 클릭
      await page.getByRole('button', { name: /가중치 설정/i }).click()

      // 모달 표시 확인
      await expect(page.locator('.ant-modal-title:has-text("평가 가중치 설정")')).toBeVisible()

      // 모달 닫기
      await page.locator('.ant-modal-close').click()
    }
  })

  test('선발 추천 모달', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      await page.getByRole('button', { name: /심사 및 선발/i }).click()
      await page.waitForURL(/\/projects\/manage\/\d+\/review/, { timeout: 10000 })

      // 선발 추천 버튼 클릭
      await page.getByRole('button', { name: /선발 추천/i }).click()

      // 모달 표시 확인
      await expect(page.locator('.ant-modal-title:has-text("선발 추천 및 확정")')).toBeVisible()

      // 모달 닫기
      await page.locator('.ant-modal-close').click()
    }
  })

  test('응모자 테이블 표시', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      await page.getByRole('button', { name: /심사 및 선발/i }).click()
      await page.waitForURL(/\/projects\/manage\/\d+\/review/, { timeout: 10000 })

      // 응모자 목록 카드 확인
      await expect(page.locator('.ant-card-head-title:has-text("응모자 목록")')).toBeVisible()

      // 테이블 확인
      await expect(page.locator('.ant-table')).toBeVisible()
    }
  })
})
