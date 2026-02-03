import { Card, Descriptions, Tag, Space, Button, Alert } from 'antd'
import { CheckCircleOutlined, EditOutlined } from '@ant-design/icons'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'

interface Step6Props {
  state: WizardState
  actions: WizardActions
}

export default function Step6Review({ state, actions }: Step6Props) {
  const projectTypeLabels: Record<string, string> = {
    business_coaching: '비즈니스코칭',
    public_coaching: '공익코칭',
    other: '기타'
  }

  const totalScore = state.selectedItemIds.reduce(
    (sum, itemId) => sum + (state.scoreAllocation[itemId] || 0),
    0
  )

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
        설정 완료! 아래 내용을 확인해주세요
      </h2>

      <div className="wizard-question-hint">
        💡 수정이 필요한 부분이 있다면 이전 단계로 돌아가세요
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 과제 정보 */}
        <Card
          title="📋 과제 정보"
          extra={<Button type="link" icon={<EditOutlined />} onClick={() => actions.prevStep()}>수정</Button>}
        >
          <Descriptions column={1}>
            <Descriptions.Item label="과제명">
              {state.projectName || '(입력 필요)'}
            </Descriptions.Item>
            <Descriptions.Item label="과제 유형">
              <Tag color="blue">{projectTypeLabels[state.projectType] || state.projectType}</Tag>
            </Descriptions.Item>
            {state.supportProgramName && (
              <Descriptions.Item label="지원 사업명">
                {state.supportProgramName}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="모집 기간">
              {state.recruitmentStartDate} ~ {state.recruitmentEndDate}
            </Descriptions.Item>
            <Descriptions.Item label="모집 인원">
              {state.maxParticipants}명
            </Descriptions.Item>
            {state.projectStartDate && state.projectEndDate && (
              <Descriptions.Item label="과제 기간">
                {state.projectStartDate} ~ {state.projectEndDate}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* 수집 항목 */}
        <Card
          title={`📝 수집 항목 (${state.selectedItemIds.length}개)`}
          extra={<Button type="link" icon={<EditOutlined />}>수정</Button>}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {state.selectedItemIds.map(itemId => (
              <div key={itemId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>항목 {itemId}</span>
                <Tag color="green">{state.scoreAllocation[itemId] || 0}점</Tag>
              </div>
            ))}
          </Space>

          <Alert
            type={totalScore === 100 ? 'success' : 'error'}
            message={`총 배점: ${totalScore}/100점`}
            showIcon
            style={{ marginTop: 16 }}
          />
        </Card>

        {/* 심사위원 */}
        <Card
          title={`👥 심사위원 (${state.selectedReviewerIds.length}명)`}
          extra={<Button type="link" icon={<EditOutlined />}>수정</Button>}
        >
          {state.selectedReviewerIds.length >= 2 ? (
            <Alert
              type="success"
              message={`${state.selectedReviewerIds.length}명의 심사위원이 선택되었습니다`}
              showIcon
            />
          ) : (
            <Alert
              type="error"
              message="최소 2명의 심사위원이 필요합니다"
              showIcon
            />
          )}
        </Card>

        {/* 참고 과제 */}
        {state.referenceProjectId && (
          <Card title="📚 참고 과제">
            <Tag color="purple">과제 ID: {state.referenceProjectId}</Tag>
            <p style={{ marginTop: 8, color: '#8c8c8c' }}>
              이 과제의 설정을 기반으로 생성됩니다
            </p>
          </Card>
        )}
      </Space>
    </div>
  )
}
