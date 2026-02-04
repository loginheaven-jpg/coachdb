import { ReactNode } from 'react'
import { Button, Space, Popconfirm, message } from 'antd'
import { CheckOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import './WizardLayout.css'

interface WizardLayoutProps {
  currentStep: number
  leftContent: ReactNode
  rightContent: ReactNode
  onPrevious: () => void
  onNext: () => void
  onComplete: () => void
  onReset: () => void
  onSaveDraft?: () => void
  canProceed: boolean
}

const steps = [
  { title: '시작', description: '참고 과제' },
  { title: '기본정보', description: '과제 정보' },
  { title: '항목선택', description: '수집 항목' },
  { title: '배점설정', description: '점수 배분' },
  { title: '심사위원', description: '담당자' },
  { title: '완료', description: '검토' }
]

export default function WizardLayout({
  currentStep,
  leftContent,
  rightContent,
  onPrevious,
  onNext,
  onComplete,
  onReset,
  onSaveDraft,
  canProceed
}: WizardLayoutProps) {
  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === 6

  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft()
    } else {
      // 기본 임시저장 (localStorage)
      message.info('임시저장 기능은 추후 구현 예정입니다')
    }
  }

  return (
    <div className="kca-wizard-layout">
      {/* Left Sidebar - 240px */}
      <aside className="kca-step-sidebar">
        <div className="kca-step-header">
          <h2>과제 생성 위저드</h2>
          <div className="kca-step-progress">단계 {currentStep}/6</div>
        </div>
        <nav className="kca-step-list">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isActive = currentStep === stepNumber
            const isCompleted = currentStep > stepNumber
            const isPending = currentStep < stepNumber

            return (
              <div
                key={stepNumber}
                className={`kca-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''}`}
              >
                <div className="kca-step-num">
                  {isCompleted ? <CheckOutlined /> : stepNumber}
                </div>
                <div className="kca-step-info">
                  <div className="kca-step-title">{step.title}</div>
                  <div className="kca-step-desc">{step.description}</div>
                </div>
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Content Area - Split View */}
      <div className="kca-content-area">
        {/* Form Panel (Left) */}
        <div className="kca-form-panel">
          <div className="kca-form-panel-inner">
            {leftContent}
          </div>
        </div>

        {/* Preview Panel (Right) */}
        <div className="kca-preview-panel">
          <div className="kca-preview-header">
            <h3>👁️ 실시간 미리보기</h3>
            <p>좌측에서 입력한 내용이 실제 화면에 어떻게 보이는지 확인하세요</p>
          </div>
          <div className="kca-preview-content">
            {rightContent}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="kca-action-bar">
        <div className="kca-action-bar-inner">
          {/* 왼쪽: 이전 | 다음 */}
          <Space>
            {!isFirstStep && (
              <Button size="large" onClick={onPrevious}>
                이전
              </Button>
            )}
            {!isLastStep && (
              <Button type="primary" size="large" onClick={onNext} disabled={!canProceed}>
                다음
              </Button>
            )}
          </Space>

          {/* 오른쪽: 임시저장 | 새로시작 | 완료 */}
          <Space>
            <Button icon={<SaveOutlined />} onClick={handleSaveDraft}>
              임시저장
            </Button>
            <Popconfirm
              title="새로 시작"
              description="모든 입력 내용이 초기화됩니다. 계속하시겠습니까?"
              onConfirm={onReset}
              okText="예"
              cancelText="아니오"
            >
              <Button icon={<ReloadOutlined />}>
                새로시작
              </Button>
            </Popconfirm>
            {isLastStep && (
              <Button type="primary" size="large" onClick={onComplete}>
                완료
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  )
}
