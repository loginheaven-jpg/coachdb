import { Checkbox, Space, Divider, Card } from 'antd'
import { useState, useEffect } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'

interface Step3Props {
  state: WizardState
  actions: WizardActions
}

interface CompetencyItem {
  item_id: number
  item_name: string
  item_code: string
  category: string
  description?: string
}

export default function Step3ItemSelection({ state, actions }: Step3Props) {
  const [items, setItems] = useState<CompetencyItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCompetencyItems()
  }, [])

  const loadCompetencyItems = async () => {
    setLoading(true)
    try {
      // TODO: API - 역량 항목 목록 불러오기
      // GET /api/competencies/items
      setItems([])
    } catch (error) {
      console.error('Failed to load competency items:', error)
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
        💡 필요한 항목만 체크하세요. 나중에 추가/제거할 수 있습니다
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <Card key={category} title={categoryLabels[category] || category} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {categoryItems.map(item => (
                <Checkbox
                  key={item.item_id}
                  checked={state.selectedItemIds.includes(item.item_id)}
                  onChange={() => actions.toggleItem(item.item_id)}
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
              ))}
            </Space>
          </Card>
        ))}
      </Space>

      <Divider />

      <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
        선택된 항목: {state.selectedItemIds.length}개
      </div>
    </div>
  )
}
