/**
 * 세부정보(역량) 관리 E2E 테스트
 *
 * 이 테스트들은 로그인이 필요하므로 환경변수로 테스트 계정을 설정해야 합니다:
 *   TEST_COACH_EMAIL=<코치 이메일>
 *   TEST_COACH_PASSWORD=<코치 비밀번호>
 */
import { test, expect } from '@playwright/test'
import { login, hasTestCredentials } from './helpers/auth'

const skipIfNoCredentials = !hasTestCredentials('coach')

test.describe('세부정보 관리 기능', () => {
  test.skip(skipIfNoCredentials, '코치 계정 미설정 - TEST_COACH_EMAIL, TEST_COACH_PASSWORD 환경변수 필요')

  test.beforeEach(async ({ page }) => {
    await login(page, 'coach')
  })

  test('세부정보 관리 페이지 접근 가능', async ({ page }) => {
    // 사용자 메뉴에서 세부정보 관리 클릭
    await page.click('.ant-avatar')
    await page.locator('.ant-dropdown-menu-item:has-text("세부정보 관리")').click()

    await page.waitForURL('/coach/competencies', { timeout: 10000 })

    // 페이지 제목 확인
    await expect(page.locator('h2', { hasText: '역량 및 세부정보 관리' })).toBeVisible()
  })

  test('역량 카테고리 섹션 표시', async ({ page }) => {
    await page.goto('/coach/competencies')

    // 기본 섹션들 확인 (Collapse 헤더)
    await expect(page.locator('.ant-collapse-header:has-text("기본정보")').first()).toBeVisible()
    await expect(page.locator('.ant-collapse-header:has-text("자격증")').first()).toBeVisible()
    await expect(page.locator('.ant-collapse-header:has-text("학력")').first()).toBeVisible()
  })

  test('역량 추가 버튼 동작', async ({ page }) => {
    await page.goto('/coach/competencies')

    // 자격증 섹션 펼치기
    await page.click('.ant-collapse-header:has-text("자격증")')

    // 추가 버튼 찾기
    const addButton = page.locator('button:has-text("+ 추가")').first()
    if (await addButton.isVisible()) {
      await addButton.click()

      // 모달 확인
      await expect(page.locator('.ant-modal')).toBeVisible()
      await expect(page.locator('text=역량 추가')).toBeVisible()
    }
  })

  test('페이지 정상 로드 확인', async ({ page }) => {
    await page.goto('/coach/competencies')

    // 페이지 콘텐츠가 정상 로드되는지 확인
    await expect(page.locator('.ant-card').first()).toBeVisible({ timeout: 10000 })

    // 페이지 제목이 정상 표시되는지 확인
    await expect(page.locator('h2', { hasText: '역량 및 세부정보 관리' })).toBeVisible()
  })
})
