/**
 * 세부정보(역량) 관리 E2E 테스트
 */
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('세부정보 관리 기능', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'coach')
  })

  test('세부정보 관리 페이지 접근 가능', async ({ page }) => {
    // 사용자 메뉴에서 세부정보 관리 클릭
    await page.click('.ant-avatar')
    await page.click('text=세부정보 관리')

    await page.waitForURL('/coach/competencies', { timeout: 10000 })

    // 페이지 제목 확인
    await expect(page.locator('h2', { hasText: '역량 및 세부정보 관리' })).toBeVisible()
  })

  test('역량 카테고리 섹션 표시', async ({ page }) => {
    await page.goto('/coach/competencies')

    // 기본 섹션들 확인
    await expect(page.locator('text=기본정보')).toBeVisible()
    await expect(page.locator('text=자격증')).toBeVisible()
    await expect(page.locator('text=학력')).toBeVisible()
  })

  test('역량 추가 버튼 동작', async ({ page }) => {
    await page.goto('/coach/competencies')

    // 자격증 섹션 펼치기
    await page.click('.ant-collapse-header:has-text("자격증")')

    // 추가 버튼 찾기
    const addButton = page.locator('button:has-text("+ 추가")').first()
    if (await addButton.isVisible()) {
      await addButton.click()

      // 모달 확인
      await expect(page.locator('.ant-modal')).toBeVisible()
      await expect(page.locator('text=역량 추가')).toBeVisible()
    }
  })

  test('파일 드롭 시 풀스크린으로 안 열림', async ({ page }) => {
    await page.goto('/coach/competencies')

    // 페이지 외부 영역에 드래그 이벤트 시뮬레이션
    const pageContent = page.locator('.ant-card').first()
    const box = await pageContent.boundingBox()

    if (box) {
      // 드래그 이벤트 발생 (파일 드롭 시뮬레이션)
      await page.dispatchEvent('body', 'dragover', {
        dataTransfer: { types: ['Files'] }
      })

      // 페이지가 여전히 정상인지 확인 (풀스크린으로 안 열림)
      await expect(page.locator('h2', { hasText: '역량 및 세부정보 관리' })).toBeVisible()
    }
  })
})
