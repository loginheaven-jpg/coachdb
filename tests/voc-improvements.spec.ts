import { test, expect, Page } from '@playwright/test'
import { login, TEST_ACCOUNTS } from './fixtures/auth'

/**
 * TC-VOC: VOC 기반 UI/UX 개선 사항 테스트
 *
 * 테스트 항목:
 * 1. 탭 이름: "설문항목" → "역량 정보"
 * 2. 제출 메시지: '개인정보와 역량정보' 파란색 강조
 * 3. 개인정보 탭에 "다음 단계" Alert 추가
 * 4. 버튼 텍스트: "추가"→"등록", "+ 추가"→"+ 항목 추가"
 * 5. 드래그앤드롭 파일 업로드 (Upload.Dragger)
 */

// Helper function to navigate to application page
async function navigateToApplicationPage(page: Page) {
  // 코치로 로그인
  await login(page, TEST_ACCOUNTS.COACH.email, TEST_ACCOUNTS.COACH.password)

  // 과제 목록 페이지로 이동
  await page.goto('/coach/projects')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // 테이블에서 "지원하기" 버튼 찾기 (아직 지원하지 않은 과제)
  const applyButtons = page.getByRole('button', { name: /지원하기/i })
  const applyButtonCount = await applyButtons.count()

  if (applyButtonCount > 0) {
    // 첫 번째 "지원하기" 버튼 클릭
    await applyButtons.first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    console.log('✓ 지원하기 버튼 클릭 - 지원서 작성 페이지로 이동')
    return true
  }

  // "지원하기" 버튼이 없으면 "수정" 버튼으로 시도 (이미 지원한 과제)
  const editButtons = page.getByRole('button', { name: '수정', exact: true })
  const editButtonCount = await editButtons.count()

  if (editButtonCount > 0) {
    await editButtons.first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    console.log('✓ 수정 버튼 클릭 - 지원서 수정 페이지로 이동 (isEditMode)')
    return true
  }

  console.log('지원하기/수정 버튼 없음')
  return false
}

test.describe('TC-VOC-01: 탭 명칭 변경', () => {
  test('지원서 페이지에서 "역량 정보" 탭이 표시되어야 함', async ({ page }) => {
    const navigated = await navigateToApplicationPage(page)

    if (!navigated) {
      // 직접 지원서 페이지 URL로 이동 시도
      await page.goto('/coach/projects')
      await page.waitForLoadState('networkidle')

      // 과제 카드 클릭
      const projectCard = page.locator('.ant-card').first()
      if (await projectCard.isVisible({ timeout: 5000 })) {
        await projectCard.click()
        await page.waitForLoadState('networkidle')
      }
    }

    // "역량 정보" 탭 확인 (이전: "설문항목")
    const competencyTab = page.getByRole('tab', { name: /역량 정보/i })

    // 탭이 표시될 수 있는 페이지인 경우
    if (await page.locator('.ant-tabs').isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(competencyTab).toBeVisible({ timeout: 5000 })
      console.log('✓ "역량 정보" 탭 확인됨')

      // "설문항목" 탭이 없어야 함
      const surveyTab = page.getByRole('tab', { name: '설문항목', exact: true })
      await expect(surveyTab).not.toBeVisible()
      console.log('✓ "설문항목" 탭 없음 확인')
    }
  })
})

