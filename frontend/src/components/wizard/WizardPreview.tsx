import { Card, Empty, Descriptions, Tag, List, Alert } from 'antd'
import { useState, useEffect } from 'react'
import { WizardState } from '../../hooks/useWizardState'
import projectService, { type CompetencyItem } from '../../services/projectService'

interface WizardPreviewProps {
  state: WizardState
}

// 항목명 캐시 (API 중복 호출 방지)
let itemCache: CompetencyItem[] = []

export default function WizardPreview({ state }: WizardPreviewProps) {
  const renderPreview = () => {
    switch (state.currentStep) {
      case 1:
        return <Step1Preview state={state} />
      case 2:
        return <Step2Preview state={state} />
      case 3:
        return <Step3Preview state={state} />
      case 4:
        return <Step4Preview state={state} />
      case 5:
        return <Step5Preview state={state} />
      case 6:
        return <Step6Preview state={state} />
      default:
        return <Empty description="미리보기를 사용할 수 없습니다" />
    }
  }

  return (
    <div className="wizard-preview-content">
      {renderPreview()}
    </div>
  )
}

// Step 1: 참고 과제 미리보기
function Step1Preview({ state }: { state: WizardState }) {
  if (!state.referenceProjectId) {
    return (
      <Empty
        description="참고 과제를 선택하지 않았습니다"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <Card title="참고 과제 정보">
      <p>과제 ID: {state.referenceProjectId}</p>
      <p style={{ color: '#8c8c8c' }}>
        선택한 과제의 설정이 다음 단계에 반영됩니다
      </p>
    </Card>
  )
}

// Step 2: 기본 정보 미리보기
function Step2Preview({ state }: { state: WizardState }) {
  const projectTypeLabels: Record<string, string> = {
    business_coaching: '비즈니스코칭',
    public_coaching: '공익코칭',
    other: '기타'
  }

  return (
    <Card title="과제 기본 정보">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="과제명">
          {state.projectName || <span style={{ color: '#d9d9d9' }}>입력 대기 중...</span>}
        </Descriptions.Item>
        <Descriptions.Item label="과제 유형">
          {state.projectType ? (
            <Tag color="blue">{projectTypeLabels[state.projectType]}</Tag>
          ) : (
            <span style={{ color: '#d9d9d9' }}>선택 대기 중...</span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="지원사업명">
          {state.supportProgramName || <span style={{ color: '#d9d9d9' }}>미입력</span>}
        </Descriptions.Item>
        <Descriptions.Item label="모집 인원">
          {state.maxParticipants}명
        </Descriptions.Item>
        <Descriptions.Item label="모집 기간">
          {state.recruitmentStartDate && state.recruitmentEndDate ? (
            `${state.recruitmentStartDate} ~ ${state.recruitmentEndDate}`
          ) : (
            <span style={{ color: '#d9d9d9' }}>선택 대기 중...</span>
          )}
        </Descriptions.Item>
        {state.description && (
          <Descriptions.Item label="과제 설명">
            <div style={{ whiteSpace: 'pre-wrap' }}>{state.description}</div>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  )
}

// Step 3: 항목 선택 미리보기
function Step3Preview({ state }: { state: WizardState }) {
  const [items, setItems] = useState<CompetencyItem[]>(itemCache)

  useEffect(() => {
    // 캐시가 비어있으면 API 호출
    if (itemCache.length === 0) {
      projectService.getCompetencyItems().then(data => {
        itemCache = data
        setItems(data)
      }).catch(err => {
        console.error('Failed to load items:', err)
      })
    }
  }, [])

  // 총점 계산 (Number()로 타입 보장)
  const totalScore = state.selectedItemIds.reduce((sum, itemId) => {
    return sum + Number(state.scoreAllocation[itemId] || 0)
  }, 0)

  const isValidScore = totalScore === 100

  // 항목명 조회 헬퍼
  const getItemName = (itemId: number) => {
    const item = items.find(i => i.item_id === itemId)
    return item?.item_name || `항목 ${itemId}`
  }

  if (state.selectedItemIds.length === 0) {
    return (
      <Empty
        description="선택된 항목이 없습니다"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <Card title={`선택된 항목 (${state.selectedItemIds.length}개)`}>
      {/* 총점 상단 고정 */}
      <Alert
        type={isValidScore ? 'success' : 'warning'}
        message={`총점: ${Math.round(totalScore)}/100점`}
        style={{ marginBottom: 12 }}
      />
      <List
        dataSource={state.selectedItemIds}
        size="small"
        renderItem={itemId => {
          const score = Number(state.scoreAllocation[itemId] || 0)
          return (
            <List.Item
              style={{ display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{getItemName(itemId)}</span>
              <Tag color={score > 0 ? 'orange' : 'default'}>{Math.round(score)}점</Tag>
            </List.Item>
          )
        }}
      />
    </Card>
  )
}

// Step 4: 배점 미리보기
function Step4Preview({ state }: { state: WizardState }) {
  const [items, setItems] = useState<CompetencyItem[]>(itemCache)

  useEffect(() => {
    if (itemCache.length === 0) {
      projectService.getCompetencyItems().then(data => {
        itemCache = data
        setItems(data)
      }).catch(err => {
        console.error('Failed to load items:', err)
      })
    }
  }, [])

  // 총점 계산 (Number()로 타입 보장)
  const totalScore = state.selectedItemIds.reduce(
    (sum, itemId) => sum + Number(state.scoreAllocation[itemId] || 0),
    0
  )

  const isValid = totalScore === 100

  // 항목명 조회 헬퍼
  const getItemName = (itemId: number) => {
    const item = items.find(i => i.item_id === itemId)
    return item?.item_name || `항목 ${itemId}`
  }

  return (
    <Card title="배점 설정">
      <List
        dataSource={state.selectedItemIds}
        renderItem={itemId => {
          const score = Number(state.scoreAllocation[itemId] || 0)
          return (
            <List.Item
              extra={<Tag color={score > 0 ? 'green' : 'default'}>
                {Math.round(score)}점
              </Tag>}
            >
              {getItemName(itemId)}
            </List.Item>
          )
        }}
      />
      <Alert
        type={isValid ? 'success' : 'warning'}
        message={`총 배점: ${Math.round(totalScore)}/100점`}
        showIcon
        style={{ marginTop: 16 }}
      />
    </Card>
  )
}

// Step 5: 심사위원 미리보기
function Step5Preview({ state }: { state: WizardState }) {
  if (state.selectedReviewerIds.length === 0) {
    return (
      <Empty
        description="선택된 심사위원이 없습니다"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <Card title={`심사위원 (${state.selectedReviewerIds.length}명)`}>
      <List
        dataSource={state.selectedReviewerIds}
        renderItem={userId => (
          <List.Item>
            <Tag color="purple">사용자 ID: {userId}</Tag>
          </List.Item>
        )}
      />
      {state.selectedReviewerIds.length < 2 && (
        <Alert
          type="warning"
          message="최소 2명의 심사위원이 필요합니다"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  )
}

// Step 6: 최종 검토 미리보기
function Step6Preview({ state }: { state: WizardState }) {
  return (
    <Card title="최종 검토">
      <Alert
        type="success"
        message="모든 설정이 완료되었습니다"
        description="완료 버튼을 눌러 과제를 생성하세요"
        showIcon
      />
    </Card>
  )
}
