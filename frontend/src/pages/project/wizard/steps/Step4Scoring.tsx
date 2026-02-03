import { Card, Button, Space, Tag, Modal, Select, Input, InputNumber, message, Alert } from 'antd'
import { SettingOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'
import projectService, { type CompetencyItem, MatchingType } from '../../../../services/projectService'

interface Step4Props {
  state: WizardState
  actions: WizardActions
}

interface ItemDetailConfig {
  matchingType: MatchingType
  description: string
  // 향후 등급별 점수 등 추가 예정
}

export default function Step4Scoring({ state, actions }: Step4Props) {
  const [items, setItems] = useState<CompetencyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [itemConfigs, setItemConfigs] = useState<Record<number, ItemDetailConfig>>({})

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
      setItems(selectedItems)
    } catch (error) {
      console.error('Failed to load items:', error)
      message.error('항목 정보를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDetail = (itemId: number) => {
    setSelectedItemId(itemId)
    setDetailModalOpen(true)
  }

  const handleSaveDetail = () => {
    if (selectedItemId) {
      // TODO: 상세 설정 저장
      message.success('항목 설정이 저장되었습니다')
    }
    setDetailModalOpen(false)
  }

  const selectedItem = items.find(i => i.item_id === selectedItemId)
  const currentConfig = selectedItemId ? itemConfigs[selectedItemId] : null

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        각 항목의 평가 기준을 설정하세요
      </h2>

      <div className="wizard-question-hint">
        💡 각 항목마다 "상세 설정" 버튼을 눌러 평가 방식과 등급별 점수를 설정할 수 있습니다
      </div>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {state.selectedItemIds.map(itemId => {
          const item = items.find(i => i.item_id === itemId)
          const score = state.scoreAllocation[itemId] || 0
          const config = itemConfigs[itemId]

          return (
            <Card key={itemId} size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong>{item?.item_name || `항목 ${itemId}`}</strong>
                    <Tag color="orange">{score}점</Tag>
                    {config && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  </div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {item?.description || '설명 없음'}
                  </div>
                  {config && (
                    <div style={{ fontSize: '12px', color: '#1890ff', marginTop: '4px' }}>
                      평가 방식: {config.matchingType}
                    </div>
                  )}
                </div>
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => handleOpenDetail(itemId)}
                >
                  상세 설정
                </Button>
              </div>
            </Card>
          )
        })}
      </Space>

      <Alert
        type="info"
        message="상세 설정 안내"
        description="각 항목의 '상세 설정' 버튼을 클릭하여 평가 방식(정확한 일치, 범위, 등급 등)과 등급별 점수를 설정할 수 있습니다. 설정하지 않으면 기본값(전체 배점)이 적용됩니다."
        showIcon
        style={{ marginTop: 16 }}
      />

      {/* 상세 설정 모달 */}
      <Modal
        title={`${selectedItem?.item_name} - 상세 설정`}
        open={detailModalOpen}
        onOk={handleSaveDetail}
        onCancel={() => setDetailModalOpen(false)}
        width={800}
      >
        {selectedItem && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <h4>배점: {selectedItemId && state.scoreAllocation[selectedItemId]}점</h4>
              <p style={{ color: '#8c8c8c' }}>{selectedItem.description}</p>
            </div>

            <div>
              <label>평가 방식</label>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="평가 방식을 선택하세요"
                value={currentConfig?.matchingType}
                onChange={(value) => {
                  setItemConfigs(prev => ({
                    ...prev,
                    [selectedItemId!]: {
                      ...prev[selectedItemId!],
                      matchingType: value,
                      description: ''
                    }
                  }))
                }}
              >
                <Select.Option value={MatchingType.EXACT}>정확한 일치</Select.Option>
                <Select.Option value={MatchingType.RANGE}>범위 매칭</Select.Option>
                <Select.Option value={MatchingType.GRADE}>등급별 점수</Select.Option>
                <Select.Option value={MatchingType.CONTAINS}>포함 여부</Select.Option>
              </Select>
            </div>

            <Alert
              type="info"
              message="향후 기능"
              description="등급별 점수 입력 기능은 곧 추가될 예정입니다. 현재는 기본 배점이 적용됩니다."
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}
