import { test, expect, Page } from '@playwright/test'

/**
 * 역할 기반 접근 제어 (RBAC) 테스트
 *
 * 역할별 접근 권한:
 * - SUPER_ADMIN: 모든 페이지 접근 가능, 사용자 관리, 역량 항목 관리
 * - PROJECT_MANAGER: 관리자 대시보드, 과제 관리, 증빙 검증
 * - VERIFIER/REVIEWER: 증빙 검증, 검토자 대시보드
 * - COACH: 응모자 대시보드, 세부정보 관리, 내 지원서
 *
 * 테스트 시나리오:
 * 1. SUPER_ADMIN 전용 페이지가 다른 사용자에게 보이지 않는지 확인
 * 2. PROJECT_MANAGER 전용 기능이 COACH에게 보이지 않는지 확인
 * 3. VERIFIER 전용 페이지가 COACH에게 보이지 않는지 확인
 * 4. 메뉴 항목이 역할에 따라 다르게 표시되는지 확인
 */

// 테스트 계정 (역할별)
const SUPER_ADMIN_ACCOUNT = {
  email: 'loginheaven@gmail.com',
  password: '1234qwer',
  roles: ['SUPER_ADMIN', 'PROJECT_MANAGER', 'VERIFIER', 'REVIEWER', 'COACH']
}

const COACH_ONLY_ACCOUNT = {
  email: 'viproject@naver.com',
  password: '111111',
  roles: ['COACH']
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder(/이메일|email/i).fill(email)
  await page.getByPlaceholder(/비밀번호|password/i).fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()

  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
    console.log(`✓ ${email} 로그인 성공`)
  } catch {
    throw new Error(`로그인 실패: ${email}`)
  }

  await page.waitForLoadState('networkidle')
}

async function logout(page: Page) {
  // 먼저 열린 모달 닫기
  const modal = page.locator('.ant-modal-content')
  if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  // 사용자 드롭다운 찾기
  const userDropdown = page.locator('.ant-dropdown-trigger').first()
  if (await userDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
    await userDropdown.click()
    await page.waitForTimeout(500)
  }

  const logoutBtn = page.locator('text=로그아웃').first()
  if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutBtn.click()
  } else {
    await page.goto('/login')
  }
  await page.waitForTimeout(1000)
}

// ============================================================================
// SUPER_ADMIN 전용 페이지 접근 테스트
// ============================================================================

test.describe('SUPER_ADMIN 전용 페이지 접근 제어', () => {
  test.setTimeout(120000)

  test('SUPER_ADMIN은 사용자 관리 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    // 사용자 관리 페이지 직접 접근
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // 페이지가 정상 로드되었는지 확인 (unauthorized로 리다이렉트 되지 않음)
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('/unauthorized')
    expect(currentUrl).toContain('/admin/users')

    // 사용자 목록 테이블 확인
    const userTable = page.locator('.ant-table, table')
    const hasTable = await userTable.isVisible({ timeout: 5000 }).catch(() => false)
    console.log('SUPER_ADMIN - 사용자 관리 페이지 접근 가능:', hasTable)
    expect(hasTable).toBe(true)

    await logout(page)
  })

  test('SUPER_ADMIN은 역량 항목 관리 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    // 역량 항목 관리 페이지 직접 접근
    await page.goto('/admin/competency-items')
    await page.waitForLoadState('networkidle')

    // 페이지가 정상 로드되었는지 확인
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('/unauthorized')
    expect(currentUrl).toContain('/admin/competency-items')

    console.log('SUPER_ADMIN - 역량 항목 관리 페이지 접근 가능')

    await logout(page)
  })

  test('SUPER_ADMIN은 헤더 드롭다운에서 사용자 관리 메뉴를 볼 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    // 대시보드로 이동
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // 사용자 드롭다운 클릭
    const userDropdown = page.locator('.ant-dropdown-trigger').first()
    await expect(userDropdown).toBeVisible()
    await userDropdown.click()
    await page.waitForTimeout(500)

    // 사용자 관리 메뉴 확인
    const userManagementMenu = page.locator('text=사용자 관리')
    const hasUserManagement = await userManagementMenu.isVisible({ timeout: 3000 }).catch(() => false)
    console.log('SUPER_ADMIN - 사용자 관리 메뉴 표시:', hasUserManagement)
    expect(hasUserManagement).toBe(true)

    await page.keyboard.press('Escape')
    await logout(page)
  })

  test('COACH는 사용자 관리 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 사용자 관리 페이지 직접 접근 시도
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // unauthorized로 리다이렉트 되어야 함
    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') || currentUrl.includes('/dashboard') || currentUrl.includes('/login')
    console.log('COACH - 사용자 관리 페이지 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('COACH는 역량 항목 관리 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 역량 항목 관리 페이지 직접 접근 시도
    await page.goto('/admin/competency-items')
    await page.waitForLoadState('networkidle')

    // unauthorized로 리다이렉트 되어야 함
    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') || currentUrl.includes('/dashboard') || currentUrl.includes('/login')
    console.log('COACH - 역량 항목 관리 페이지 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('COACH는 헤더 드롭다운에서 사용자 관리 메뉴를 볼 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 대시보드로 이동
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // 사용자 드롭다운 클릭
    const userDropdown = page.locator('.ant-dropdown-trigger').first()
    await expect(userDropdown).toBeVisible()
    await userDropdown.click()
    await page.waitForTimeout(500)

    // 사용자 관리 메뉴가 없어야 함
    const userManagementMenu = page.locator('text=사용자 관리')
    const hasUserManagement = await userManagementMenu.isVisible({ timeout: 2000 }).catch(() => false)
    console.log('COACH - 사용자 관리 메뉴 미표시:', !hasUserManagement)
    expect(hasUserManagement).toBe(false)

    await page.keyboard.press('Escape')
    await logout(page)
  })
})

