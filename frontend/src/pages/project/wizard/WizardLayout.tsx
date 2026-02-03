import { ReactNode } from 'react'
import { Steps, Button, Space } from 'antd'
import './WizardLayout.css'

interface WizardLayoutProps {
  currentStep: number
  leftContent: ReactNode
  rightContent: ReactNode
  onPrevious: () => void
  onNext: () => void
  onComplete: () => void
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
  canProceed
}: WizardLayoutProps) {
  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === 6

  return (
    <div className="wizard-layout">
      {/* Header with Progress */}
      <div className="wizard-header">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="wizard-title">
            <Space>
              {!isFirstStep && (
                <Button onClick={onPrevious}>
                  이전
                </Button>
              )}
              <h1>과제 생성 위저드 ({currentStep}/6단계)</h1>
              <div style={{ flex: 1 }} />
              {!isLastStep ? (
                <Button type="primary" onClick={onNext} disabled={!canProceed}>
                  다음
                </Button>
              ) : (
                <Button type="primary" onClick={onComplete}>
                  완료
                </Button>
              )}
            </Space>
          </div>
          <Steps
            current={currentStep - 1}
            items={steps}
            style={{ maxWidth: 800, margin: '0 auto' }}
          />
        </Space>
      </div>

      {/* Split View Content */}
      <div className="wizard-content">
        <div className="wizard-left-panel">
          <div className="wizard-panel-inner">
            {leftContent}
          </div>
        </div>
        <div className="wizard-right-panel">
          <div className="wizard-panel-inner">
            <div className="wizard-preview-header">
              <h3>👁️ 실시간 미리보기</h3>
              <p className="text-muted">좌측에서 입력한 내용이 실제 화면에 어떻게 보이는지 확인하세요</p>
            </div>
            {rightContent}
          </div>
        </div>
      </div>
    </div>
  )
}
