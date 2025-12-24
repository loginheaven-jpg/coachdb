import { Page, expect } from '@playwright/test'

// Test accounts
export const TEST_ACCOUNTS = {
  SUPER_ADMIN: {
    email: 'loginheaven@gmail.com',
    password: '1234qwer',
    roles: ['SUPER_ADMIN', 'PROJECT_MANAGER', 'VERIFIER', 'REVIEWER', 'COACH']
  },
  COACH: {
    email: 'viproject@naver.com',
    password: '111111',
    roles: ['COACH']
  },
  // Add more test accounts as needed
}

/**
 * Login helper function
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')

  // Wait for login form to be visible
  await expect(page.getByRole('heading', { name: /로그인/i })).toBeVisible()

  // Fill login form
  await page.getByPlaceholder(/이메일|email/i).fill(email)
  await page.getByPlaceholder(/비밀번호|password/i).fill(password)

  // Click login button (use exact match to avoid matching header login link)
  await page.getByRole('button', { name: '로그인', exact: true }).click()

  // Wait for navigation away from login page
  await expect(page).not.toHaveURL(/\/login/)
}

/**
 * Login as Super Admin
 */
export async function loginAsSuperAdmin(page: Page) {
  const { email, password } = TEST_ACCOUNTS.SUPER_ADMIN
  await login(page, email, password)
}

/**
 * Logout helper function
 */
export async function logout(page: Page) {
  // Click user menu or logout button
  const logoutButton = page.getByRole('button', { name: /로그아웃|logout/i })
  if (await logoutButton.isVisible()) {
    await logoutButton.click()
  } else {
    // Try clicking user dropdown first
    const userMenu = page.locator('[data-testid="user-menu"]')
    if (await userMenu.isVisible()) {
      await userMenu.click()
      await page.getByRole('menuitem', { name: /로그아웃/i }).click()
    }
  }

  // Wait for redirect to login page
  await expect(page).toHaveURL(/\/login/)
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for elements that only appear when logged in
  const dashboardLink = page.getByRole('link', { name: /대시보드|dashboard/i })
  return await dashboardLink.isVisible({ timeout: 2000 }).catch(() => false)
}

/**
 * Get current user roles from the page (if displayed)
 */
export async function getCurrentUserRoles(page: Page): Promise<string[]> {
  // This depends on how roles are displayed in your UI
  // Adjust selector as needed
  const roleElements = page.locator('[data-testid="user-role"]')
  const count = await roleElements.count()
  const roles: string[] = []
  for (let i = 0; i < count; i++) {
    const text = await roleElements.nth(i).textContent()
    if (text) roles.push(text)
  }
  return roles
}

/**
 * Generate unique email for test registration
 */
export function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `test_${timestamp}_${random}@test.com`
}

/**
 * Generate unique phone number for test
 */
export function generateTestPhone(): string {
  const random = Math.floor(Math.random() * 90000000) + 10000000
  return `010-${random.toString().slice(0, 4)}-${random.toString().slice(4)}`
}
