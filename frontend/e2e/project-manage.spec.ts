/**
 * 과제관리 E2E 테스트
 *
 * 이 테스트들은 관리자 로그인이 필요하므로 환경변수로 테스트 계정을 설정해야 합니다:
 *   TEST_ADMIN_EMAIL=<관리자 이메일>
 *   TEST_ADMIN_PASSWORD=<관리자 비밀번호>
 */
import { test, expect } from '@playwright/test'
import { login, hasTestCredentials } from './helpers/auth'

const skipIfNoCredentials = !hasTestCredentials('admin')

test.describe('과제관리 기능 (관리자)', () => {
  test.skip(skipIfNoCredentials, '관리자 계정 미설정 - TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD 환경변수 필요')

  test.beforeEach(async ({ page }) => {
    await login(page, 'admin')
  })

  test('과제관리 메뉴가 관리자에게만 표시됨', async ({ page }) => {
    await expect(page.locator('text=과제관리')).toBeVisible()
  })

  test('과제관리 페이지 접근 가능', async ({ page }) => {
    await page.click('text=과제관리')
    await page.waitForURL('/projects/manage', { timeout: 10000 })

    // 페이지 제목 확인
    await expect(page.locator('h2', { hasText: '과제 관리' })).toBeVisible()
  })

  test('새 과제 생성 버튼 표시', async ({ page }) => {
    await page.goto('/projects/manage')
    await expect(page.getByRole('button', { name: /새 과제 생성/i })).toBeVisible()
  })

  test('새 과제 생성 페이지 접근 가능', async ({ page }) => {
    await page.goto('/projects/manage')
    await page.click('text=새 과제 생성')
    await page.waitForURL('/projects/create', { timeout: 10000 })

    // 폼 필드 확인
    await expect(page.locator('input[id*="project_name"]')).toBeVisible()
  })

  test('과제 상세 버튼 동작', async ({ page }) => {
    await page.goto('/projects/manage')

    // 테이블 로드 대기
    await page.waitForSelector('.ant-table-row', { timeout: 15000 })

    const rows = await page.locator('.ant-table-row').count()
    if (rows > 0) {
      // 첫 번째 과제의 상세 버튼 클릭
      await page.locator('.ant-table-row').first().locator('text=상세').click()
      await page.waitForURL(/\/projects\/manage\/\d+/, { timeout: 10000 })

      // 과제 상세 페이지 확인
      await expect(page.locator('.ant-card')).toBeVisible()
    }
  })
})
