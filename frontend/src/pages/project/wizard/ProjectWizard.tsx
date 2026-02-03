import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useWizardState } from '../../../hooks/useWizardState'
import WizardLayout from './WizardLayout'
import WizardPreview from '../../../components/wizard/WizardPreview'

// Step components
import Step1ReferenceProject from './steps/Step1ReferenceProject'
import Step2BasicInfo from './steps/Step2BasicInfo'
import Step3ItemSelection from './steps/Step3ItemSelection'
import Step4Scoring from './steps/Step4Scoring'
import Step5Reviewers from './steps/Step5Reviewers'
import Step6Review from './steps/Step6Review'

export default function ProjectWizard() {
  const navigate = useNavigate()
  const { state, actions } = useWizardState()

  const handleComplete = async () => {
    try {
      // TODO: API 호출 - 프로젝트 생성
      message.success('과제가 성공적으로 생성되었습니다')
      navigate('/projects')
    } catch (error) {
      message.error('과제 생성에 실패했습니다')
      console.error(error)
    }
  }

  const renderStepContent = () => {
    switch (state.currentStep) {
      case 1:
        return <Step1ReferenceProject state={state} actions={actions} />
      case 2:
        return <Step2BasicInfo state={state} actions={actions} />
      case 3:
        return <Step3ItemSelection state={state} actions={actions} />
      case 4:
        return <Step4Scoring state={state} actions={actions} />
      case 5:
        return <Step5Reviewers state={state} actions={actions} />
      case 6:
        return <Step6Review state={state} actions={actions} />
      default:
        return null
    }
  }

  return (
    <WizardLayout
      currentStep={state.currentStep}
      leftContent={renderStepContent()}
      rightContent={<WizardPreview state={state} />}
      onPrevious={actions.prevStep}
      onNext={actions.nextStep}
      onComplete={handleComplete}
      canProceed={actions.canProceed()}
    />
  )
}
