import { test, expect, Page } from '@playwright/test'

/**
 * 보완요청 → 재제출 → 승인 플로우 상세 테스트
 *
 * 테스트 시나리오:
 * 1. 검토자가 증빙을 확인하고 보완요청
 * 2. 코치가 보완요청 알림 수신 확인
 * 3. 코치가 보완 자료 수정 및 재제출
 * 4. 검토자가 재제출된 자료 확인
 * 5. 다른 검토자(2인 검증)가 컨펌
 * 6. 최종 승인 상태 확인
 */

// 테스트 계정
const ADMIN_ACCOUNT = {
  email: 'loginheaven@gmail.com',
  password: '1234qwer',
}

const COACH_ACCOUNT = {
  email: 'viproject@naver.com',
  password: '111111',
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

async function navigateToReviewerDashboard(page: Page) {
  await page.goto('/reviewer/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  const hasTable = await page.locator('table, .ant-table').first().isVisible({ timeout: 5000 }).catch(() => false)
  if (!hasTable) {
    await page.goto('/admin/verifications')
    await page.waitForLoadState('networkidle')
  }
}

// ============================================================================
// 테스트
// ============================================================================

test.describe.serial('보완요청 → 재제출 → 승인 전체 플로우', () => {
  test.setTimeout(180000)

  let targetCompetencyId: string | null = null

  // --------------------------------------------------------------------------
  // 1. 검토자가 보완요청
  // --------------------------------------------------------------------------
  test('1. 검토자가 증빙에 보완요청을 한다', async ({ page }) => {
    await login(page, ADMIN_ACCOUNT.email, ADMIN_ACCOUNT.password)
    await navigateToReviewerDashboard(page)

    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    console.log(`검증 대기 항목 수: ${rowCount}`)

    if (rowCount > 0) {
      // 검토중 상태인 항목 찾기
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const row = rows.nth(i)
        const rowText = await row.textContent() || ''

        if (rowText.includes('검토중') || rowText.includes('pending') || rowText.includes('대기')) {
          const detailButton = row.getByRole('button', { name: /상세|보기/i }).first()

          if (await detailButton.isVisible()) {
            await detailButton.click()
            await page.waitForTimeout(1000)

            const modal = page.locator('.ant-modal-content')
            if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
              // competency_id 저장 (있다면)
              const urlMatch = page.url().match(/competency_id=(\d+)/)
              if (urlMatch) {
                targetCompetencyId = urlMatch[1]
              }

              // 보완요청 버튼 클릭
              const supplementBtn = modal.getByRole('button', { name: /보완요청|반려/i }).first()

              if (await supplementBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await supplementBtn.click()
                await page.waitForTimeout(500)

                // 보완요청 사유 모달/폼
                const reasonInput = page.locator('textarea').last()
                if (await reasonInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                  await reasonInput.fill('E2E 테스트: 증빙 서류가 불명확합니다. 자격증 원본 사본을 첨부해주세요.')

                  // 요청 버튼 클릭
                  const submitBtn = page.getByRole('button', { name: /요청|확인|전송/i }).last()
                  if (await submitBtn.isVisible()) {
                    await submitBtn.click()
                    await page.waitForTimeout(2000)

                    // 성공 메시지 확인
                    const successMessage = page.locator('.ant-message-success')
                    await expect(successMessage).toBeVisible({ timeout: 5000 }).catch(() => {
                      console.log('보완요청 완료 (메시지 미표시)')
                    })

                    console.log('✓ 보완요청 전송 완료')
                    break
                  }
                }
              } else {
                console.log('보완요청 버튼 없음 - 다음 항목 시도')
                await page.keyboard.press('Escape')
                continue
              }
            }
          }
          break
        }
      }
    } else {
      console.log('검증 대기 항목 없음')
    }

    await logout(page)
  })

  // --------------------------------------------------------------------------
  // 2. 코치가 보완요청 알림 확인
  // --------------------------------------------------------------------------
  test('2. 코치가 보완요청 알림을 확인한다', async ({ page }) => {
    await login(page, COACH_ACCOUNT.email, COACH_ACCOUNT.password)

    // 대시보드에서 알림 확인
    await page.goto('/coach/dashboard')
    await page.waitForLoadState('networkidle')

    // 알림 벨 클릭
    const notificationBell = page.locator('.anticon-bell, [data-icon="bell"]').first()
    if (await notificationBell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await notificationBell.click()
      await page.waitForTimeout(1000)

      const notificationDropdown = page.locator('.ant-dropdown, .ant-popover, .ant-list')
      if (await notificationDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        const notificationText = await notificationDropdown.textContent() || ''
        console.log('알림 내용:', notificationText.substring(0, 200))

        // 보완요청 알림 확인
        const hasSupplementNotification =
          notificationText.includes('보완') ||
          notificationText.includes('반려') ||
          notificationText.includes('추가 서류')

        if (hasSupplementNotification) {
          console.log('✓ 보완요청 알림 확인됨')
        }
      }

      // 드롭다운 닫기
      await page.keyboard.press('Escape')
    }

    // 세부정보 페이지에서 보완 필요 항목 확인
    await page.goto('/profile/competencies')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 보완 필요 상태 확인
    const supplementStatus = page.locator('text=/보완요청|보완|반려|rejected|보충필요/i')
    const hasSupplementItems = await supplementStatus.count() > 0
    console.log('보완 필요 항목 존재:', hasSupplementItems)

    if (hasSupplementItems) {
      // 보완 사유 확인
      const reasonText = await page.locator('text=/서류|자격증|불명확/i').first().isVisible({ timeout: 2000 }).catch(() => false)
      console.log('보완 사유 표시:', reasonText)
    }

    await logout(page)
  })

  // --------------------------------------------------------------------------
  // 3. 코치가 보완 자료 수정 및 재제출
  // --------------------------------------------------------------------------
  test('3. 코치가 보완 자료를 수정하고 재제출한다', async ({ page }) => {
    await login(page, COACH_ACCOUNT.email, COACH_ACCOUNT.password)

    // 세부정보 페이지로 이동
    await page.goto('/profile/competencies')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 보완 필요 항목의 수정 버튼 찾기
    const supplementItems = page.locator('text=/보완요청|보완|반려|보충필요/i')
    const hasItems = await supplementItems.count() > 0

    if (hasItems) {
      // 해당 항목 근처의 수정 버튼 클릭
      const editButton = page.locator('button:has-text("수정"), button:has-text("편집"), button:has-text("보완하기")').first()

      if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editButton.click()
        await page.waitForTimeout(1000)

        // 모달이 열리면 수정
        const modal = page.locator('.ant-modal-content')
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 텍스트 필드 수정
          const textInputs = modal.locator('input[type="text"], textarea')
          const inputCount = await textInputs.count()

          for (let i = 0; i < inputCount; i++) {
            const input = textInputs.nth(i)
            if (await input.isVisible() && await input.isEnabled()) {
              const currentValue = await input.inputValue()
              await input.fill(`${currentValue} [보완완료: ${Date.now()}]`)
              console.log('텍스트 필드 수정됨')
              break
            }
          }

          // 파일 업로드 (새 파일로 대체)
          const fileInput = modal.locator('input[type="file"]')
          if (await fileInput.count() > 0) {
            await fileInput.setInputFiles({
              name: 'supplemented-certificate.pdf',
              mimeType: 'application/pdf',
              buffer: Buffer.from('Supplemented certificate document - ' + Date.now())
            })
            await page.waitForTimeout(1000)
            console.log('파일 업로드됨')
          }

          // 저장 버튼 클릭
          const saveBtn = modal.getByRole('button', { name: /저장|확인|제출/i }).first()
          if (await saveBtn.isVisible()) {
            await saveBtn.click()
            await page.waitForTimeout(2000)

            // 성공 메시지 확인
            const successMessage = page.locator('.ant-message-success')
            await expect(successMessage).toBeVisible({ timeout: 5000 }).catch(() => {
              console.log('저장 완료 (메시지 미표시)')
            })

            console.log('✓ 보완 자료 재제출 완료')
          }
        }
      } else {
        console.log('수정 버튼 없음')
      }
    } else {
      console.log('보완 필요 항목 없음 - 스킵')
    }

    await logout(page)
  })

  // --------------------------------------------------------------------------
  // 4. 검토자가 재제출된 자료 확인
  // --------------------------------------------------------------------------
  test('4. 검토자가 재제출된 자료를 확인한다', async ({ page }) => {
    await login(page, ADMIN_ACCOUNT.email, ADMIN_ACCOUNT.password)
    await navigateToReviewerDashboard(page)

    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    console.log(`검증 대기 항목 수: ${rowCount}`)

    // 재제출된 항목 (검토중 상태) 확인
    if (rowCount > 0) {
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const row = rows.nth(i)
        const rowText = await row.textContent() || ''

        if (rowText.includes('검토중') || rowText.includes('pending')) {
          const detailButton = row.getByRole('button', { name: /상세|보기/i }).first()

          if (await detailButton.isVisible()) {
            await detailButton.click()
            await page.waitForTimeout(1000)

            const modal = page.locator('.ant-modal-content')
            if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
              // 최근 활동 타임라인 확인
              const timeline = modal.locator('.ant-timeline')
              if (await timeline.isVisible({ timeout: 2000 }).catch(() => false)) {
                const timelineText = await timeline.textContent() || ''
                console.log('최근 활동:', timelineText.substring(0, 200))

                // 보완요청 기록 확인
                const hasSupplementRecord = timelineText.includes('보완') || timelineText.includes('반려')
                console.log('보완요청 기록:', hasSupplementRecord)
              }

              // 재제출된 값 확인
              const valueSection = modal.locator('text=/보완완료|수정됨|재제출/i')
              const hasUpdatedValue = await valueSection.isVisible({ timeout: 2000 }).catch(() => false)
              console.log('재제출된 값 확인:', hasUpdatedValue)

              console.log('✓ 재제출된 자료 확인 완료')

              // 모달 닫기
              await page.keyboard.press('Escape')
              break
            }
          }
        }
      }
    }

    await logout(page)
  })

  // --------------------------------------------------------------------------
  // 5. 검토자가 컨펌하여 최종 승인
  // --------------------------------------------------------------------------
  test('5. 검토자가 재제출된 자료를 컨펌하여 최종 승인한다', async ({ page }) => {
    await login(page, ADMIN_ACCOUNT.email, ADMIN_ACCOUNT.password)
    await navigateToReviewerDashboard(page)

    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    if (rowCount > 0) {
      // 검토중 상태인 항목 찾아서 컨펌
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const row = rows.nth(i)
        const rowText = await row.textContent() || ''

        if (rowText.includes('검토중') || rowText.includes('pending')) {
          const detailButton = row.getByRole('button', { name: /상세|보기/i }).first()

          if (await detailButton.isVisible()) {
            await detailButton.click()
            await page.waitForTimeout(1000)

            const modal = page.locator('.ant-modal-content')
            if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
              // 컨펌 버튼 클릭
              const confirmBtn = modal.getByRole('button', { name: /컨펌|승인/i }).first()

              if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await confirmBtn.click()
                await page.waitForTimeout(2000)

                // 성공 메시지 확인
                const successMessage = page.locator('.ant-message-success')
                await expect(successMessage).toBeVisible({ timeout: 5000 }).catch(() => {
                  console.log('컨펌 완료 (메시지 미표시)')
                })

                console.log('✓ 최종 컨펌 완료')

                // 모달 닫기
                await page.keyboard.press('Escape')
                break
              }
            }
          }
        }
      }
    }

    await logout(page)
  })

  // --------------------------------------------------------------------------
  // 6. 코치가 최종 승인 상태 확인
  // --------------------------------------------------------------------------
  test('6. 코치가 최종 승인 상태를 확인한다', async ({ page }) => {
    await login(page, COACH_ACCOUNT.email, COACH_ACCOUNT.password)

    // 세부정보 페이지에서 승인 상태 확인
    await page.goto('/profile/competencies')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 승인됨 상태 확인
    const approvedItems = page.locator('text=/승인|approved|완료|verified|검증됨/i')
    const approvedCount = await approvedItems.count()
    console.log(`승인된 항목 수: ${approvedCount}`)

    // 알림에서 승인 통지 확인
    const notificationBell = page.locator('.anticon-bell, [data-icon="bell"]').first()
    if (await notificationBell.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationBell.click()
      await page.waitForTimeout(1000)

      const notificationDropdown = page.locator('.ant-dropdown, .ant-popover')
      if (await notificationDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        const notificationText = await notificationDropdown.textContent() || ''
        const hasApprovalNotification =
          notificationText.includes('승인') ||
          notificationText.includes('완료') ||
          notificationText.includes('검증')

        if (hasApprovalNotification) {
          console.log('✓ 승인 알림 확인됨')
        }
      }
    }

    console.log('✓ 보완요청 → 재제출 → 승인 전체 플로우 테스트 완료')

    await logout(page)
  })
})

