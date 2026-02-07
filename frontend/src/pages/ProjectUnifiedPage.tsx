import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Typography,
  Tabs,
  Button,
  Space,
  Modal,
  Spin,
  message,
  Tag,
  Input,
  Form,
  Switch,
  Table,
  Checkbox
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
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { ProjectEditProvider, useProjectEdit } from '../contexts/ProjectEditContext'
import { useAuthStore } from '../stores/authStore'
import projectService, { ProjectListItem } from '../services/projectService'
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
// 상태 표시용 라벨
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '초안', color: 'default' },
  pending: { label: '승인대기', color: 'orange' },
  rejected: { label: '반려됨', color: 'red' },
  approved: { label: '승인완료', color: 'green' },
  ready: { label: '모집개시', color: 'blue' },
  recruiting: { label: '접수중', color: 'blue' },
  reviewing: { label: '심사중', color: 'purple' },
  in_progress: { label: '과제진행', color: 'cyan' },
  evaluating: { label: '평가중', color: 'geekblue' },
  closed: { label: '종료', color: 'default' }
}

function ProjectUnifiedPageInner() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasRole } = useAuthStore()
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

  // 승인/반려 상태
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // 과제 복사 상태 (기존 과제에서 복사)
  const [copyModalVisible, setCopyModalVisible] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyForm] = Form.useForm()

  // 생성 모드: 기존 과제에서 복제 상태
  const [copyFromModalVisible, setCopyFromModalVisible] = useState(false)
  const [projectList, setProjectList] = useState<ProjectListItem[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null)
  const [copyFromForm] = Form.useForm()

  // 권한 확인
  const isSuperAdmin = hasRole('SUPER_ADMIN')
  const canApprove = isSuperAdmin && project?.status === 'pending'

  // 승인 처리
  const handleApprove = async () => {
    if (!project) return
    Modal.confirm({
      title: '과제 승인',
      content: `'${project.project_name}' 과제를 승인하시겠습니까?`,
      okText: '승인',
      cancelText: '취소',
      onOk: async () => {
        setApproving(true)
        try {
          await projectService.approveProject(project.project_id)
          message.success('과제가 승인되었습니다.')
          loadProject() // 상태 갱신
        } catch (error: any) {
          message.error(error.response?.data?.detail || '승인 처리에 실패했습니다.')
        } finally {
          setApproving(false)
        }
      }
    })
  }

  // 반려 모달 열기
  const handleRejectClick = () => {
    setRejectReason('')
    setRejectModalOpen(true)
  }

  // 반려 처리
  const handleReject = async () => {
    if (!project || !rejectReason.trim()) {
      message.warning('반려 사유를 입력해주세요.')
      return
    }
    setRejecting(true)
    try {
      await projectService.rejectProject(project.project_id, rejectReason.trim())
      message.success('과제가 반려되었습니다.')
      setRejectModalOpen(false)
      loadProject() // 상태 갱신
    } catch (error: any) {
      message.error(error.response?.data?.detail || '반려 처리에 실패했습니다.')
    } finally {
      setRejecting(false)
    }
  }

  // 과제 복사 처리
  const handleCopyProject = async (values: { new_project_name: string; copy_staff: boolean }) => {
    if (!project) return
    setCopyLoading(true)
    try {
      const result = await projectService.copyProject(project.project_id, {
        new_project_name: values.new_project_name,
        copy_staff: values.copy_staff
      })
      message.success(result.message)
      setCopyModalVisible(false)
      copyForm.resetFields()
      // 복사된 과제의 수정 페이지로 이동
      navigate(`/projects/manage/${result.project_id}?tab=info`)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '과제 복사에 실패했습니다.')
    } finally {
      setCopyLoading(false)
    }
  }

  // 생성 모드: 기존 과제에서 복제 핸들러
  const handleCopyFromProject = async (values: { new_project_name: string; copy_staff: boolean }) => {
    if (!selectedProject) return
    setCopyLoading(true)
    try {
      const result = await projectService.copyProject(selectedProject.project_id, {
        new_project_name: values.new_project_name,
        copy_staff: values.copy_staff
      })
      message.success('과제가 복제되었습니다.')
      setCopyFromModalVisible(false)
      setSelectedProject(null)
      copyFromForm.resetFields()
      // 복제된 과제의 수정 페이지로 이동
      navigate(`/projects/manage/${result.project_id}?tab=info`)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '과제 복제에 실패했습니다.')
    } finally {
      setCopyLoading(false)
    }
  }

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

  // 탭 변경 핸들러 - 과제정보 탭에서 나갈 때 자동저장
  const handleTabChange = async (key: string) => {
    if (activeTab === 'info' && key !== 'info') {
      // 과제정보 탭에서 다른 탭으로 이동 시 자동저장 시도
      const success = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('projectAutoSaveResult', resultHandler as EventListener)
          resolve(false)
        }, 15000)

        const resultHandler = (e: Event) => {
          clearTimeout(timeout)
          window.removeEventListener('projectAutoSaveResult', resultHandler as EventListener)
          resolve((e as CustomEvent).detail.success)
        }

        window.addEventListener('projectAutoSaveResult', resultHandler as EventListener)
        window.dispatchEvent(new CustomEvent('projectAutoSave', { detail: { targetTab: key } }))
      })

      if (!success) return // 저장 실패 시 과제정보 탭 유지
    }

    setActiveTab(key)
    setSearchParams({ tab: key }, { replace: true })
  }

  // 승인신청 검증 및 처리
  const handleFinalize = async () => {
    const errors: string[] = []

    // 1. 과제정보 필수 필드 검증 (모집기간만 필수)
    if (!project?.recruitment_start_date || !project?.recruitment_end_date) {
      errors.push('과제정보: 모집기간 미입력')
    }
    // 과제기간(예정)은 필수 아님

    // 2. 설문 100점 검증
    if (!scoreValidation?.is_valid) {
      errors.push(`설문 점수: ${scoreValidation?.total_score || 0}/100점 (100점 필요)`)
    }

    // 3. 심사위원 1명 이상
    if (staffList.length === 0) {
      errors.push('심사위원: 0명 (최소 1명 필요)')
    }

    // 4. 미충족 시 팝업
    if (errors.length > 0) {
      Modal.warning({
        title: '승인신청 조건 미충족',
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

    // 5. 확인 팝업
    Modal.confirm({
      title: '승인 신청',
      content: '승인신청 후 관리자 승인을 기다려야 합니다. 진행하시겠습니까?',
      okText: '승인신청',
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
          <span className={`ml-1 ${scoreColor}`}>
            ({Math.round(scoreValidation.total_score)}/100점)
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
          <span className={`ml-1 ${staffColor}`}>
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
          <div className="flex justify-between items-start">
            <div>
              <Title level={3} className="mb-0">
                {isCreateMode ? '새 과제 만들기' : project?.project_name || '과제 수정'}
              </Title>
              {/* 상태 표시 */}
              {!isCreateMode && project && (
                <Tag color={STATUS_LABELS[project.status]?.color || 'default'} className="mt-2">
                  {STATUS_LABELS[project.status]?.label || project.status}
                </Tag>
              )}
            </div>
            {/* 헤더 액션 버튼들 */}
            <Space>
              {/* 생성 모드: 기존 과제에서 복제 버튼 */}
              {isCreateMode && (
                <Button
                  icon={<CopyOutlined />}
                  loading={loadingProjects}
                  onClick={async () => {
                    setLoadingProjects(true)
                    try {
                      const list = await projectService.listProjects()
                      setProjectList(list)
                      setCopyFromModalVisible(true)
                    } catch (error) {
                      message.error('과제 목록을 불러오는데 실패했습니다.')
                    } finally {
                      setLoadingProjects(false)
                    }
                  }}
                >
                  기존 과제에서 복제
                </Button>
              )}
              {/* 과제 복사 버튼 (편집 모드에서만) */}
              {!isCreateMode && project && (
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    copyForm.setFieldsValue({
                      new_project_name: `${project.project_name} (복사본)`,
                      copy_staff: true
                    })
                    setCopyModalVisible(true)
                  }}
                >
                  과제복사
                </Button>
              )}
              {/* SUPER_ADMIN 승인/반려 버튼 */}
              {canApprove && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={approving}
                    onClick={handleApprove}
                  >
                    승인
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={handleRejectClick}
                  >
                    반려
                  </Button>
                </>
              )}
            </Space>
          </div>
        </div>

        {/* 탭 영역 */}
        <div className="bg-white rounded-lg shadow">
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems}
            className="p-4"
            tabBarStyle={{ marginBottom: 16 }}
            tabBarGutter={12}
          />

          {/* 하단 버튼 영역 */}
          <div className="border-t px-6 py-4 flex justify-end gap-3 bg-gray-50">
            <Button onClick={handleCancel}>
              취소
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                // SurveyBuilder의 미리보기 트리거
                const event = new CustomEvent('projectSurveyPreview')
                window.dispatchEvent(event)
              }}
            >
              미리보기
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
              임시저장
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={finalizing}
              onClick={handleFinalize}
            >
              승인신청
            </Button>
          </div>
        </div>
      </div>

      {/* 반려 사유 입력 모달 */}
      <Modal
        title="과제 반려"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={handleReject}
        okText="반려"
        cancelText="취소"
        okButtonProps={{ danger: true, loading: rejecting }}
      >
        <div className="py-4">
          <p className="mb-2 text-gray-600">반려 사유를 입력해주세요:</p>
          <Input.TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="반려 사유를 상세히 입력해주세요. (필수)"
          />
        </div>
      </Modal>

      {/* 과제 복사 모달 */}
      <Modal
        title="과제 복사"
        open={copyModalVisible}
        onCancel={() => {
          setCopyModalVisible(false)
          copyForm.resetFields()
        }}
        onOk={() => copyForm.submit()}
        okText="복사"
        cancelText="취소"
        confirmLoading={copyLoading}
      >
        <Form
          form={copyForm}
          layout="vertical"
          onFinish={handleCopyProject}
          initialValues={{
            copy_staff: true
          }}
        >
          <Form.Item
            name="new_project_name"
            label="새 과제명"
            rules={[{ required: true, message: '새 과제명을 입력해주세요.' }]}
          >
            <Input placeholder="복사할 과제의 새 이름" />
          </Form.Item>
          <Form.Item
            name="copy_staff"
            label="심사위원 복사"
            valuePropName="checked"
          >
            <Switch checkedChildren="복사" unCheckedChildren="제외" />
          </Form.Item>
          <p className="text-gray-500 text-sm">
            * 복사된 과제는 '초안' 상태로 생성됩니다.
          </p>
        </Form>
      </Modal>

      {/* 생성 모드: 기존 과제에서 복제 모달 */}
      <Modal
        title="복제할 과제 선택"
        open={copyFromModalVisible}
        width={800}
        footer={null}
        onCancel={() => {
          setCopyFromModalVisible(false)
          setSelectedProject(null)
          copyFromForm.resetFields()
        }}
      >
        {selectedProject ? (
          // 2단계: 새 과제명 입력
          <Form
            form={copyFromForm}
            layout="vertical"
            onFinish={handleCopyFromProject}
            initialValues={{
              new_project_name: `${selectedProject.project_name} (복사본)`,
              copy_staff: true
            }}
          >
            <p className="mb-4">
              선택된 과제: <strong>{selectedProject.project_name}</strong>
            </p>
            <Form.Item
              name="new_project_name"
              label="새 과제명"
              rules={[{ required: true, message: '새 과제명을 입력해주세요.' }]}
            >
              <Input placeholder="복제할 과제의 새 이름" />
            </Form.Item>
            <Form.Item
              name="copy_staff"
              valuePropName="checked"
            >
              <Checkbox>심사위원 복사</Checkbox>
            </Form.Item>
            <p className="text-gray-500 text-sm mb-4">
              * 설문항목, 배점기준, 커스텀질문이 복제됩니다.<br />
              * 복제된 과제는 '초안' 상태로 생성됩니다.
            </p>
            <Space>
              <Button onClick={() => {
                setSelectedProject(null)
                copyFromForm.resetFields()
              }}>
                뒤로
              </Button>
              <Button type="primary" htmlType="submit" loading={copyLoading}>
                복제
              </Button>
            </Space>
          </Form>
        ) : (
          // 1단계: 과제 선택 테이블
          <Table
            dataSource={projectList}
            rowKey="project_id"
            size="small"
            pagination={{ pageSize: 8 }}
            onRow={(record) => ({
              onClick: () => {
                setSelectedProject(record)
                copyFromForm.setFieldsValue({
                  new_project_name: `${record.project_name} (복사본)`,
                  copy_staff: true
                })
              },
              style: { cursor: 'pointer' }
            })}
            columns={[
              {
                title: '과제명',
                dataIndex: 'project_name',
                ellipsis: true
              },
              {
                title: '상태',
                dataIndex: 'status',
                width: 100,
                render: (status: string) => (
                  <Tag color={STATUS_LABELS[status]?.color || 'default'}>
                    {STATUS_LABELS[status]?.label || status}
                  </Tag>
                )
              },
              {
                title: '생성일',
                dataIndex: 'created_at',
                width: 120,
                render: (date: string) => date?.split('T')[0]
              }
            ]}
          />
        )}
      </Modal>
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
