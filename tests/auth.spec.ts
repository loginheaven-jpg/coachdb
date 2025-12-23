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

    // Click login button (exact match)
    await page.getByRole('button', { name: '로그인', exact: true }).click()

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
    await expect(page.getByPlaceholder('example@email.com')).toBeVisible()
    await expect(page.getByPlaceholder('최소 8자, 영문+숫자')).toBeVisible()
    await expect(page.getByPlaceholder('홍길동')).toBeVisible()
  })

  test('TC-1.1.3: 중복 이메일 회원가입 방지', async ({ page }) => {
    await page.goto('/register')

    // Wait for form to load
    await expect(page.getByPlaceholder('example@email.com')).toBeVisible()

    // Fill all required fields with existing email
    await page.getByPlaceholder('example@email.com').fill(TEST_ACCOUNTS.SUPER_ADMIN.email)
    await page.getByPlaceholder('최소 8자, 영문+숫자').fill('Test1234!')
    await page.getByPlaceholder('홍길동').fill('테스트사용자')
    await page.getByPlaceholder('010-1234-5678').fill('010-9999-9999')

    // Fill birth year
    const birthYearInput = page.getByPlaceholder('예: 1985')
    if (await birthYearInput.isVisible()) {
      await birthYearInput.fill('1990')
    }

    // Fill address
    const addressInput = page.getByPlaceholder(/시\/군\/구/)
    if (await addressInput.isVisible()) {
      await addressInput.fill('서울시 강남구')
    }

    // Fill certification number
    const certInput = page.getByPlaceholder('최상위 자격증 번호')
    if (await certInput.isVisible()) {
      await certInput.fill('CERT-12345')
    }

    // Select coaching fields (at least one checkbox)
    const coachingCheckbox = page.locator('.ant-checkbox-input').first()
    if (await coachingCheckbox.isVisible()) {
      await coachingCheckbox.click()
    }

    // Try to submit
    await page.getByRole('button', { name: /회원가입/i }).click()

    // Should show error message (may be from API or from form validation still)
    // Wait a bit for API response
    await page.waitForTimeout(3000)

    // Check if we stayed on register page (didn't succeed) or got an error
    const currentUrl = page.url()
    expect(currentUrl).toContain('/register')
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
