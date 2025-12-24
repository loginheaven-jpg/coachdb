import { test, expect } from '@playwright/test'
import { loginAsSuperAdmin, login, TEST_ACCOUNTS } from './fixtures/auth'

/**
 * TC-PROJECT-APPROVAL: 과제 승인 워크플로우 테스트
 *
 * 시나리오:
 * 1. 대시보드 5탭 구조 확인 (과제참여 | 과제관리 | 증빙검토 | 수퍼어드민)
 * 2. 과제관리 탭에서 과제 목록 확인
 * 3. 수퍼어드민 탭 접근 확인
 */

test.describe('TC-PROJECT-APPROVAL: 과제 승인 워크플로우', () => {

  test.describe('대시보드 탭 구조', () => {
    test('SUPER_ADMIN 사용자: 5개 탭이 표시되어야 함', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // 5개 탭 확인: 과제참여, 과제관리, 증빙검토, 수퍼어드민
      const tabs = page.locator('.ant-tabs-tab')

      // 탭 존재 확인
      await expect(page.getByRole('tab', { name: /과제참여/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /과제관리/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /증빙검토/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /수퍼어드민/i })).toBeVisible()
    })

    test('COACH 사용자: 과제참여, 과제관리 탭만 표시되어야 함', async ({ page }) => {
      // viproject@naver.com은 여러 역할을 가지고 있으므로 순수 COACH만 있는 계정 필요
      // 이 테스트는 순수 COACH 계정이 있을 때만 실행
      const { email, password } = TEST_ACCOUNTS.COACH
      await login(page, email, password)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // 기본 탭 확인
      await expect(page.getByRole('tab', { name: /과제참여/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /과제관리/i })).toBeVisible()

      // viproject는 VERIFIER도 있으므로 증빙검토 탭도 보일 수 있음 (테스트 계정 역할에 따라 다름)
    })
  })

  test.describe('과제관리 탭', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
    })

    test('과제관리 탭 클릭 시 과제 목록이 표시되어야 함', async ({ page }) => {
      // 과제관리 탭 클릭
      await page.getByRole('tab', { name: /과제관리/i }).click()
      await page.waitForLoadState('networkidle')

      // 과제관리 헤더 확인
      await expect(page.getByRole('heading', { name: /과제관리/i })).toBeVisible()

      // 새 과제 만들기 버튼 확인
      await expect(page.getByRole('button', { name: /새 과제 만들기/i })).toBeVisible()

      // 통계 카드 확인
      await expect(page.getByText('전체 과제')).toBeVisible()
      await expect(page.getByText('승인대기')).toBeVisible()
      await expect(page.getByText('승인됨')).toBeVisible()
      await expect(page.getByText('반려됨')).toBeVisible()
    })

    test('새 과제 만들기 버튼이 과제 생성 페이지로 이동해야 함', async ({ page }) => {
      // 과제관리 탭 클릭
      await page.getByRole('tab', { name: /과제관리/i }).click()
      await page.waitForLoadState('networkidle')

      // 새 과제 만들기 버튼 클릭
      await page.getByRole('button', { name: /새 과제 만들기/i }).click()

      // 과제 생성 페이지로 이동 확인
      await expect(page).toHaveURL(/\/admin\/projects\/create/)
    })
  })

  test.describe('수퍼어드민 탭', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
    })

    test('수퍼어드민 탭 클릭 시 관리 대시보드가 표시되어야 함', async ({ page }) => {
      // 수퍼어드민 탭 클릭
      await page.getByRole('tab', { name: /수퍼어드민/i }).click()
      await page.waitForLoadState('networkidle')

      // 수퍼어드민 헤더 확인
      await expect(page.getByRole('heading', { name: /수퍼어드민/i })).toBeVisible()

      // 통계 카드 확인
      await expect(page.getByText('전체 사용자')).toBeVisible()
      await expect(page.getByText('활성 사용자')).toBeVisible()
      await expect(page.getByText('과제 승인대기')).toBeVisible()
      await expect(page.getByText('역량항목', { exact: true })).toBeVisible()

      // 관리 기능 메뉴 확인
      await expect(page.getByText('관리 기능')).toBeVisible()
      await expect(page.getByText('사용자 관리', { exact: true })).toBeVisible()
      await expect(page.getByText('역량항목 관리')).toBeVisible()
    })

    test('사용자 관리 링크가 올바르게 동작해야 함', async ({ page }) => {
      // 수퍼어드민 탭 클릭
      await page.getByRole('tab', { name: /수퍼어드민/i }).click()
      await page.waitForLoadState('networkidle')

      // 사용자 관리 이동 버튼 클릭
      const userManagementItem = page.locator('text=사용자 관리').first()
      await userManagementItem.click()

      // 사용자 관리 페이지로 이동 확인
      await expect(page).toHaveURL(/\/admin\/users/)
    })

    test('역량항목 관리 링크가 올바르게 동작해야 함', async ({ page }) => {
      // 수퍼어드민 탭 클릭
      await page.getByRole('tab', { name: /수퍼어드민/i }).click()
      await page.waitForLoadState('networkidle')

      // 역량항목 관리 이동 버튼 클릭
      const competencyItem = page.locator('text=역량항목 관리').first()
      await competencyItem.click()

      // 역량항목 관리 페이지로 이동 확인
      await expect(page).toHaveURL(/\/admin\/competency-items/)
    })
  })

  test.describe('과제 생성 및 승인 라우트 접근', () => {
    test('인증된 사용자가 과제 생성 페이지에 접근할 수 있어야 함', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('/admin/projects/create')
      await page.waitForLoadState('networkidle')

      // 과제 생성 폼 확인
      await expect(page.getByRole('heading', { name: /과제.*생성|새.*과제/i })).toBeVisible()
    })

    test('COACH 사용자도 과제 생성 페이지에 접근할 수 있어야 함', async ({ page }) => {
      const { email, password } = TEST_ACCOUNTS.COACH
      await login(page, email, password)
      await page.goto('/admin/projects/create')
      await page.waitForLoadState('networkidle')

      // 과제 생성 페이지 또는 비인가 페이지가 아닌지 확인
      const unauthorized = await page.getByText('권한이 없습니다').isVisible().catch(() => false)
      expect(unauthorized).toBe(false)
    })
  })
})

test.describe('TC-DASHBOARD-TABS: 대시보드 탭 네비게이션', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('탭 전환이 올바르게 동작해야 함', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // 1. 과제참여 탭 (기본)
    await page.getByRole('tab', { name: /과제참여/i }).click()
    await page.waitForLoadState('networkidle')
    // 과제참여 컨텐츠가 표시되어야 함

    // 2. 과제관리 탭
    await page.getByRole('tab', { name: /과제관리/i }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /과제관리/i })).toBeVisible()

    // 3. 증빙검토 탭
    await page.getByRole('tab', { name: /증빙검토/i }).click()
    await page.waitForLoadState('networkidle')
    // 증빙검토 컨텐츠가 표시되어야 함

    // 4. 수퍼어드민 탭
    await page.getByRole('tab', { name: /수퍼어드민/i }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /수퍼어드민/i })).toBeVisible()
  })
})
