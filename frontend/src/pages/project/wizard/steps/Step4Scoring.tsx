import { Space, Alert, Button } from 'antd'
import { useEffect, useState } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'
import AutoScoreSlider from '../../../../components/wizard/AutoScoreSlider'

interface Step4Props {
  state: WizardState
  actions: WizardActions
}

interface CompetencyItem {
  item_id: number
  item_name: string
  item_code: string
}

export default function Step4Scoring({ state, actions }: Step4Props) {
  const [items, setItems] = useState<CompetencyItem[]>([])

  useEffect(() => {
    loadSelectedItems()
    // 처음 진입 시 자동 분배
    if (Object.keys(state.scoreAllocation).length === 0) {
      actions.autoDistributeScores()
    }
  }, [])

  const loadSelectedItems = async () => {
    // TODO: API - 선택된 항목 정보 불러오기
    // GET /api/competencies/items?ids=1,2,3
    setItems([])
  }

  const totalScore = state.selectedItemIds.reduce(
    (sum, itemId) => sum + (state.scoreAllocation[itemId] || 0),
    0
  )

  const isValid = totalScore === 100

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        각 항목의 중요도를 조절해주세요
      </h2>

      <div className="wizard-question-hint">
        💡 총 100점을 자동으로 분배합니다. 슬라이더를 움직이면 다른 항목도 자동 조정됩니다
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {state.selectedItemIds.map(itemId => {
          const item = items.find(i => i.item_id === itemId)
          const score = state.scoreAllocation[itemId] || 0

          return (
            <AutoScoreSlider
              key={itemId}
              itemId={itemId}
              itemName={item?.item_name || `항목 ${itemId}`}
              score={score}
              onScoreChange={(newScore) => {
                actions.updateScore(itemId, newScore)
                // 자동 재분배
                if (state.autoDistribute) {
                  actions.autoDistributeScores()
                }
              }}
            />
          )
        })}
      </Space>

      <Alert
        type={isValid ? 'success' : 'warning'}
        message={`총 배점: ${totalScore}/100점`}
        description={
          isValid
            ? '배점이 정확합니다. 다음 단계로 진행할 수 있습니다'
            : '배점의 합이 100점이 되도록 조정해주세요'
        }
        showIcon
        style={{ marginTop: 24 }}
      />

      <Button
        block
        type="dashed"
        onClick={actions.autoDistributeScores}
        style={{ marginTop: 16 }}
      >
        자동으로 100점 맞추기
      </Button>

      <div style={{ marginTop: 16, textAlign: 'center', color: '#8c8c8c' }}>
        <Button type="link" size="small">
          ⚙️ 상세 설정 (등급별 배점 등)
        </Button>
      </div>
    </div>
  )
}
