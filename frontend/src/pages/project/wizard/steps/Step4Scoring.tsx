import { Card, Button, Space, Tag, Select, InputNumber, message, Alert, Progress, Divider } from 'antd'
import { LeftOutlined, RightOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'
import projectService, { type CompetencyItem, MatchingType } from '../../../../services/projectService'

interface Step4Props {
  state: WizardState
  actions: WizardActions
}

interface ItemDetailConfig {
  matchingType: MatchingType
  grades?: Array<{ value: string; score: number }>
  configured: boolean
}

export default function Step4Scoring({ state, actions }: Step4Props) {
  const [items, setItems] = useState<CompetencyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [itemConfigs, setItemConfigs] = useState<Record<number, ItemDetailConfig>>({})

  // 현재 항목
  const currentItemId = state.selectedItemIds[currentIndex]
  const currentItem = items.find(i => i.item_id === currentItemId)
  const currentConfig = itemConfigs[currentItemId]
  const currentScore = state.scoreAllocation[currentItemId] || 0

  // 진행률
  const totalItems = state.selectedItemIds.length
  const configuredCount = Object.values(itemConfigs).filter(c => c.configured).length
  const progressPercent = totalItems > 0 ? Math.round((configuredCount / totalItems) * 100) : 0

  useEffect(() => {
    loadSelectedItems()
  }, [])

  const loadSelectedItems = async () => {
    setLoading(true)
    try {
      const allItems = await projectService.getCompetencyItems()
      const selectedItems = allItems.filter(item =>
        state.selectedItemIds.includes(item.item_id)
      )
      // 선택된 순서대로 정렬
      const orderedItems = state.selectedItemIds
        .map(id => selectedItems.find(item => item.item_id === id))
        .filter(Boolean) as CompetencyItem[]
      setItems(orderedItems)
    } catch (error) {
      console.error('Failed to load items:', error)
      message.error('항목 정보를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handlePrevItem = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNextItem = () => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleConfigChange = (field: keyof ItemDetailConfig, value: any) => {
    setItemConfigs(prev => ({
      ...prev,
      [currentItemId]: {
        ...prev[currentItemId],
        [field]: value,
        configured: true
      }
    }))
  }

  const handleAddGrade = () => {
    const grades = currentConfig?.grades || []
    handleConfigChange('grades', [...grades, { value: '', score: 0 }])
  }

  const handleUpdateGrade = (index: number, field: 'value' | 'score', value: any) => {
    const grades = [...(currentConfig?.grades || [])]
    grades[index] = { ...grades[index], [field]: value }
    handleConfigChange('grades', grades)
  }

  const handleRemoveGrade = (index: number) => {
    const grades = [...(currentConfig?.grades || [])]
    grades.splice(index, 1)
    handleConfigChange('grades', grades)
  }

  const handleSkipItem = () => {
    // 기본값으로 설정하고 다음으로
    setItemConfigs(prev => ({
      ...prev,
      [currentItemId]: {
        matchingType: MatchingType.EXACT,
        configured: true
      }
    }))
    if (currentIndex < totalItems - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        각 항목의 평가 기준을 설정하세요
      </h2>

      {/* 진행률 표시 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>진행률: {configuredCount}/{totalItems} 항목 설정 완료</span>
          <span>현재: {currentIndex + 1}/{totalItems}</span>
        </div>
        <Progress percent={progressPercent} status={progressPercent === 100 ? 'success' : 'active'} />
      </div>

      {/* 현재 항목 설정 카드 */}
      {currentItem && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{currentItem.item_name}</span>
              <Tag color="orange">{currentScore}점</Tag>
              {currentConfig?.configured && (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              )}
            </div>
          }
          extra={
            <Space>
              <Button
                icon={<LeftOutlined />}
                onClick={handlePrevItem}
                disabled={currentIndex === 0}
              >
                이전 항목
              </Button>
              <Button
                icon={<RightOutlined />}
                onClick={handleNextItem}
                disabled={currentIndex === totalItems - 1}
              >
                다음 항목
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 항목 설명 */}
            <div style={{ color: '#666', fontSize: 14 }}>
              {currentItem.description || '설명 없음'}
            </div>

            <Divider />

            {/* 평가 방식 선택 */}
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                평가 방식 선택
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="평가 방식을 선택하세요"
                value={currentConfig?.matchingType}
                onChange={(value) => handleConfigChange('matchingType', value)}
                size="large"
              >
                <Select.Option value={MatchingType.EXACT}>
                  <div>
                    <strong>정확한 일치</strong>
                    <div style={{ fontSize: 12, color: '#888' }}>특정 값과 정확히 일치하면 배점</div>
                  </div>
                </Select.Option>
                <Select.Option value={MatchingType.RANGE}>
                  <div>
                    <strong>범위 매칭</strong>
                    <div style={{ fontSize: 12, color: '#888' }}>숫자 범위에 따라 차등 점수</div>
                  </div>
                </Select.Option>
                <Select.Option value={MatchingType.GRADE}>
                  <div>
                    <strong>등급별 점수</strong>
                    <div style={{ fontSize: 12, color: '#888' }}>자격증 등급 등 문자열 기준</div>
                  </div>
                </Select.Option>
                <Select.Option value={MatchingType.CONTAINS}>
                  <div>
                    <strong>포함 여부</strong>
                    <div style={{ fontSize: 12, color: '#888' }}>특정 값 포함 시 배점</div>
                  </div>
                </Select.Option>
              </Select>
            </div>

            {/* 등급별 점수 설정 (GRADE 타입) */}
            {currentConfig?.matchingType === MatchingType.GRADE && (
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                  등급별 점수 설정 (총 {currentScore}점)
                </label>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {(currentConfig.grades || []).map((grade, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <InputNumber
                        style={{ width: 80 }}
                        placeholder="점수"
                        value={grade.score}
                        onChange={(value) => handleUpdateGrade(index, 'score', value || 0)}
                        addonAfter="점"
                      />
                      <span style={{ margin: '0 8px' }}>←</span>
                      <input
                        type="text"
                        placeholder="등급/값 (예: KSC, KAC)"
                        value={grade.value}
                        onChange={(e) => handleUpdateGrade(index, 'value', e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #d9d9d9',
                          borderRadius: 6
                        }}
                      />
                      <Button danger size="small" onClick={() => handleRemoveGrade(index)}>
                        삭제
                      </Button>
                    </div>
                  ))}
                  <Button type="dashed" onClick={handleAddGrade} block>
                    + 등급 추가
                  </Button>
                </Space>
              </div>
            )}

            {/* 범위 설정 (RANGE 타입) */}
            {currentConfig?.matchingType === MatchingType.RANGE && (
              <Alert
                type="info"
                message="범위 매칭"
                description="숫자 범위에 따른 점수 설정 기능은 추후 지원 예정입니다."
              />
            )}

            <Divider />

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleSkipItem}>
                기본값으로 건너뛰기
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  handleConfigChange('configured', true)
                  if (currentIndex < totalItems - 1) {
                    setCurrentIndex(currentIndex + 1)
                    message.success(`${currentItem.item_name} 설정 완료`)
                  } else {
                    message.success('모든 항목 설정 완료!')
                  }
                }}
              >
                {currentIndex < totalItems - 1 ? '설정 완료 후 다음 항목' : '모든 설정 완료'}
              </Button>
            </div>
          </Space>
        </Card>
      )}

      {/* 전체 항목 목록 (미니) */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>전체 항목:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {state.selectedItemIds.map((itemId, index) => {
            const item = items.find(i => i.item_id === itemId)
            const config = itemConfigs[itemId]
            const isActive = index === currentIndex

            return (
              <Tag
                key={itemId}
                color={isActive ? 'blue' : config?.configured ? 'green' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setCurrentIndex(index)}
              >
                {item?.item_name || `항목 ${itemId}`}
                {config?.configured && ' ✓'}
              </Tag>
            )
          })}
        </div>
      </div>
    </div>
  )
}