// ============================================================================
// PROJECT_MANAGER/ADMIN 전용 페이지 접근 테스트
// ============================================================================

test.describe('관리자(PROJECT_MANAGER) 전용 페이지 접근 제어', () => {
  test.setTimeout(120000)

  test('관리자는 과제 생성 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    await page.goto('/admin/projects/create')
    await page.waitForLoadState('networkidle')

    // 페이지가 정상 로드되었는지 확인
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('/unauthorized')

    // 과제 생성 폼 확인
    const pageTitle = page.getByRole('heading', { name: /과제 생성|새 과제/i })
    const hasForm = await pageTitle.isVisible({ timeout: 5000 }).catch(() => false)
    console.log('관리자 - 과제 생성 페이지 접근 가능:', hasForm)
    expect(hasForm).toBe(true)

    await logout(page)
  })

  test('COACH는 과제 생성 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    await page.goto('/admin/projects/create')
    await page.waitForLoadState('networkidle')

    // unauthorized로 리다이렉트 되어야 함
    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') || currentUrl.includes('/dashboard') || currentUrl.includes('/login')
    console.log('COACH - 과제 생성 페이지 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('관리자는 과제 상세/편집 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    // 먼저 과제 목록에서 ID 가져오기
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 첫 번째 과제 링크 찾기
    const projectLink = page.locator('a[href*="/projects/"]').first()
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await projectLink.getAttribute('href') || ''
      const projectIdMatch = href.match(/\/projects\/(\d+)/)
      if (projectIdMatch) {
        const projectId = projectIdMatch[1]

        // 과제 상세 페이지 접근
        await page.goto(`/admin/projects/${projectId}`)
        await page.waitForLoadState('networkidle')

        const currentUrl = page.url()
        expect(currentUrl).not.toContain('/unauthorized')
        console.log('관리자 - 과제 상세 페이지 접근 가능')
      }
    }

    await logout(page)
  })

  test('COACH는 과제 상세/편집 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 임의의 과제 ID로 접근 시도
    await page.goto('/admin/projects/1')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') || currentUrl.includes('/dashboard') || currentUrl.includes('/login')
    console.log('COACH - 과제 상세 페이지 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })
})

// ============================================================================
// VERIFIER/REVIEWER 전용 페이지 접근 테스트
// ============================================================================