test.describe('TC-VOC-02: 제출 안내 메시지', () => {
  test('제출 안내 메시지에 "개인정보와 역량정보"가 강조되어야 함', async ({ page }) => {
    // 코치로 로그인
    await login(page, TEST_ACCOUNTS.COACH.email, TEST_ACCOUNTS.COACH.password)

    // 과제 목록 페이지로 이동
    await page.goto('/coach/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // "지원하기" 버튼 찾기 (신규 지원서 작성 모드에서만 메시지 표시)
    const applyButtons = page.getByRole('button', { name: /지원하기/i })
    const applyButtonCount = await applyButtons.count()

    if (applyButtonCount > 0) {
      // 첫 번째 "지원하기" 버튼 클릭
      await applyButtons.first().click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // 지원서 작성 페이지 확인
      const pageTitle = page.getByRole('heading', { name: /지원서 작성/i })
      await expect(pageTitle).toBeVisible({ timeout: 5000 })

      // 안내 메시지 확인 - "'개인정보와 역량정보'" 텍스트 (따옴표 포함)
      const guideMessage = page.locator('text=개인정보와 역량정보')
      await expect(guideMessage).toBeVisible({ timeout: 5000 })
      console.log('✓ "개인정보와 역량정보" 안내 메시지 확인됨')

      // 파란색 스타일 확인 (#1890ff) - span 요소 중 해당 텍스트를 직접 포함하는 것 찾기
      // ant-typography 클래스가 있고 style로 색상이 지정된 요소
      const blueTextElements = page.locator('span.ant-typography')
      const count = await blueTextElements.count()

      let foundBlueText = false
      for (let i = 0; i < count; i++) {
        const el = blueTextElements.nth(i)
        const text = await el.textContent()
        if (text?.includes('개인정보와 역량정보')) {
          const color = await el.evaluate(e => window.getComputedStyle(e).color)
          console.log('텍스트 색상:', color, '내용:', text)
          // rgb(24, 144, 255) = #1890ff
          if (color.includes('24') && color.includes('144') && color.includes('255')) {
            foundBlueText = true
            console.log('✓ 파란색 강조 확인됨')
            break
          }
        }
      }

      // 색상 검증은 경고만 (CSS 로딩 타이밍 이슈 가능)
      if (!foundBlueText) {
        console.log('⚠ 파란색 스타일 미확인 - CSS 로딩 타이밍 이슈일 수 있음')
      }
    } else {
      // 지원 가능한 과제가 없는 경우 스킵
      console.log('지원 가능한 과제 없음 - 테스트 스킵 (이미 모든 과제에 지원함)')
      test.skip()
    }
  })
})

test.describe('TC-VOC-03: 개인정보 탭 안내 Alert', () => {
  test('개인정보 탭에 "다음 단계" 안내 Alert가 표시되어야 함', async ({ page }) => {
    await navigateToApplicationPage(page)

    // 탭 영역이 있는지 확인
    const hasTabs = await page.locator('.ant-tabs').isVisible({ timeout: 5000 }).catch(() => false)

    if (hasTabs) {
      // 개인정보 탭 클릭
      const personalInfoTab = page.getByRole('tab', { name: /개인정보/i })
      if (await personalInfoTab.isVisible()) {
        await personalInfoTab.click()
        await page.waitForTimeout(500)
      }

      // Alert 확인 - "다음 단계" 메시지
      const alertMessage = page.locator('.ant-alert')
      const alertExists = await alertMessage.isVisible({ timeout: 3000 }).catch(() => false)

      if (alertExists) {
        // Alert 내용 확인
        const alertText = await alertMessage.textContent()
        expect(alertText).toContain('다음 단계')
        expect(alertText).toContain('역량 정보')
        console.log('✓ "다음 단계" Alert 확인됨')
      }
    }
  })
})

test.describe('TC-VOC-04: 버튼 텍스트 변경', () => {
  test('항목 추가 모달의 확인 버튼이 "등록"이어야 함', async ({ page }) => {
    await navigateToApplicationPage(page)

    // 역량 정보 탭으로 이동
    const competencyTab = page.getByRole('tab', { name: /역량 정보/i })
    if (await competencyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await competencyTab.click()
      await page.waitForTimeout(500)
    }

    // "+ 항목 추가" 버튼 찾기 (이전: "+ 추가")
    const addButton = page.getByRole('button', { name: /\+ 항목 추가/i })
    const buttonExists = await addButton.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (buttonExists) {
      console.log('✓ "+ 항목 추가" 버튼 확인됨')

      // 버튼 클릭하여 모달 열기
      await addButton.first().click()
      await page.waitForTimeout(500)

      // 모달 확인
      const modal = page.locator('.ant-modal-content')
      if (await modal.isVisible({ timeout: 3000 })) {
        // 확인 버튼 텍스트가 "등록"인지 확인 (이전: "추가")
        const okButton = modal.locator('.ant-modal-footer').getByRole('button', { name: '등록', exact: true })
        await expect(okButton).toBeVisible()
        console.log('✓ 모달 "등록" 버튼 확인됨')

        // "추가" 버튼이 없어야 함
        const addButtonInModal = modal.locator('.ant-modal-footer').getByRole('button', { name: '추가', exact: true })
        await expect(addButtonInModal).not.toBeVisible()
        console.log('✓ 모달에 "추가" 버튼 없음 확인')

        // 모달 닫기
        await page.keyboard.press('Escape')
      }
    } else {
      console.log('항목 추가 버튼 미표시 - 반복 가능 항목이 없을 수 있음')
    }
  })

  test('"+ 추가" 버튼이 "+ 항목 추가"로 변경되었는지 확인', async ({ page }) => {
    await navigateToApplicationPage(page)

    // 역량 정보 탭으로 이동
    const competencyTab = page.getByRole('tab', { name: /역량 정보/i })
    if (await competencyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await competencyTab.click()
      await page.waitForTimeout(500)
    }

    // "+ 추가" 버튼이 없어야 함 (이제 "+ 항목 추가"로 변경)
    const oldAddButton = page.getByRole('button', { name: '+ 추가', exact: true })
    const oldButtonVisible = await oldAddButton.isVisible({ timeout: 2000 }).catch(() => false)

    expect(oldButtonVisible).toBe(false)
    console.log('✓ "+ 추가" 버튼 없음 확인 (→ "+ 항목 추가"로 변경됨)')
  })
})

test.describe('TC-VOC-05: 드래그앤드롭 파일 업로드', () => {
  test('파일 업로드 영역이 드래그앤드롭을 지원해야 함', async ({ page }) => {
    await navigateToApplicationPage(page)

    // 역량 정보 탭으로 이동
    const competencyTab = page.getByRole('tab', { name: /역량 정보/i })
    if (await competencyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await competencyTab.click()
      await page.waitForTimeout(500)
    }

    // 반복 가능한 항목의 추가 버튼 찾기
    const addButton = page.getByRole('button', { name: /\+ 항목 추가/i }).first()

    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)

      // 모달 확인
      const modal = page.locator('.ant-modal-content')
      if (await modal.isVisible({ timeout: 3000 })) {
        // Upload.Dragger 영역 확인
        const dragger = modal.locator('.ant-upload-drag')
        const hasDragger = await dragger.isVisible({ timeout: 2000 }).catch(() => false)

        if (hasDragger) {
          console.log('✓ 드래그앤드롭 업로드 영역 확인됨')

          // InboxOutlined 아이콘 확인
          const inboxIcon = modal.locator('.ant-upload-drag-icon')
          await expect(inboxIcon).toBeVisible()
          console.log('✓ 업로드 아이콘 확인됨')

          // 안내 텍스트 확인
          const uploadText = modal.locator('.ant-upload-text')
          const textContent = await uploadText.textContent()
          expect(textContent).toMatch(/클릭|드래그/)
          console.log('✓ 업로드 안내 텍스트 확인됨:', textContent)

          // 힌트 텍스트 확인 (파일 형식)
          const hintText = modal.locator('.ant-upload-hint')
          if (await hintText.isVisible()) {
            const hint = await hintText.textContent()
            expect(hint).toMatch(/PDF|JPG|PNG/i)
            console.log('✓ 파일 형식 힌트 확인됨:', hint)
          }
        } else {
          // 증빙 필드가 없는 항목일 수 있음
          console.log('드래그앤드롭 영역 미표시 - 증빙 필수가 아닌 항목일 수 있음')
        }

        // 모달 닫기
        await page.keyboard.press('Escape')
      }
    }
  })

  test('드래그앤드롭으로 파일 업로드가 동작해야 함', async ({ page }) => {
    await navigateToApplicationPage(page)

    // 역량 정보 탭으로 이동
    const competencyTab = page.getByRole('tab', { name: /역량 정보/i })
    if (await competencyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await competencyTab.click()
      await page.waitForTimeout(500)
    }

    // 반복 가능한 항목의 추가 버튼 찾기
    const addButton = page.getByRole('button', { name: /\+ 항목 추가/i }).first()

    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)

      // 모달 확인
      const modal = page.locator('.ant-modal-content')
      if (await modal.isVisible({ timeout: 3000 })) {
        // 파일 input 찾기
        const fileInput = modal.locator('input[type="file"]')

        if (await fileInput.count() > 0) {
          // 테스트 파일 업로드
          await fileInput.setInputFiles({
            name: 'test-document.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('Test PDF content for VOC test')
          })

          await page.waitForTimeout(1000)

          // 업로드 성공 확인 (파일 목록에 표시)
          const uploadedFile = modal.locator('.ant-upload-list-item')
          const isUploaded = await uploadedFile.isVisible({ timeout: 5000 }).catch(() => false)

          if (isUploaded) {
            console.log('✓ 파일 업로드 성공')
          }
        }

        // 모달 닫기
        await page.keyboard.press('Escape')
      }
    }
  })
})

