import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Typography,
  Tabs,
  Button,
  Space,
  Modal,
  Spin,
  message
} from 'antd'
import {
  ArrowLeftOutlined,
  FormOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  SendOutlined
} from '@ant-design/icons'
import { ProjectEditProvider, useProjectEdit } from '../contexts/ProjectEditContext'
import ProjectInfoTab from './project/ProjectInfoTab'
import ProjectSurveyTab from './project/ProjectSurveyTab'
import ProjectReviewPlanTab from './project/ProjectReviewPlanTab'
import ProjectApplicationsTab from './project/ProjectApplicationsTab'
import ProjectSelectionTab from './project/ProjectSelectionTab'
import ProjectClosureTab from './project/ProjectClosureTab'

const { Title } = Typography

// ============================================================================
// Tab Configuration
// ============================================================================
interface TabConfig {
  key: string
  label: string
  icon: React.ReactNode
  requiresRecruitment?: boolean
}

const TAB_CONFIG: TabConfig[] = [
  { key: 'info', label: '과제정보', icon: <FormOutlined /> },
  { key: 'survey', label: '설문항목', icon: <FileTextOutlined /> },
  { key: 'reviewPlan', label: '심사계획', icon: <TeamOutlined /> },
  { key: 'applications', label: '응모현황', icon: <UserOutlined />, requiresRecruitment: true },
  { key: 'selection', label: '선발심사', icon: <TrophyOutlined />, requiresRecruitment: true },
  { key: 'closure', label: '과제마감', icon: <CheckCircleOutlined />, requiresRecruitment: true }
]

// ============================================================================
// Inner Component (uses context)
// ============================================================================
function ProjectUnifiedPageInner() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    project,
    loading,
    saving,
    finalizing,
    isCreateMode,
    canFinalize,
    scoreValidation,
    staffList,
    loadProject,
    loadScoreValidation,
    loadStaffList,
    submitForApproval,
    activeTab,
    setActiveTab,
    isRecruitmentStarted
  } = useProjectEdit()

  // 초기 데이터 로드
  useEffect(() => {
    if (!isCreateMode) {
      loadProject()
      loadScoreValidation()
      loadStaffList()
    }
  }, [isCreateMode, loadProject, loadScoreValidation, loadStaffList])

  // URL에서 탭 읽기
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams, setActiveTab])

  // 표시할 탭 목록
  const visibleTabs = useMemo(() => {
    return TAB_CONFIG.filter(tab => !tab.requiresRecruitment || isRecruitmentStarted)
  }, [isRecruitmentStarted])

  // 탭 변경 핸들러
  const handleTabChange = (key: string) => {
    setActiveTab(key)
    setSearchParams({ tab: key }, { replace: true })
  }

  // 생성완료 검증 및 처리
  const handleFinalize = async () => {
    const errors: string[] = []

    // 1. 설문 100점 검증
    if (!scoreValidation?.is_valid) {
      errors.push(`설문 점수: ${scoreValidation?.total_score || 0}/100점 (100점 필요)`)
    }

    // 2. 심사위원 1명 이상
    if (staffList.length === 0) {
      errors.push('심사위원: 0명 (최소 1명 필요)')
    }

    // 3. 미충족 시 팝업
    if (errors.length > 0) {
      Modal.warning({
        title: '생성완료 조건 미충족',
        content: (
          <ul className="list-disc pl-4 mt-2">
            {errors.map((err, i) => (
              <li key={i} className="text-red-600 mb-1">{err}</li>
            ))}
          </ul>
        )
      })
      return
    }

    // 4. 확인 팝업
    Modal.confirm({
      title: '과제 생성완료',
      content: '생성완료 후 관리자 승인을 기다려야 합니다. 진행하시겠습니까?',
      okText: '생성완료',
      cancelText: '취소',
      onOk: async () => {
        const success = await submitForApproval()
        if (success) {
          navigate('/projects/manage')
        }
      }
    })
  }

  // 취소 핸들러
  const handleCancel = () => {
    navigate('/projects/manage')
  }

  // 로딩 중
  if (loading && !project && !isCreateMode) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spin size="large" />
      </div>
    )
  }

  // 탭 아이템 구성
  const tabItems = visibleTabs.map(tab => {
    let children: React.ReactNode = null

    switch (tab.key) {
      case 'info':
        children = <ProjectInfoTab />
        break
      case 'survey':
        children = <ProjectSurveyTab />
        break
      case 'reviewPlan':
        children = <ProjectReviewPlanTab />
        break
      case 'applications':
        children = <ProjectApplicationsTab />
        break
      case 'selection':
        children = <ProjectSelectionTab />
        break
      case 'closure':
        children = <ProjectClosureTab />
        break
    }

    // 설문항목 탭에 점수 표시
    let label = tab.label
    if (tab.key === 'survey' && scoreValidation) {
      const scoreColor = scoreValidation.is_valid ? 'text-green-600' : 'text-orange-500'
      label = (
        <span>
          {tab.label}
          <span className={`ml-2 ${scoreColor}`}>
            ({scoreValidation.total_score}/100점)
          </span>
        </span>
      ) as any
    }

    // 심사계획 탭에 심사위원 수 표시
    if (tab.key === 'reviewPlan') {
      const staffColor = staffList.length > 0 ? 'text-green-600' : 'text-orange-500'
      label = (
        <span>
          {tab.label}
          <span className={`ml-2 ${staffColor}`}>
            ({staffList.length}명)
          </span>
        </span>
      ) as any
    }

    return {
      key: tab.key,
      label: (
        <span>
          {tab.icon}
          <span className="ml-1">{label}</span>
        </span>
      ),
      children
    }
  })

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* 헤더 */}
        <div className="mb-6">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/projects/manage')}
            className="mb-4"
          >
            과제 목록
          </Button>
          <Title level={3} className="mb-0">
            {isCreateMode ? '새 과제 만들기' : project?.project_name || '과제 수정'}
          </Title>
        </div>

        {/* 탭 영역 */}
        <div className="bg-white rounded-lg shadow">
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems}
            className="p-4"
            tabBarStyle={{ marginBottom: 16 }}
          />

          {/* 하단 버튼 영역 */}
          <div className="border-t px-6 py-4 flex justify-end gap-3 bg-gray-50">
            <Button onClick={handleCancel}>
              취소
            </Button>
            <Button
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => {
                // InfoTab의 form을 통해 저장
                const event = new CustomEvent('projectTempSave')
                window.dispatchEvent(event)
              }}
            >
              임시저장 (초안)
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={finalizing}
              onClick={handleFinalize}
            >
              생성완료
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component (provides context)
// ============================================================================
export default function ProjectUnifiedPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>()
  const projectId = projectIdParam ? parseInt(projectIdParam) : null

  return (
    <ProjectEditProvider projectId={projectId}>
      <ProjectUnifiedPageInner />
    </ProjectEditProvider>
  )
}