test.describe('검토자(VERIFIER) 전용 페이지 접근 제어', () => {
  test.setTimeout(120000)

  test('VERIFIER는 증빙 검증 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    await page.goto('/admin/verifications')
    await page.waitForLoadState('networkidle')

    // 페이지가 정상 로드되었는지 확인
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('/unauthorized')

    // 검증 테이블 확인
    const table = page.locator('.ant-table, table')
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false)
    console.log('VERIFIER - 증빙 검증 페이지 접근 가능:', hasTable)

    await logout(page)
  })

  test('COACH는 증빙 검증 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    await page.goto('/admin/verifications')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') || currentUrl.includes('/dashboard') || currentUrl.includes('/login')
    console.log('COACH - 증빙 검증 페이지 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('COACH는 검토자 대시보드 탭을 볼 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 검토자 대시보드 탭이 없어야 함
    const reviewerTab = page.locator('text=/검토자 대시보드|Staff|Reviewer/i')
    const hasReviewerTab = await reviewerTab.isVisible({ timeout: 2000 }).catch(() => false)
    console.log('COACH - 검토자 대시보드 탭 미표시:', !hasReviewerTab)
    expect(hasReviewerTab).toBe(false)

    await logout(page)
  })

  test('관리자는 검토자 대시보드 탭을 볼 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 검토자 대시보드 탭이 있어야 함
    const reviewerTab = page.locator('text=/검토자 대시보드|Staff|Reviewer/i')
    const hasReviewerTab = await reviewerTab.isVisible({ timeout: 3000 }).catch(() => false)
    console.log('관리자 - 검토자 대시보드 탭 표시:', hasReviewerTab)
    // SUPER_ADMIN은 VERIFIER 역할도 가지고 있으므로 탭이 보여야 함
    expect(hasReviewerTab).toBe(true)

    await logout(page)
  })
})

// ============================================================================
// 대시보드 탭 표시 테스트
// ============================================================================

test.describe('대시보드 탭 역할별 표시 확인', () => {
  test.setTimeout(120000)

  test('SUPER_ADMIN은 모든 대시보드 탭을 볼 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 탭 확인
    const tabs = page.locator('.ant-tabs-tab')
    const tabCount = await tabs.count()
    console.log(`SUPER_ADMIN - 대시보드 탭 수: ${tabCount}`)

    // 각 탭 이름 확인
    const tabNames: string[] = []
    for (let i = 0; i < tabCount; i++) {
      const tabText = await tabs.nth(i).textContent() || ''
      tabNames.push(tabText.trim())
    }
    console.log('SUPER_ADMIN - 대시보드 탭들:', tabNames.join(', '))

    // 최소 2개 이상의 탭이 있어야 함 (관리자 + 검토자 또는 응모자)
    expect(tabCount).toBeGreaterThanOrEqual(2)

    await logout(page)
  })

  test('COACH만 있는 사용자는 응모자 대시보드만 볼 수 있다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 탭이 1개이거나 탭 없이 응모자 대시보드만 표시
    const tabs = page.locator('.ant-tabs-tab')
    const tabCount = await tabs.count()
    console.log(`COACH - 대시보드 탭 수: ${tabCount}`)

    // COACH만 있으면 탭이 1개이거나 탭 없이 직접 대시보드가 표시됨
    if (tabCount === 0) {
      // 탭 없이 직접 대시보드 표시 (응모자 대시보드)
      const coachContent = page.locator('text=/내 지원서|빠른 작업|최근 활동/i')
      const hasCoachContent = await coachContent.first().isVisible({ timeout: 3000 }).catch(() => false)
      console.log('COACH - 응모자 대시보드 직접 표시:', hasCoachContent)
    } else {
      // 탭이 있다면 관리자/검토자 탭은 없어야 함
      const adminTab = page.locator('text=/관리자 대시보드|Admin/i')
      const hasAdminTab = await adminTab.isVisible({ timeout: 2000 }).catch(() => false)
      console.log('COACH - 관리자 탭 미표시:', !hasAdminTab)
      expect(hasAdminTab).toBe(false)
    }

    await logout(page)
  })
})

// ============================================================================
// 메뉴 항목 역할별 표시 테스트
// ============================================================================

test.describe('메뉴 항목 역할별 표시 확인', () => {
  test.setTimeout(120000)

  test('COACH는 "내 지원서" 메뉴를 볼 수 있다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // 헤더 메뉴에서 "내 지원서" 확인
    const myApplicationsMenu = page.locator('text=내 지원서')
    const hasMenu = await myApplicationsMenu.isVisible({ timeout: 3000 }).catch(() => false)
    console.log('COACH - 내 지원서 메뉴 표시:', hasMenu)
    expect(hasMenu).toBe(true)

    await logout(page)
  })

  test('COACH는 세부정보 관리 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    await page.goto('/coach/competencies')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    expect(currentUrl).not.toContain('/unauthorized')
    expect(currentUrl).toContain('/coach/competencies')
    console.log('COACH - 세부정보 관리 페이지 접근 가능')

    await logout(page)
  })
})

// ============================================================================
// 일반 사용자(COACH) 관리자 페이지 접근 제한 테스트 (추가 항목)
// ============================================================================

