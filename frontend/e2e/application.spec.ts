/**
 * 지원서 관련 E2E 테스트
 *
 * 이 테스트들은 로그인이 필요하므로 환경변수로 테스트 계정을 설정해야 합니다:
 *   TEST_COACH_EMAIL=<코치 이메일>
 *   TEST_COACH_PASSWORD=<코치 비밀번호>
 */
import { test, expect } from '@playwright/test'
import { login, hasTestCredentials } from './helpers/auth'

const skipIfNoCredentials = !hasTestCredentials('coach')

test.describe('지원서 기능', () => {
  test.skip(skipIfNoCredentials, '코치 계정 미설정 - TEST_COACH_EMAIL, TEST_COACH_PASSWORD 환경변수 필요')

  test.beforeEach(async ({ page }) => {
    await login(page, 'coach')
  })

  test('내 지원서 페이지 접근 가능', async ({ page }) => {
    await page.locator('.ant-menu-item:has-text("내 지원서")').click()
    await page.waitForURL('/my-applications', { timeout: 10000 })

    // 페이지 제목 확인 (실제 제목: 참여 과제 리스트)
    await expect(page.locator('h2').filter({ hasText: '참여 과제 리스트' }).first()).toBeVisible()
  })

  test('지원서 목록이 표시됨', async ({ page }) => {
    await page.goto('/my-applications')

    // 테이블 로드 대기
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 })
  })

  test('지원서 테이블 컬럼 표시', async ({ page }) => {
    await page.goto('/my-applications')

    // 테이블 로드 대기
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 })

    // 주요 컬럼 확인
    await expect(page.locator('.ant-table-thead th').filter({ hasText: '과제명' }).first()).toBeVisible()
    await expect(page.locator('.ant-table-thead th').filter({ hasText: '참여 상태' }).first()).toBeVisible()
  })
})

test.describe('과제 지원 프로세스', () => {
  test.skip(skipIfNoCredentials, '코치 계정 미설정 - TEST_COACH_EMAIL, TEST_COACH_PASSWORD 환경변수 필요')

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

      // 개인정보 탭 확인
      await expect(page.locator('.ant-tabs-tab:has-text("개인정보")').first()).toBeVisible()

      // 제출 버튼 확인
      await expect(page.getByRole('button', { name: /제출/i })).toBeVisible()
    }
  })
})
