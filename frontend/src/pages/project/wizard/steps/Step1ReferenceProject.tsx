import { Radio, Select, Space, Alert } from 'antd'
import { useState, useEffect } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'

interface Step1Props {
  state: WizardState
  actions: WizardActions
}

export default function Step1ReferenceProject({ state, actions }: Step1Props) {
  const [hasReference, setHasReference] = useState<boolean>(false)
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // TODO: API - 최근 과제 목록 불러오기
    // GET /api/projects?limit=10&sort=created_at:desc
    setProjects([])
  }, [])

  const handleReferenceChange = (value: boolean) => {
    setHasReference(value)
    if (!value) {
      actions.setReferenceProject(null)
    }
  }

  const handleProjectSelect = (projectId: number) => {
    actions.setReferenceProject(projectId)
    // TODO: API - 선택한 과제 정보 불러오기
    // GET /api/projects/{projectId}
    // actions.updateProjectInfo({ ...projectData })
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
