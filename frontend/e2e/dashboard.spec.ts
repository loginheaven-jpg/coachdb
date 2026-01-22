/**
 * 대시보드 E2E 테스트
 *
 * 이 테스트들은 로그인이 필요하므로 환경변수로 테스트 계정을 설정해야 합니다:
 *   TEST_COACH_EMAIL=<코치 이메일>
 *   TEST_COACH_PASSWORD=<코치 비밀번호>
 *   TEST_ADMIN_EMAIL=<관리자 이메일>
 *   TEST_ADMIN_PASSWORD=<관리자 비밀번호>
 */
import { test, expect } from '@playwright/test'
import { login, hasTestCredentials } from './helpers/auth'

// 코치 계정이 설정되지 않으면 테스트 스킵
const skipIfNoCoachCredentials = !hasTestCredentials('coach')
const skipIfNoAdminCredentials = !hasTestCredentials('admin')

test.describe('대시보드', () => {
  test.skip(skipIfNoCoachCredentials, '코치 계정 미설정 - TEST_COACH_EMAIL, TEST_COACH_PASSWORD 환경변수 필요')

  test('로그인 후 대시보드로 이동', async ({ page }) => {
    await login(page, 'coach')

    // 대시보드 URL 확인
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('대시보드 메뉴 표시', async ({ page }) => {
    await login(page, 'coach')

    // 사이드 메뉴 항목 확인 (ant-menu 내부)
    await expect(page.locator('.ant-menu-item:has-text("대시보드")')).toBeVisible()
    await expect(page.locator('.ant-menu-item:has-text("과제참여")')).toBeVisible()
    await expect(page.locator('.ant-menu-item:has-text("내 지원서")')).toBeVisible()
  })

  test('사용자 드롭다운 메뉴 표시', async ({ page }) => {
    await login(page, 'coach')

    // 아바타 클릭
    await page.click('.ant-avatar')

    // 드롭다운 메뉴 항목 확인 (ant-dropdown 내부)
    await expect(page.locator('.ant-dropdown-menu-item:has-text("프로필 수정")')).toBeVisible()
    await expect(page.locator('.ant-dropdown-menu-item:has-text("세부정보 관리")')).toBeVisible()
    await expect(page.locator('.ant-dropdown-menu-item:has-text("로그아웃")')).toBeVisible()
  })
})

test.describe('관리자 기능', () => {
  test.skip(skipIfNoAdminCredentials, '관리자 계정 미설정 - TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD 환경변수 필요')

  test('관리자 메뉴 표시', async ({ page }) => {
    await login(page, 'admin')

    // 관리자 전용 메뉴 확인 (사이드 메뉴)
    await expect(page.locator('.ant-menu-item:has-text("과제관리")')).toBeVisible()
  })
})

test.describe('네비게이션', () => {
  test.skip(skipIfNoCoachCredentials, '코치 계정 미설정 - TEST_COACH_EMAIL, TEST_COACH_PASSWORD 환경변수 필요')

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

  test('PCMS 로고 클릭 시 대시보드로 이동', async ({ page }) => {
    // 과제참여 페이지로 이동 후 로드 대기
    await page.locator('.ant-menu-item:has-text("과제참여")').click()
    await page.waitForURL('/projects', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // 헤더의 PCMS 로고 클릭
    await page.locator('header .text-xl:has-text("PCMS")').click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
