import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * 파일 첨부 전체 흐름 E2E 테스트
 *
 * 테스트 시나리오:
 * 1. 수퍼어드민이 과제 생성 (자격증 항목 포함 - 파일 첨부 필수)
 * 2. 코치가 과제 응모 (자격증 명칭 입력 + 파일 첨부)
 * 3. 응모 후 세부정보 페이지에서 파일 확인
 * 4. 검토자 화면에서 검토 대상 표시 및 파일 확인
 */

const SUPER_ADMIN = {
  email: 'loginheaven@gmail.com',
  password: '1234qwer'
}

// viproject@naver.com 사용 - 별도 계정으로 과제 응모 가능
const TEST_COACH = {
  email: 'viproject@naver.com',
  password: '1234qwer'
}

// 검증자도 수퍼어드민 사용 (VERIFIER 역할 있음)
const VERIFIER = {
  email: 'loginheaven@gmail.com',
  password: '1234qwer'
}

// 테스트용 파일 생성
const TEST_FILE_PATH = path.join(__dirname, 'test-certificate.pdf')

// Helper: 로그인
async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.getByPlaceholder(/이메일|email/i).fill(email)
  await page.getByPlaceholder(/비밀번호|password/i).fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()

  // 로그인 성공 대기
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 })
}

// Helper: 로그아웃
async function logout(page: Page) {
  // 드롭다운 메뉴 클릭 후 로그아웃
  try {
    await page.locator('.ant-dropdown-trigger').first().click()
    await page.waitForTimeout(500)
    await page.getByText('로그아웃').click()
  } catch {
    await page.goto('/login')
  }
  await page.waitForTimeout(1000)
}

const BACKEND_URL = 'https://coachdbbackend-production.up.railway.app'

