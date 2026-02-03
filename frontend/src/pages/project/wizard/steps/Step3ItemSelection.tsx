import { Checkbox, Space, Card, message, InputNumber, Alert } from 'antd'
import { useState, useEffect } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'
import projectService, { type CompetencyItem } from '../../../../services/projectService'

interface Step3Props {
  state: WizardState
  actions: WizardActions
}

export default function Step3ItemSelection({ state, actions }: Step3Props) {
  const [items, setItems] = useState<CompetencyItem[]>([])
  const [loading, setLoading] = useState(false)

  // Calculate total score - 선택된 항목만 합계 (Number()로 타입 보장)
  const totalScore = state.selectedItemIds.reduce((sum, itemId) => {
    return sum + Number(state.scoreAllocation[itemId] || 0)
  }, 0)
  const isValidScore = totalScore === 100

  useEffect(() => {
    loadCompetencyItems()
  }, [])

  const loadCompetencyItems = async () => {
    setLoading(true)
    try {
      const allItems = await projectService.getCompetencyItems()
      // Filter only active items
      const activeItems = allItems.filter(item => item.is_active)
      setItems(activeItems)
    } catch (error) {
      console.error('Failed to load competency items:', error)
      message.error('역량 항목을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'OTHER'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, CompetencyItem[]>)

  const categoryLabels: Record<string, string> = {
    BASIC: '기본 프로필 정보',
    CERTIFICATION: '자격증',
    EDUCATION: '학력',
    EXPERIENCE: '역량 이력',
    OTHER: '기타'
  }

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        지원자에게 어떤 정보를 수집할까요?
      </h2>

      <div className="wizard-question-hint">
        💡 필요한 항목을 체크하고 배점을 입력하세요 (총 100점)
      </div>

      {/* 상단 고정 총점 표시 */}
      <Alert
        type={isValidScore ? 'success' : 'warning'}
        message={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>선택된 항목: {state.selectedItemIds.length}개</span>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
              총점: {totalScore}/100점
              {isValidScore ? ' ✓' : ''}
            </span>
          </div>
        }
        showIcon
        style={{ marginBottom: 16, position: 'sticky', top: 0, zIndex: 10 }}
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <Card key={category} title={categoryLabels[category] || category} size="small">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {categoryItems.map(item => {
                const isSelected = state.selectedItemIds.includes(item.item_id)
                const currentScore = state.scoreAllocation[item.item_id] || 0

                return (
                  <div key={item.item_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => {
                        actions.toggleItem(item.item_id)
                        // 선택 해제 시 배점도 0으로 초기화
                        if (isSelected) {
                          actions.updateScore(item.item_id, 0)
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      <Space direction="vertical" size={0}>
                        <span>{item.item_name}</span>
                        {item.description && (
                          <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            {item.description}
                          </span>
                        )}
                      </Space>
                    </Checkbox>

                    {isSelected && (
                      <InputNumber
                        min={0}
                        max={100}
                        value={currentScore}
                        onChange={(value) => actions.updateScore(item.item_id, value || 0)}
                        addonAfter="점"
                        style={{ width: '120px' }}
                        placeholder="배점"
                      />
                    )}
                  </div>
                )
              })}
            </Space>
          </Card>
        ))}
      </Space>

      {!isValidScore && (
        <Alert
          type="warning"
          message={`총점이 ${totalScore}점입니다. 100점이 되어야 다음 단계로 진행할 수 있습니다.`}
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  )
}