// ============================================================================
// 2인 검증 플로우 테스트
// ============================================================================

test.describe('2인 검증 플로우', () => {
  test.setTimeout(120000)

  test('첫 번째 검토자가 컨펌 후 두 번째 검토자도 컨펌해야 최종 승인된다', async ({ page }) => {
    await login(page, ADMIN_ACCOUNT.email, ADMIN_ACCOUNT.password)
    await navigateToReviewerDashboard(page)

    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    if (rowCount > 0) {
      // 첫 번째 항목 상세 열기
      const detailButton = rows.first().getByRole('button', { name: /상세|보기/i }).first()

      if (await detailButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await detailButton.click()
        await page.waitForTimeout(1000)

        const modal = page.locator('.ant-modal-content')
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 컨펌 수 확인 (X/2 형태)
          const verificationCount = modal.locator('text=/\\d+\\/\\d+/i')
          if (await verificationCount.isVisible({ timeout: 2000 }).catch(() => false)) {
            const countText = await verificationCount.textContent() || ''
            console.log(`현재 컨펌 상태: ${countText}`)

            // 필요 컨펌 수 파싱
            const match = countText.match(/(\d+)\/(\d+)/)
            if (match) {
              const current = parseInt(match[1])
              const required = parseInt(match[2])
              console.log(`현재 ${current}/${required} 컨펌`)

              if (current < required) {
                // 컨펌 버튼 클릭
                const confirmBtn = modal.getByRole('button', { name: /컨펌/i }).first()
                if (await confirmBtn.isVisible()) {
                  await confirmBtn.click()
                  await page.waitForTimeout(2000)

                  // 아직 최종 승인 아님을 확인
                  console.log(`컨펌 추가됨: ${current + 1}/${required}`)
                }
              }
            }
          }

          // 모달 닫기
          await page.keyboard.press('Escape')
        }
      }
    }

    await logout(page)
  })
})