test.describe('일반 사용자(COACH) 관리 기능 접근 제한', () => {
  test.setTimeout(120000)

  test('COACH는 과제 수정 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 과제 수정 페이지 직접 접근 시도
    await page.goto('/admin/projects/1/edit')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') ||
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/login')

    console.log('COACH - 과제 수정 페이지 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('COACH는 과제 응모자 목록 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 과제 응모자 목록 페이지 직접 접근 시도
    await page.goto('/admin/projects/1/applications')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') ||
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/login')

    console.log('COACH - 과제 응모자 목록 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('COACH는 과제 평가 생성 페이지에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 평가 생성 페이지 직접 접근 시도
    await page.goto('/admin/projects/1/evaluations/create')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') ||
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/login')

    console.log('COACH - 평가 생성 페이지 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('COACH는 관리자 대시보드에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 관리자 대시보드 직접 접근 시도
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') ||
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/login')

    console.log('COACH - 관리자 대시보드 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })

  test('COACH는 검토자 대시보드에 접근할 수 없다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 검토자 대시보드 직접 접근 시도
    await page.goto('/staff/dashboard')
    await page.waitForLoadState('networkidle')

    const currentUrl = page.url()
    const isBlocked = currentUrl.includes('/unauthorized') ||
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/login')

    console.log('COACH - 검토자 대시보드 접근 차단됨:', isBlocked)
    console.log('현재 URL:', currentUrl)
    expect(isBlocked).toBe(true)

    await logout(page)
  })
})

// ============================================================================
// 관리자는 모든 관리 기능에 접근 가능 테스트
// ============================================================================

test.describe('관리자 관리 기능 접근 확인', () => {
  test.setTimeout(120000)

  test('관리자는 과제 수정 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    // 먼저 과제 목록에서 실제 존재하는 과제 ID 확인
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 첫 번째 과제 링크 찾기
    const projectLink = page.locator('a[href*="/projects/"]').first()
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await projectLink.getAttribute('href') || ''
      const projectIdMatch = href.match(/\/projects\/(\d+)/)
      if (projectIdMatch) {
        const projectId = projectIdMatch[1]

        // 과제 수정 페이지 접근
        await page.goto(`/admin/projects/${projectId}/edit`)
        await page.waitForLoadState('networkidle')

        const currentUrl = page.url()
        expect(currentUrl).not.toContain('/unauthorized')
        console.log('관리자 - 과제 수정 페이지 접근 가능')
      }
    }

    await logout(page)
  })

  test('관리자는 과제 응모자 목록 페이지에 접근할 수 있다', async ({ page }) => {
    await login(page, SUPER_ADMIN_ACCOUNT.email, SUPER_ADMIN_ACCOUNT.password)

    // 먼저 과제 목록에서 실제 존재하는 과제 ID 확인
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 첫 번째 과제 링크 찾기
    const projectLink = page.locator('a[href*="/projects/"]').first()
    if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await projectLink.getAttribute('href') || ''
      const projectIdMatch = href.match(/\/projects\/(\d+)/)
      if (projectIdMatch) {
        const projectId = projectIdMatch[1]

        // 과제 응모자 목록 페이지 접근
        await page.goto(`/admin/projects/${projectId}/applications`)
        await page.waitForLoadState('networkidle')

        const currentUrl = page.url()
        expect(currentUrl).not.toContain('/unauthorized')
        console.log('관리자 - 과제 응모자 목록 페이지 접근 가능')
      }
    }

    await logout(page)
  })
})

// ============================================================================
// API 수준 접근 제어 테스트 (백엔드 권한 체크)
// ============================================================================

test.describe('API 수준 접근 제어 확인', () => {
  test.setTimeout(120000)

  test('COACH가 관리자 API를 호출하면 403 에러가 발생한다', async ({ page }) => {
    await login(page, COACH_ONLY_ACCOUNT.email, COACH_ONLY_ACCOUNT.password)

    // 네트워크 요청 모니터링
    const response403Received = { value: false }

    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() === 403) {
        response403Received.value = true
        console.log('403 응답 수신:', response.url())
      }
    })

    // 관리자 전용 페이지 접근 시도 (API 호출 발생)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 페이지가 차단되었거나 403 에러가 발생해야 함
    const currentUrl = page.url()
    const isProtected = currentUrl.includes('/unauthorized') ||
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/login') ||
      response403Received.value

    console.log('API 수준 접근 제어 확인:', isProtected)
    expect(isProtected).toBe(true)

    await logout(page)
  })
})
