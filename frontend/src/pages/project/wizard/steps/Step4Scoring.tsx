/**
 * Step 4: 등급 설정
 * GradeConfigModal을 사용하여 각 항목의 등급별 점수를 설정
 */

import { Card, Button, Space, Tag, message, Progress, Alert } from 'antd'
import { LeftOutlined, RightOutlined, CheckCircleOutlined, SettingOutlined, EditOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'
import projectService, { type CompetencyItem } from '../../../../services/projectService'
import GradeConfigModal from '../../../../components/scoring/GradeConfigModal'
import { ScoringConfig, MatchingType } from '../../../../types/scoring'
import { getScoringConfigSummary } from '../../../../utils/scoringHelpers'

interface Step4Props {
  state: WizardState
  actions: WizardActions
}

export default function Step4Scoring({ state, actions }: Step4Props) {
  const [items, setItems] = useState<CompetencyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)

  const currentItemId = state.selectedItemIds[currentIndex]
  const currentItem = items.find(i => i.item_id === currentItemId)
  const currentConfig = state.scoringConfigs[currentItemId]
  const currentScore = state.scoreAllocation[currentItemId] || 0

  const totalItems = state.selectedItemIds.length
  const configuredCount = Object.values(state.scoringConfigs).filter(c => c.configured).length
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

  const handleOpenModal = () => {
    setModalVisible(true)
  }

  const handleModalOk = (config: ScoringConfig) => {
    actions.updateScoringConfig(currentItemId, config)
    setModalVisible(false)
    message.success(`${currentItem?.item_name} 설정 완료`)

    // 자동으로 다음 항목으로 이동
    if (currentIndex < totalItems - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
      }, 300)
    }
  }

  const handleModalCancel = () => {
    setModalVisible(false)
  }

  const handleSkipItem = () => {
    // 기본값으로 설정 (EXACT 타입)
    const basicConfig: ScoringConfig = {
      itemId: currentItemId,
      matchingType: MatchingType.EXACT,
      configured: true
    }
    actions.updateScoringConfig(currentItemId, basicConfig)
    message.info('기본값으로 설정되었습니다')

    if (currentIndex < totalItems - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
      }, 300)
    }
  }

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        각 항목의 평가기준과 등급별 점수를 설정합니다
      </h2>

      <Alert
        type="info"
        message="템플릿 자동 제안"
        description="각 항목의 이름을 분석하여 적합한 설정을 자동으로 제안합니다. 필요에 따라 수정할 수 있습니다."
        showIcon
        closable
        style={{ marginBottom: 20 }}
      />

      {/* 전체 항목 목록 */}
      <div style={{ marginBottom: 20, padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#333' }}>
          전체 항목 ({totalItems}개)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {state.selectedItemIds.map((itemId, index) => {
            const item = items.find(i => i.item_id === itemId)
            const config = state.scoringConfigs[itemId]
            const isActive = index === currentIndex

            return (
              <div
                key={itemId}
                onClick={() => setCurrentIndex(index)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: isActive ? '2px solid #ff6b00' : '1px solid #d9d9d9',
                  background: isActive ? '#fff5eb' : config?.configured ? '#f6ffed' : '#fff',
                  boxShadow: isActive ? '0 2px 8px rgba(255,107,0,0.15)' : 'none',
                  transition: 'all 0.2s',
                  minWidth: 120
                }}
              >
                <div style={{ fontWeight: isActive ? 'bold' : 'normal', fontSize: 14, color: isActive ? '#ff6b00' : '#333' }}>
                  {item?.item_name || `항목 ${itemId}`}
                </div>
                {config?.configured && (
                  <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
                    ✓ 설정완료
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 진행률 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 'bold' }}>진행률: {configuredCount}/{totalItems} 항목 설정 완료</span>
          <span>현재: {currentIndex + 1}/{totalItems}</span>
        </div>
        <Progress percent={progressPercent} status={progressPercent === 100 ? 'success' : 'active'} strokeWidth={12} />
      </div>

      {/* 현재 항목 설정 카드 */}
      {currentItem && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{currentItem.item_name}</span>
              <Tag color="orange">{Math.round(currentScore)}점</Tag>
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
                이전
              </Button>
              <Button
                icon={<RightOutlined />}
                onClick={handleNextItem}
                disabled={currentIndex === totalItems - 1}
              >
                다음
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ color: '#666', fontSize: 14 }}>
              {currentItem.description || '설명 없음'}
            </div>

            {currentConfig?.configured ? (
              // 설정 완료된 경우
              <div style={{ padding: 20, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20, marginRight: 8 }} />
                    <strong style={{ fontSize: 16 }}>설정 완료</strong>
                  </div>
                  <Button
                    icon={<EditOutlined />}
                    onClick={handleOpenModal}
                  >
                    수정
                  </Button>
                </div>
                <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 6 }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#999' }}>매칭 방식:</span>{' '}
                    <strong>{currentConfig.matchingType}</strong>
                  </div>
                  {currentConfig.gradeType && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#999' }}>등급 유형:</span>{' '}
                      <strong>{currentConfig.gradeType}</strong>
                    </div>
                  )}
                  {currentConfig.gradeMappings && currentConfig.gradeMappings.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: '#999' }}>등급 개수:</span>{' '}
                      <strong>{currentConfig.gradeMappings.length}개</strong>
                    </div>
                  )}
                  {currentConfig.aggregationMode && (
                    <div>
                      <span style={{ color: '#999' }}>집계 방식:</span>{' '}
                      <strong>{currentConfig.aggregationMode}</strong>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // 미설정 상태
              <div style={{ textAlign: 'center', padding: 40, background: '#fafafa', borderRadius: 8 }}>
                <p style={{ color: '#999', marginBottom: 16, fontSize: 15 }}>
                  아직 설정되지 않았습니다
                </p>
                <p style={{ color: '#666', marginBottom: 24, fontSize: 13 }}>
                  "설정하기" 버튼을 눌러 등급별 점수를 설정하세요
                </p>
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <Button onClick={handleSkipItem}>
                기본값으로 건너뛰기
              </Button>
              <Space>
                <Button
                  type="primary"
                  icon={<SettingOutlined />}
                  onClick={handleOpenModal}
                  size="large"
                >
                  {currentConfig?.configured ? '설정 수정' : '설정하기'}
                </Button>
              </Space>
            </div>
          </Space>
        </Card>
      )}

      {/* 등급 설정 모달 */}
      {currentItem && (
        <GradeConfigModal
          visible={modalVisible}
          itemId={currentItemId}
          itemName={currentItem.item_name}
          maxScore={currentScore}
          initialConfig={currentConfig}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          showTemplateSelection={true}  // 위저드 모드: 템플릿 선택 표시
        />
      )}
    </div>
  )
}
