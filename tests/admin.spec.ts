import { test, expect } from '@playwright/test'
import { loginAsSuperAdmin } from './fixtures/auth'

test.describe('TC-9: 관리자 기능', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('TC-9.1.1: 사용자 목록 조회', async ({ page }) => {
    await page.goto('/admin/users')

    await page.waitForLoadState('networkidle')

    // Check page title
    await expect(page.getByRole('heading', { name: /사용자.*관리|user.*management/i })).toBeVisible()

    // Check for user table
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Check for expected columns
    const headerText = await page.locator('thead').textContent()
    expect(headerText).toContain('이메일')
    expect(headerText).toContain('역할')
  })

  test('TC-9.1.2: 시스템 설정 - Verifier Count', async ({ page }) => {
    await page.goto('/admin/users')

    await page.waitForLoadState('networkidle')

    // Check for system config section
    await expect(page.getByText(/시스템 설정/i)).toBeVisible()
    await expect(page.getByText(/증빙 확정 필요 Verifier 수/i)).toBeVisible()

    // Check for input number field
    const verifierCountInput = page.locator('input[type="number"]').first()
    await expect(verifierCountInput).toBeVisible()

    // Check for save button
    const saveButton = page.getByRole('button', { name: /저장/i }).first()
    await expect(saveButton).toBeVisible()
  })

  test('TC-9.1.3: Verifier Count 수정', async ({ page }) => {
    await page.goto('/admin/users')

    await page.waitForLoadState('networkidle')

    // Find the verifier count input
    const verifierCountInput = page.locator('.ant-input-number-input').first()

    // Clear and set new value
    await verifierCountInput.clear()
    await verifierCountInput.fill('3')

    // Click save button
    const saveButton = page.getByRole('button', { name: /저장/i }).first()
    await saveButton.click()

    // Wait for success message
    await expect(page.getByText(/저장|성공|success/i)).toBeVisible({ timeout: 5000 })
  })

  test('TC-9.1.4: 사용자 역할 편집 모달', async ({ page }) => {
    await page.goto('/admin/users')

    await page.waitForLoadState('networkidle')

    // Find and click role edit button on first user
    const roleEditButton = page.getByRole('button', { name: /역할 편집|edit role/i }).first()

    if (await roleEditButton.isVisible()) {
      await roleEditButton.click()

      // Wait for modal
      await page.waitForTimeout(500)

      // Check modal is visible
      const modal = page.locator('.ant-modal-content')
      await expect(modal).toBeVisible()

      // Check for role checkboxes
      await expect(page.getByText(/코치|COACH/i)).toBeVisible()
      await expect(page.getByText(/증빙확인자|VERIFIER/i)).toBeVisible()
    }
  })
})

test.describe('TC-9.2: 역량 항목 관리', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page)
  })

  test('TC-9.2.1: 시스템 역량 항목 목록', async ({ page }) => {
    await page.goto('/admin/competency-items')

    await page.waitForLoadState('networkidle')

    // Check page loads
    await expect(page).toHaveURL(/\/admin\/competency-items/)

    // Check for competency items content
    const pageContent = await page.textContent('body')
    expect(
      pageContent?.includes('항목') ||
      pageContent?.includes('역량') ||
      pageContent?.includes('설문')
    ).toBeTruthy()
  })
})
