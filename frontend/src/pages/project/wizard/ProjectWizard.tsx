import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { message, Modal } from 'antd'
import { useWizardState } from '../../../hooks/useWizardState'
import WizardLayout from './WizardLayout'
import WizardPreview from '../../../components/wizard/WizardPreview'
import projectService, { ProofRequiredLevel, MatchingType, type ScoringCriteriaCreate } from '../../../services/projectService'
import { useAuthStore } from '../../../stores/authStore'
import type { ProjectStatus } from '../../../types'
import { buildScoringCriteria } from '../../../utils/scoringHelpers'

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
  const { user } = useAuthStore()

  // 컴포넌트 마운트 시 임시저장 데이터 확인
  useEffect(() => {
    const hasDraft = localStorage.getItem('pcms_wizard_draft')
    if (hasDraft) {
      Modal.confirm({
        title: '임시저장된 데이터 발견',
        content: '이전에 임시저장된 과제 데이터가 있습니다. 불러오시겠습니까?',
        okText: '불러오기',
        cancelText: '새로 시작',
        onOk: () => {
          const loaded = actions.loadDraft()
          if (loaded) {
            message.success('임시저장 데이터를 불러왔습니다')
          }
        },
        onCancel: () => {
          localStorage.removeItem('pcms_wizard_draft')
        }
      })
    }
  }, [])

  const handleSaveDraft = () => {
    try {
      actions.saveDraft()
      message.success('임시저장되었습니다')
    } catch (error) {
      message.error('임시저장에 실패했습니다')
    }
  }

  const handleComplete = async () => {
    try {
      // Step 1: Create the project
      const projectData = {
        project_name: state.projectName,
        project_type: state.projectType as any,
        support_program_name: state.supportProgramName || null,
        description: state.description || null,
        recruitment_start_date: state.recruitmentStartDate,
        recruitment_end_date: state.recruitmentEndDate,
        project_start_date: state.projectStartDate || null,
        project_end_date: state.projectEndDate || null,
        project_manager_id: user?.user_id || null,
        status: 'draft' as ProjectStatus
      }

      const createdProject = await projectService.createProject(projectData)
      message.success('과제가 생성되었습니다')

      // Step 2: Add selected items with scores
      for (const itemId of state.selectedItemIds) {
        const itemScore = state.scoreAllocation[itemId] || 0
        const scoringConfig = state.scoringConfigs[itemId]

        // scoringConfig가 있으면 사용, 없으면 기본 EXACT
        const scoringCriteria: ScoringCriteriaCreate[] = scoringConfig
          ? buildScoringCriteria(scoringConfig) as any
          : itemScore > 0 ? [{
              matching_type: MatchingType.EXACT,
              expected_value: '',
              score: itemScore
            }] : []

        // proof_required_level: scoring Config의 proofRequired를 사용하되,
        // 타입 호환성을 위해 조건부로 처리
        let proofLevel = ProofRequiredLevel.REQUIRED
        if (scoringConfig?.proofRequired) {
          // 문자열 값이 일치하면 사용
          const proofValue = scoringConfig.proofRequired as any
          if (Object.values(ProofRequiredLevel).includes(proofValue)) {
            proofLevel = proofValue
          }
        }

        await projectService.addProjectItem(createdProject.project_id, {
          item_id: itemId,
          is_required: true,
          proof_required_level: proofLevel,
          max_score: itemScore,
          display_order: state.selectedItemIds.indexOf(itemId) + 1,
          scoring_criteria: scoringCriteria
        })
      }

      // Step 3: Add reviewers as staff
      for (const reviewerId of state.selectedReviewerIds) {
        await projectService.addProjectStaff(createdProject.project_id, reviewerId)
      }

      message.success('과제가 성공적으로 생성되었습니다!')
      // 임시저장 데이터 삭제
      localStorage.removeItem('pcms_wizard_draft')
      navigate(`/projects/manage/${createdProject.project_id}`)
    } catch (error: any) {
      console.error('Failed to create project:', error)
      message.error(error.response?.data?.detail || '과제 생성에 실패했습니다')
    }
  }

  const handleReset = () => {
    actions.reset()
    message.success('위저드가 초기화되었습니다')
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
      onReset={handleReset}
      onSaveDraft={handleSaveDraft}
      canProceed={actions.canProceed()}
    />
  )
}
