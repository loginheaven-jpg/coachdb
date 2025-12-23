import { test, expect } from '@playwright/test'
import { loginAsSuperAdmin, login, generateTestEmail, generateTestPhone } from './fixtures/auth'

test.describe('TC-11: 전체 플로우 시나리오', () => {
  test('TC-11.1.1: 관리자 대시보드 → 사용자 관리 → 과제 관리 플로우', async ({ page }) => {
    await loginAsSuperAdmin(page)

    // Step 1: Check admin dashboard
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('heading', { name: /관리자 대시보드/i })).toBeVisible()

    // Step 2: Navigate to user management
    await page.getByRole('button', { name: /사용자.*관리/i }).click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/users/)

    // Step 3: Navigate to project management
    await page.goto('/admin/projects')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/projects/)

    // Step 4: Navigate to verifications
    await page.goto('/admin/verifications')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /증빙|검증/i })).toBeVisible()
  })

  test('TC-11.1.2: 코치 대시보드 → 역량관리 → 지원서 플로우', async ({ page }) => {
    await loginAsSuperAdmin(page)

    // Step 1: Check coach dashboard
    await page.goto('/coach/dashboard')
    await page.waitForLoadState('networkidle')

    // Check dashboard loads (may redirect to admin for super admin)
    const url = page.url()
    expect(url.includes('dashboard')).toBeTruthy()

    // Step 2: Navigate to competencies
    await page.goto('/coach/competencies')
    await page.waitForLoadState('networkidle')

    // Check competencies page
    const pageContent = await page.textContent('body')
    expect(
      pageContent?.includes('역량') ||
      pageContent?.includes('세부정보') ||
      pageContent?.includes('자격증')
    ).toBeTruthy()

    // Step 3: Navigate to my applications
    await page.goto('/coach/my-applications')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /지원서/i })).toBeVisible()

    // Step 4: Navigate to projects list
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /과제|프로젝트/i })).toBeVisible()
  })

  test('TC-11.1.3: 프로필 편집 전체 탭 순회', async ({ page }) => {
    await loginAsSuperAdmin(page)

    await page.goto('/profile/edit')
    await page.waitForLoadState('networkidle')

    // Check basic info tab
    const basicInfoTab = page.getByRole('tab', { name: /기본정보/i })
    if (await basicInfoTab.isVisible()) {
      await basicInfoTab.click()
      await page.waitForTimeout(500)
    }

    // Check detail tab
    const detailTab = page.getByRole('tab', { name: /세부정보/i })
    if (await detailTab.isVisible()) {
      await detailTab.click()
      await page.waitForTimeout(500)

      // Wait for content to load
      await page.waitForLoadState('networkidle')
    }
  })
})

test.describe('TC-12: 에러 처리 및 예외 상황', () => {
  test('TC-12.2.1: 권한 없는 페이지 직접 접근', async ({ page }) => {
    // Try to access admin page without login
    await page.goto('/admin/users')

    // Should be redirected to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('TC-12.2.2: 존재하지 않는 페이지 접근', async ({ page }) => {
    await loginAsSuperAdmin(page)

    // Access non-existent page
    await page.goto('/nonexistent-page-12345')

    await page.waitForLoadState('networkidle')

    // Should show 404 or redirect to a valid page
    const url = page.url()
    const pageContent = await page.textContent('body')

    expect(
      url.includes('404') ||
      url.includes('dashboard') ||
      url.includes('login') ||
      pageContent?.includes('404') ||
      pageContent?.includes('찾을 수 없')
    ).toBeTruthy()
  })
})

test.describe('TC-13: UI/UX 테스트', () => {
  test('TC-13.1.1: 기본 레이아웃 확인', async ({ page }) => {
    await loginAsSuperAdmin(page)

    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    // Check for header
    const header = page.locator('header, .ant-layout-header')
    const hasHeader = await header.isVisible().catch(() => false)

    // Check for sidebar/menu
    const sidebar = page.locator('aside, .ant-layout-sider, nav')
    const hasSidebar = await sidebar.isVisible().catch(() => false)

    // Check for main content area
    const main = page.locator('main, .ant-layout-content')
    const hasMain = await main.isVisible().catch(() => false)

    expect(hasHeader || hasSidebar || hasMain).toBeTruthy()
  })

  test('TC-13.2.2: 폼 유효성 메시지 - 로그인', async ({ page }) => {
    await page.goto('/login')

    // Try to submit empty form
    await page.getByRole('button', { name: /로그인/i }).click()

    // Should show validation errors
    await page.waitForTimeout(500)

    const pageContent = await page.textContent('body')
    expect(
      pageContent?.includes('입력') ||
      pageContent?.includes('필수') ||
      pageContent?.includes('required')
    ).toBeTruthy()
  })
})

test.describe('TC-14: 성능 테스트', () => {
  test('TC-14.1.1: 페이지 로딩 시간 측정', async ({ page }) => {
    const startTime = Date.now()

    await loginAsSuperAdmin(page)

    const loginTime = Date.now() - startTime

    // Login should complete within 10 seconds
    expect(loginTime).toBeLessThan(10000)

    // Navigate to admin dashboard
    const navStartTime = Date.now()
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const navTime = Date.now() - navStartTime

    // Navigation should complete within 5 seconds
    expect(navTime).toBeLessThan(5000)
  })

  test('TC-14.1.2: 사용자 목록 로딩', async ({ page }) => {
    await loginAsSuperAdmin(page)

    const startTime = Date.now()
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Wait for table to load
    await page.locator('table tbody tr').first().waitFor({ timeout: 10000 })

    const loadTime = Date.now() - startTime

    // User list should load within 10 seconds
    expect(loadTime).toBeLessThan(10000)
  })
})