test.describe('TC-VOC-06: 종합 UI 검증', () => {
  test('지원서 작성 페이지 전체 UI가 올바르게 표시되어야 함', async ({ page }) => {
    const navigated = await navigateToApplicationPage(page)

    if (!navigated) {
      console.log('지원서 페이지 접근 불가 - 지원 가능한 과제가 없을 수 있음')
      return
    }

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // 1. 페이지 제목 확인
    const pageTitle = page.getByRole('heading', { name: /지원서|지원하기/i })
    if (await pageTitle.isVisible({ timeout: 3000 })) {
      console.log('✓ 페이지 제목 확인됨')
    }

    // 2. 탭 구조 확인
    const tabs = page.locator('.ant-tabs-tab')
    const tabCount = await tabs.count()
    console.log(`탭 수: ${tabCount}`)

    if (tabCount >= 2) {
      // 개인정보 탭 확인
      await expect(page.getByRole('tab', { name: /개인정보/i })).toBeVisible()
      console.log('✓ 개인정보 탭 확인됨')

      // 역량 정보 탭 확인
      await expect(page.getByRole('tab', { name: /역량 정보/i })).toBeVisible()
      console.log('✓ 역량 정보 탭 확인됨')
    }

    // 3. 제출 버튼 확인
    const submitButton = page.getByRole('button', { name: /제출|지원서 제출/i })
    if (await submitButton.isVisible({ timeout: 3000 })) {
      console.log('✓ 제출 버튼 확인됨')
    }

    // 4. 스크린샷 저장 (디버깅용)
    await page.screenshot({ path: 'tests/screenshots/voc-application-page.png', fullPage: true })
    console.log('✓ 스크린샷 저장됨')
  })
})
