import { test, expect } from '@playwright/test'
import { loginAsSuperAdmin } from './fixtures/auth'

test.describe('TC-2.1: 프로필 관리', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('TC-2.1.1: 프로필 편집 페이지 접근', async ({ page }) => {
    await page.goto('/profile/edit')

    // Check that profile edit page loads
    await expect(page.getByRole('heading', { name: /프로필|profile/i })).toBeVisible()

    // Check for tabs
    const basicInfoTab = page.getByRole('tab', { name: /기본정보/i })
    const detailTab = page.getByRole('tab', { name: /세부정보/i })

    await expect(basicInfoTab).toBeVisible()
    await expect(detailTab).toBeVisible()
  })

  test('TC-2.1.2: 기본정보 탭 내용 확인', async ({ page }) => {
    await page.goto('/profile/edit')

    // Click on basic info tab if not already selected
    const basicInfoTab = page.getByRole('tab', { name: /기본정보/i })
    await basicInfoTab.click()

    // Check for form fields
    await expect(page.getByText(/이름/i)).toBeVisible()
    await expect(page.getByText(/이메일/i)).toBeVisible()
    await expect(page.getByText(/전화번호/i)).toBeVisible()
  })

  test('TC-2.1.3: 세부정보 탭 접근', async ({ page }) => {
    await page.goto('/profile/edit')

    // Click on detail tab
    const detailTab = page.getByRole('tab', { name: /세부정보/i })
    await detailTab.click()

    // Wait for content to load
    await page.waitForTimeout(1000)

    // Check for competency sections
    const pageContent = await page.textContent('body')
    expect(
      pageContent?.includes('자격증') ||
      pageContent?.includes('학력') ||
      pageContent?.includes('역량') ||
      pageContent?.includes('연수')
    ).toBeTruthy()
  })
})

test.describe('TC-2.2: 세부정보 (역량 관리)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('TC-2.2.1: 역량 목록 확인', async ({ page }) => {
    await page.goto('/coach/competencies')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check that competency page loads
    await expect(page.getByRole('heading', { name: /역량|세부정보|competenc/i })).toBeVisible()
  })

  test('TC-2.2.2: 카테고리별 역량 섹션 확인', async ({ page }) => {
    await page.goto('/coach/competencies')

    await page.waitForLoadState('networkidle')

    // Check for collapsible sections or categories
    const pageContent = await page.textContent('body')

    // Should contain various category sections
    const hasCategories = (
      pageContent?.includes('자격증') ||
      pageContent?.includes('학력') ||
      pageContent?.includes('연수') ||
      pageContent?.includes('경력')
    )

    expect(hasCategories).toBeTruthy()
  })
})
