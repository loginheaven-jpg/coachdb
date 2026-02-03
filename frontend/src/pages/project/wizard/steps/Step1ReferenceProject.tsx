import { Radio, Select, Space, Alert, message } from 'antd'
import { useState, useEffect } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'
import projectService from '../../../../services/projectService'

interface Step1Props {
  state: WizardState
  actions: WizardActions
}

export default function Step1ReferenceProject({ state, actions }: Step1Props) {
  const [hasReference, setHasReference] = useState<boolean>(false)
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadRecentProjects()
  }, [])

  const loadRecentProjects = async () => {
    setLoading(true)
    try {
      const allProjects = await projectService.listProjects({ limit: 20 })
      // 최근 생성된 순으로 이미 정렬되어 옴
      setProjects(allProjects)
    } catch (error) {
      console.error('Failed to load projects:', error)
      message.error('과제 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleReferenceChange = (value: boolean) => {
    setHasReference(value)
    if (!value) {
      actions.setReferenceProject(null)
    }
  }

  const handleProjectSelect = async (projectId: number) => {
    actions.setReferenceProject(projectId)

    try {
      // Load selected project details
      const project = await projectService.getProject(projectId)
      const projectItems = await projectService.getProjectItems(projectId)
      const projectStaff = await projectService.getProjectStaff(projectId)

      // Populate wizard state with reference project data
      actions.updateProjectInfo({
        projectName: `${project.project_name} (복사본)`,
        projectType: project.project_type || 'business_coaching',
        supportProgramName: project.support_program_name || '',
        description: project.description || '',
        projectStartDate: project.project_start_date || '',
        projectEndDate: project.project_end_date || ''
      })

      // Set selected items and scores
      const itemIds = projectItems.map(item => item.item_id)
      const scoreAllocation: Record<number, number> = {}
      projectItems.forEach(item => {
        scoreAllocation[item.item_id] = item.max_score || 0
      })

      // Set reviewers
      const reviewerIds = projectStaff.staff_list.map(staff => staff.staff_user_id)

      // Update wizard state with items, scores, and reviewers
      actions.updateProjectInfo({
        selectedItemIds: itemIds,
        scoreAllocation: scoreAllocation,
        selectedReviewerIds: reviewerIds
      })

      message.success('참고 과제 정보를 불러왔습니다')
    } catch (error) {
      console.error('Failed to load reference project:', error)
      message.error('과제 정보를 불러오는데 실패했습니다')
    }
  }

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        참고할 기존 과제가 있나요?
      </h2>

      <div className="wizard-question-hint">
        💡 기존 과제를 선택하면 설정을 불러와 빠르게 시작할 수 있습니다
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Radio.Group
          value={hasReference}
          onChange={e => handleReferenceChange(e.target.value)}
          size="large"
        >
          <Space direction="vertical">
            <Radio value={false}>없음 (빈 상태로 시작)</Radio>
            <Radio value={true}>기존 과제 복제하기</Radio>
          </Space>
        </Radio.Group>

        {hasReference && (
          <Select
            placeholder="과제를 검색하거나 선택하세요"
            size="large"
            style={{ width: '100%' }}
            showSearch
            loading={loading}
            options={projects.map(p => ({
              label: p.project_name,
              value: p.project_id
            }))}
            onChange={handleProjectSelect}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        )}

        {state.referenceProjectId && (
          <Alert
            type="success"
            message="참고 과제가 선택되었습니다"
            description="다음 단계에서 기본값이 자동으로 입력됩니다"
            showIcon
          />
        )}
      </Space>
    </div>
  )
}
