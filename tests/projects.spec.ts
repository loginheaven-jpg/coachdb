import { test, expect } from '@playwright/test'
import { loginAsSuperAdmin } from './fixtures/auth'

test.describe('TC-3: 과제(프로젝트) 관리', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('TC-3.1: 과제 목록 조회', async ({ page }) => {
    await page.goto('/projects')

    await page.waitForLoadState('networkidle')

    // Check page title or heading
    await expect(page.getByRole('heading', { name: /과제|프로젝트|project/i })).toBeVisible()
  })

  test('TC-3.2: 관리자 과제 관리 페이지 접근', async ({ page }) => {
    await page.goto('/admin/projects')

    await page.waitForLoadState('networkidle')

    // Should be able to access admin project management
    await expect(page).toHaveURL(/\/admin\/projects/)
  })

  test('TC-3.3: 새 과제 생성 페이지 접근', async ({ page }) => {
    await page.goto('/admin/projects/create')

    await page.waitForLoadState('networkidle')

    // Check for create form
    await expect(page.getByRole('heading', { name: /과제.*생성|새.*과제|create.*project/i })).toBeVisible()
  })
})

test.describe('TC-3.2: 설문항목 구성', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('TC-3.2.1: 과제 편집 탭 구조 확인', async ({ page }) => {
    // First, get a project ID from the list
    await page.goto('/admin/projects')
    await page.waitForLoadState('networkidle')

    // Check if there are any projects
    const projectLinks = page.locator('a[href*="/admin/projects/"]')
    const count = await projectLinks.count()

    if (count > 0) {
      // Click on first project to edit
      await projectLinks.first().click()

      await page.waitForLoadState('networkidle')

      // Check for tabs in edit page
      const hasBasicInfoTab = await page.getByRole('tab', { name: /기본정보/i }).isVisible().catch(() => false)
      const hasSurveyTab = await page.getByRole('tab', { name: /설문/i }).isVisible().catch(() => false)

      expect(hasBasicInfoTab || hasSurveyTab).toBeTruthy()
    } else {
      // Skip test if no projects exist
      test.skip()
    }
  })
})

test.describe('TC-4: 지원서 관리', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('TC-4.1: 내 지원서 목록 페이지 접근', async ({ page }) => {
    await page.goto('/coach/my-applications')

    await page.waitForLoadState('networkidle')

    // Check page loads
    const heading = page.getByRole('heading', { name: /지원서|application/i })
    await expect(heading).toBeVisible()
  })
})