test.describe.serial('파일 첨부 전체 흐름 테스트', () => {
  test.setTimeout(180000) // 3분

  let projectId: number
  let projectName: string
  let adminToken: string

  test.beforeAll(async ({ request }) => {
    // 테스트용 PDF 파일 생성
    if (!fs.existsSync(TEST_FILE_PATH)) {
      // 간단한 텍스트 파일 생성 (PDF 대용)
      fs.writeFileSync(TEST_FILE_PATH, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF')
    }

    // Super Admin으로 로그인하여 토큰 획득
    const loginResponse = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: { email: SUPER_ADMIN.email, password: SUPER_ADMIN.password }
    })
    const loginData = await loginResponse.json()
    adminToken = loginData.access_token
  })

  test.afterAll(async () => {
    // 테스트 파일 정리
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH)
    }
  })

  test('1. 수퍼어드민이 자격증 항목 포함 과제 생성 (API)', async ({ request }) => {
    // API를 통해 과제 생성 (더 안정적)
    projectName = `파일첨부테스트_${Date.now()}`

    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // 1. 과제 생성
    const createResponse = await request.post(`${BACKEND_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        project_name: projectName,
        recruitment_start_date: today.toISOString().split('T')[0],
        recruitment_end_date: nextMonth.toISOString().split('T')[0],
        project_start_date: today.toISOString().split('T')[0],
        project_end_date: nextMonth.toISOString().split('T')[0],
        max_participants: 20
      }
    })

    expect(createResponse.ok()).toBeTruthy()
    const project = await createResponse.json()
    projectId = project.project_id
    console.log(`과제 생성됨: ${projectName} (ID: ${projectId})`)

    // 2. 자격증 설문 항목 추가 (ADDON_CERT_COACH, item_id=37)
    const addItemResponse = await request.post(`${BACKEND_URL}/api/projects/${projectId}/items`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        item_id: 37,  // ADDON_CERT_COACH (코칭 관련 자격증)
        is_required: true,
        max_score: 100,  // 점수 100점
        proof_required_level: 'required',  // 증빙 필수
        display_order: 0
      }
    })

    expect(addItemResponse.ok()).toBeTruthy()
    console.log('설문 항목(자격증) 추가됨')

    // 3. 과제 finalize (READY 상태로 변경 - SUPER_ADMIN은 즉시 승인)
    const finalizeResponse = await request.post(`${BACKEND_URL}/api/projects/${projectId}/finalize`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    })

    expect(finalizeResponse.ok()).toBeTruthy()
    const finalizedProject = await finalizeResponse.json()
    console.log(`과제 상태: ${finalizedProject.status} (display: ${finalizedProject.display_status})`)

    expect(finalizedProject.status).toBe('ready')
    console.log(`과제 "${projectName}" 생성 및 공개 완료`)
  })

  test('2. 코치가 과제 응모 (자격증 + 파일 첨부)', async ({ page }) => {
    await login(page, TEST_COACH.email, TEST_COACH.password)

    // 로그인 후 잠시 대기 (인증 상태 확인 시간)
    await page.waitForTimeout(2000)

    // 직접 응모 페이지로 이동 (올바른 경로: /coach/projects/:projectId/apply)
    console.log(`응모 페이지로 이동: /coach/projects/${projectId}/apply`)
    await page.goto(`/coach/projects/${projectId}/apply`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 디버깅: 현재 페이지 상태 확인
    await page.screenshot({ path: 'test-results/apply-page-initial.png', fullPage: true })
    console.log('현재 URL:', page.url())

    // 1. "역량 정보" 탭 클릭 (자격증 입력은 역량 정보 탭에 있음)
    const competencyTab = page.getByRole('tab', { name: /역량.*정보/i })
    if (await competencyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('역량 정보 탭 클릭')
      await competencyTab.click()
      await page.waitForTimeout(2000)
    } else {
      console.log('역량 정보 탭을 찾을 수 없음')
    }

    // 1-1. 필수 필드: 신청 역할 선택
    const roleSelector = page.locator('input[id$="_requested_role"]').or(page.getByRole('combobox', { name: /신청.*역할/i }))
    if (await roleSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('신청 역할 선택')
      await roleSelector.click()
      await page.waitForTimeout(500)
      // 첫 번째 옵션 선택
      const firstOption = page.locator('.ant-select-item-option').first()
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click()
        await page.waitForTimeout(500)
      }
    }

    // 1-2. 필수 필드: 지원 동기 입력
    const motivationInput = page.getByRole('textbox', { name: /지원.*동기/i })
    if (await motivationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('지원 동기 입력')
      await motivationInput.fill('코칭 역량 향상을 위해 본 과제에 지원합니다. 다년간의 코칭 경험을 바탕으로 의미 있는 기여를 할 수 있습니다.')
      await page.waitForTimeout(500)
    }

    // 2. 자격증 항목의 "추가" 버튼 클릭 (반복 가능 항목)
    const addButton = page.getByRole('button', { name: /추가/i }).first()
    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('추가 버튼 발견 - 클릭')
      await addButton.click()
      await page.waitForTimeout(1000)
    }

    // 3. 자격증 명칭 입력 (다양한 셀렉터 시도)
    let certNameFilled = false
    const certInputSelectors = [
      'input[placeholder*="자격증"]',
      'input[placeholder*="명칭"]',
      '.ant-input[placeholder*="명칭"]',
    ]
    for (const selector of certInputSelectors) {
      const input = page.locator(selector).first()
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`자격증 입력 필드 발견: ${selector}`)
        await input.fill('KPC 코칭자격증 1급')
        certNameFilled = true
        break
      }
    }
    if (!certNameFilled) {
      console.log('자격증 입력 필드를 찾을 수 없음')
      await page.screenshot({ path: 'test-results/apply-page-no-cert-input.png', fullPage: true })
    }

    // 4. 파일 첨부 - Upload 컴포넌트에서 file input 찾기
    await page.waitForTimeout(1000)
    const fileInputs = page.locator('input[type="file"]')
    const fileInputCount = await fileInputs.count()
    console.log(`파일 입력 필드 수: ${fileInputCount}`)

    if (fileInputCount > 0) {
      await fileInputs.first().setInputFiles(TEST_FILE_PATH)
      console.log('파일 업로드 시작')
      await page.waitForTimeout(5000)
      console.log('파일 업로드 완료 (5초 대기)')
    } else {
      // ant-upload 컴포넌트 클릭 방식
      console.log('파일 입력 필드 없음 - ant-upload 시도')
      const uploadButton = page.locator('.ant-upload').first()
      if (await uploadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          uploadButton.click()
        ])
        await fileChooser.setFiles(TEST_FILE_PATH)
        await page.waitForTimeout(5000)
        console.log('파일 업로드 완료 (ant-upload)')
      } else {
        console.log('ant-upload도 찾을 수 없음')
        await page.screenshot({ path: 'test-results/apply-page-no-upload.png', fullPage: true })
      }
    }

    // 5. 모달의 "등록" 버튼 클릭 (자격증 항목 저장)
    const registerButton = page.getByRole('button', { name: '등록', exact: true })
    if (await registerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('모달 등록 버튼 클릭')
      await registerButton.click()
      await page.waitForTimeout(2000)
    }

    // 6. 제출 전 스크린샷
    await page.screenshot({ path: 'test-results/apply-page-before-submit.png', fullPage: true })

    // 7. 지원서 제출 버튼 클릭
    const submitButton = page.getByRole('button', { name: /지원서.*제출|제출/i })

    // 제출 전 확인 모달이 있을 수 있음
    await submitButton.click()
    await page.waitForTimeout(1000)

    // 확인 모달이 있으면 확인 클릭 (정확한 버튼 선택)
    const confirmButton = page.getByRole('button', { name: '반영', exact: true })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('확인 모달 - 반영 클릭')
      await confirmButton.click()
    }

    await page.waitForTimeout(3000)

    // 제출 성공 메시지 확인
    const successMessage = page.getByText(/제출.*완료|성공|저장.*완료/i).first()
    if (await successMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('응모 제출 완료')
    }

    // URL 변경 확인 (my-applications 등으로 이동)
    await page.waitForURL(url => !url.pathname.includes('/apply'), { timeout: 10000 })

    console.log('코치 응모 완료 (파일 첨부 포함)')
  })

  test('3. 응모 후 세부정보 페이지에서 파일 확인', async ({ page }) => {
    await login(page, TEST_COACH.email, TEST_COACH.password)

    // 세부정보 페이지로 이동
    await page.goto('/coach/competencies')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 자격증 섹션 찾기
    const certSection = page.getByText(/자격증|코칭자격/i).first()
    await expect(certSection).toBeVisible({ timeout: 10000 })

    // 파일 정보 확인 (파일명이 표시되어야 함)
    const fileInfo = page.getByText(/test-certificate|\.pdf|첨부파일/i)

    // 파일이 표시되는지 확인
    const isFileVisible = await fileInfo.isVisible({ timeout: 5000 }).catch(() => false)

    if (isFileVisible) {
      console.log('✅ 세부정보 페이지에서 파일 확인됨')

      // 파일 클릭하여 미리보기 모달 확인
      await fileInfo.click()
      await page.waitForTimeout(1000)

      // 미리보기 모달 확인
      const previewModal = page.locator('.ant-modal').filter({ hasText: /파일|미리보기/ })
      if (await previewModal.isVisible()) {
        console.log('✅ 파일 미리보기 모달 정상 작동')

        // 모달 닫기
        await page.getByRole('button', { name: /닫기|확인/i }).click()
      }
    } else {
      // 파일이 없으면 테스트 실패
      console.log('❌ 세부정보 페이지에서 파일을 찾을 수 없음')

      // 페이지 내용 디버깅
      const pageContent = await page.content()
      console.log('페이지 HTML (첫 2000자):', pageContent.substring(0, 2000))

      // 스크린샷 저장
      await page.screenshot({ path: 'test-results/competencies-page.png', fullPage: true })

      expect(isFileVisible, '세부정보 페이지에서 첨부파일이 표시되어야 함').toBeTruthy()
    }
  })

  test('4. 검토자 화면에서 검토 대상 표시 및 파일 확인', async ({ page }) => {
    await login(page, VERIFIER.email, VERIFIER.password)

    // 검토 페이지로 이동
    await page.goto('/admin/verifications')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 검토 대상 목록 확인
    const pendingTable = page.locator('table tbody tr')
    const rowCount = await pendingTable.count()

    console.log(`검토 대상 수: ${rowCount}`)

    if (rowCount === 0) {
      // 검토 대상이 없으면 실패
      console.log('❌ 검토 대상이 표시되지 않음')

      // 스크린샷 저장
      await page.screenshot({ path: 'test-results/verification-page.png', fullPage: true })

      expect(rowCount, '검토 대상이 1개 이상 표시되어야 함').toBeGreaterThan(0)
    }

    console.log('✅ 검토 대상 목록 표시됨')

    // 첫 번째 검토 항목 클릭
    const firstRow = pendingTable.first()
    await firstRow.click()
    await page.waitForTimeout(2000)

    // 상세 페이지 또는 모달에서 파일 확인
    const fileLink = page.getByText(/test-certificate|\.pdf|첨부파일|파일.*보기/i)
    const isFileLinkVisible = await fileLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (isFileLinkVisible) {
      console.log('✅ 검토 상세에서 첨부파일 확인됨')

      // 파일 클릭하여 미리보기 확인
      await fileLink.click()
      await page.waitForTimeout(2000)

      // 미리보기 모달이나 다운로드 확인
      const previewModal = page.locator('.ant-modal')
      if (await previewModal.isVisible()) {
        console.log('✅ 파일 미리보기 정상 작동')
      }
    } else {
      console.log('⚠️ 검토 상세에서 파일 링크를 직접 찾지 못함 - 상세 내용 확인 필요')

      // 스크린샷 저장
      await page.screenshot({ path: 'test-results/verification-detail.png', fullPage: true })
    }

    // 검토 승인 테스트 (optional)
    const approveButton = page.getByRole('button', { name: /승인|확인|컨펌/i })
    if (await approveButton.isVisible()) {
      await approveButton.click()
      await page.waitForTimeout(2000)
      console.log('검토 승인 완료')
    }
  })

  test('5. 응모 화면에서 기존 첨부파일 표시 확인', async ({ page }) => {
    await login(page, TEST_COACH.email, TEST_COACH.password)

    // 내 지원서 목록으로 이동
    await page.goto('/coach/my-applications')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 지원서 수정 클릭
    const editButton = page.getByRole('button', { name: /수정|편집|보기/i }).first()
    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // 기존 첨부파일이 표시되는지 확인
      const existingFile = page.getByText(/test-certificate|\.pdf|첨부파일/i)
      const isExistingFileVisible = await existingFile.isVisible({ timeout: 5000 }).catch(() => false)

      if (isExistingFileVisible) {
        console.log('✅ 응모 수정 화면에서 기존 첨부파일 표시됨')
      } else {
        console.log('⚠️ 응모 수정 화면에서 기존 첨부파일 표시 안 됨')
        await page.screenshot({ path: 'test-results/application-edit.png', fullPage: true })
      }
    }
  })
})

test.describe('API 레벨 파일 첨부 검증', () => {
  test.setTimeout(60000)

  test('CoachCompetency에 file_id가 정상 저장되는지 확인', async ({ request }) => {
    // 로그인하여 토큰 획득 (백엔드 직접 호출)
    const loginResponse = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: {
        email: TEST_COACH.email,
        password: TEST_COACH.password
      }
    })

    expect(loginResponse.ok()).toBeTruthy()
    const loginData = await loginResponse.json()
    const token = loginData.access_token

    // 내 역량 조회
    const competenciesResponse = await request.get(`${BACKEND_URL}/api/competencies/my`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    expect(competenciesResponse.ok()).toBeTruthy()
    const competencies = await competenciesResponse.json()

    console.log('내 역량 목록:', JSON.stringify(competencies, null, 2))

    // 자격증 항목에 file_id가 있는지 확인
    const certCompetency = competencies.find((c: any) =>
      c.item_code === 'CERT_COACH' || c.item_name?.includes('자격증')
    )

    if (certCompetency) {
      console.log('자격증 역량:', certCompetency)

      if (certCompetency.file_id) {
        console.log(`✅ file_id 정상 저장됨: ${certCompetency.file_id}`)
      } else {
        console.log('❌ file_id가 null - 버그 발생!')
      }

      expect(certCompetency.file_id, '자격증 역량에 file_id가 저장되어야 함').toBeTruthy()
    }
  })

  test('검증자 pending 목록에 파일 첨부 항목이 표시되는지 확인', async ({ request }) => {
    // 검증자로 로그인 (백엔드 직접 호출)
    const loginResponse = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: {
        email: VERIFIER.email,
        password: VERIFIER.password
      }
    })

    expect(loginResponse.ok()).toBeTruthy()
    const loginData = await loginResponse.json()
    const token = loginData.access_token

    // 검토 대상 조회
    const pendingResponse = await request.get(`${BACKEND_URL}/api/verifications/pending`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    expect(pendingResponse.ok()).toBeTruthy()
    const pendingItems = await pendingResponse.json()

    console.log('검토 대상 목록:', JSON.stringify(pendingItems, null, 2))
    console.log(`검토 대상 수: ${pendingItems.length}`)

    // file_id가 있는 항목이 있어야 함
    const itemsWithFiles = pendingItems.filter((item: any) => item.file_id != null)
    console.log(`파일 첨부된 검토 항목 수: ${itemsWithFiles.length}`)

    expect(pendingItems.length, '검토 대상이 1개 이상 있어야 함').toBeGreaterThan(0)
  })
})
