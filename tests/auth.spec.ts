import { test, expect } from '@playwright/test'
import { login, loginAsSuperAdmin, logout, TEST_ACCOUNTS, generateTestEmail, generateTestPhone } from './fixtures/auth'

test.describe('TC-1.1: 회원가입 및 로그인', () => {
  test('TC-1.1.4: 로그인 실패 - 잘못된 비밀번호', async ({ page }) => {
    await page.goto('/login')

    // Wait for login form
    await expect(page.getByRole('heading', { name: /로그인/i })).toBeVisible()

    // Fill with wrong password
    await page.getByPlaceholder(/이메일|email/i).fill(TEST_ACCOUNTS.SUPER_ADMIN.email)
    await page.getByPlaceholder(/비밀번호|password/i).fill('wrongpassword123')

    // Click login button
    await page.getByRole('button', { name: /로그인/i }).click()

    // Expect error message
    await expect(page.getByText(/이메일 또는 비밀번호가 올바르지 않습니다|Incorrect email or password/i)).toBeVisible()
  })

  test('TC-1.1.5: 정상 로그인', async ({ page }) => {
    await loginAsSuperAdmin(page)

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/dashboard/)

    // Dashboard should show welcome message
    await expect(page.getByText(/환영합니다/i)).toBeVisible()
  })

  test('TC-1.1.1: 회원가입 페이지 접근', async ({ page }) => {
    await page.goto('/register')

    // Check registration form elements
    await expect(page.getByRole('heading', { name: /회원가입/i })).toBeVisible()
    await expect(page.getByPlaceholder(/이메일|email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/비밀번호|password/i)).toBeVisible()
    await expect(page.getByPlaceholder(/이름|name/i).first()).toBeVisible()
  })

  test('TC-1.1.3: 중복 이메일 회원가입 방지', async ({ page }) => {
    await page.goto('/register')

    // Fill form with existing email
    await page.getByPlaceholder(/이메일|email/i).fill(TEST_ACCOUNTS.SUPER_ADMIN.email)
    await page.getByPlaceholder(/비밀번호|password/i).fill('Test1234!')

    // Fill other required fields
    const nameInput = page.getByPlaceholder(/홍길동|이름/i)
    if (await nameInput.isVisible()) {
      await nameInput.fill('테스트')
    }

    const phoneInput = page.getByPlaceholder(/전화번호|010/i)
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('010-1234-5678')
    }

    // Try to submit
    await page.getByRole('button', { name: /회원가입/i }).click()

    // Should show error about duplicate email
    await expect(page.getByText(/이미 등록된|already registered|duplicate/i)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('TC-1.2: 역할 기반 접근 제어', () => {
  test('TC-1.2.4: SUPER_ADMIN 전체 권한 확인', async ({ page }) => {
    await loginAsSuperAdmin(page)

    // Check admin dashboard access
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('heading', { name: /관리자 대시보드/i })).toBeVisible()

    // Check users page access
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: /사용자.*관리/i })).toBeVisible()

    // Check competency items page access
    await page.goto('/admin/competency-items')
    await expect(page).toHaveURL(/\/admin\/competency-items/)
  })

  test('TC-1.2.1: 비로그인 사용자 접근 제어', async ({ page }) => {
    // Try to access admin page without login
    await page.goto('/admin/dashboard')

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/)
  })
})
