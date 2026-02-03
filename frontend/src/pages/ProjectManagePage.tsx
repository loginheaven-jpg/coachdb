import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Table,
  Tag,
  message,
  Space,
  Select,
  Row,
  Col,
  Statistic,
  Popconfirm
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  FolderOpenOutlined,
  UserOutlined,
  DeleteOutlined,
  TeamOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import projectService, { ProjectListItem, ProjectStatus } from '../services/projectService'
import { useAuthStore } from '../stores/authStore'
import TestProjectCleanupModal from '../components/TestProjectCleanupModal'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function ProjectManagePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [testProjectLoading, setTestProjectLoading] = useState(false)
  const [testWithAppsLoading, setTestWithAppsLoading] = useState(false)
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | undefined>()

  // 사용자 역할 파싱
  const userRoles: string[] = (() => {
    try {
      return user?.roles ? JSON.parse(user.roles) : []
    } catch {
      return []
    }
  })()

  // 수퍼어드민 여부
  const isSuperAdmin = user?.email === 'loginheaven@gmail.com' || userRoles.includes('SUPER_ADMIN')

  // 과제 생성 권한: 모든 인증된 사용자 (본인 과제만 관리 가능, SUPER_ADMIN 승인 필요)
  const canCreateProject = true

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      // mode=manage로 호출: 본인 과제만 (수퍼어드민은 전체)
      const projectsData = await projectService.listProjects({
        status: statusFilter,
        mode: 'manage'
      })
      setProjects(projectsData)
    } catch (error: any) {
      console.error('과제 목록 로드 실패:', error)
      message.error('과제 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTestProject = async () => {
    setTestProjectLoading(true)
    try {
      const project = await projectService.createTestProject()
      message.success(`테스트 과제가 생성되었습니다: ${project.project_name}`)
      loadData()
    } catch (error: any) {
      console.error('테스트 과제 생성 실패:', error)
      message.error('테스트 과제 생성에 실패했습니다.')
    } finally {
      setTestProjectLoading(false)
    }
  }

  const handleCreateTestWithApplications = async () => {
    setTestWithAppsLoading(true)
    try {
      const project = await projectService.createTestProjectWithApplications()
      message.success(`심사용 과제가 생성되었습니다: ${project.project_name} (응모자 10명)`)
      loadData()
    } catch (error: any) {
      console.error('심사용 과제 생성 실패:', error)
      message.error('심사용 과제 생성에 실패했습니다.')
    } finally {
      setTestWithAppsLoading(false)
    }
  }

  const handleDeleteProject = async (projectId: number) => {
    try {
      await projectService.deleteProject(projectId)
      message.success('과제가 삭제되었습니다.')
      loadData()
    } catch (error: any) {
      console.error('과제 삭제 실패:', error)
      message.error('과제 삭제에 실패했습니다.')
    }
  }

  // display_status를 사용하여 상태 표시
  const getStatusTag = (displayStatus: string | undefined, status: ProjectStatus) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '초안' },
      pending: { color: 'gold', text: '승인대기' },
      ready: { color: 'gold', text: '모집대기' },
      recruiting: { color: 'blue', text: '모집중' },
      recruiting_ended: { color: 'purple', text: '응모마감' },
      reviewing: { color: 'orange', text: '심사중' },
      in_progress: { color: 'cyan', text: '과제진행중' },
      evaluating: { color: 'geekblue', text: '과제평가중' },
      completed: { color: 'green', text: '완료' },
      closed: { color: 'default', text: '종료' }
    }
    const key = displayStatus || status
    const config = statusMap[key] || { color: 'default', text: key }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 기본 컬럼
  const baseColumns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (text: string, record: ProjectListItem) => (
        <a onClick={() => navigate(`/projects/manage/${record.project_id}`)}>
          {text}
        </a>
      ),
    },
    {
      title: '모집 기간',
      key: 'recruitment_period',
      width: 130,
      render: (_: any, record: ProjectListItem) => (
        <div>
          <div>{dayjs(record.recruitment_start_date).format('YYYY-MM-DD')}</div>
          <div className="text-xs text-gray-500">~</div>
          <div>{dayjs(record.recruitment_end_date).format('YYYY-MM-DD')}</div>
        </div>
      ),
    },
    {
      title: '과제 기간',
      key: 'project_period',
      width: 130,
      render: (_: any, record: ProjectListItem) => {
        if (!record.project_start_date || !record.project_end_date) {
          return <Text type="secondary">미정</Text>
        }
        return (
          <div>
            <div>{dayjs(record.project_start_date).format('YYYY-MM-DD')}</div>
            <div className="text-xs text-gray-500">~</div>
            <div>{dayjs(record.project_end_date).format('YYYY-MM-DD')}</div>
          </div>
        )
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_: ProjectStatus, record: ProjectListItem) => getStatusTag(record.display_status, record.status),
    },
    {
      title: '정원',
      key: 'participants',
      width: 100,
      render: (_: any, record: ProjectListItem) => {
        const appCount = record.application_count || 0
        const selectedCount = record.current_participants || 0
        const selectionComplete = ['in_progress', 'evaluating', 'closed', 'completed'].includes(record.status)

        if (selectionComplete) {
          return <span>{appCount}({selectedCount}) / {record.max_participants}</span>
        }
        return <span>{appCount} / {record.max_participants}</span>
      },
    },
  ]

  // SUPER_ADMIN용 과제관리자 컬럼
  const managerColumn = {
    title: '관리자',
    key: 'project_manager',
    width: 100,
    render: (_: any, record: ProjectListItem) => (
      <Text>{record.project_manager_name || '-'}</Text>
    ),
  }

  // 작업 컬럼 (삭제만)
  const actionColumn = {
    title: '작업',
    key: 'actions',
    width: 80,
    render: (_: any, record: ProjectListItem) => {
      const isDraft = record.status === 'draft'

      if (!isDraft) {
        return null
      }

      return (
        <Popconfirm
          title="과제 삭제"
          description="이 과제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          onConfirm={() => handleDeleteProject(record.project_id)}
          okText="삭제"
          cancelText="취소"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="link"
            size="small"
            icon={<DeleteOutlined />}
            danger
          >
            삭제
          </Button>
        </Popconfirm>
      )
    },
  }

  // 컬럼 조합: SUPER_ADMIN이면 관리자 컬럼 추가
  const columns = isSuperAdmin
    ? [...baseColumns, managerColumn, actionColumn]
    : [...baseColumns, actionColumn]

  // 통계 계산
  const stats = {
    total: projects.length,
    recruiting: projects.filter(p => p.display_status === 'recruiting').length,
    draft: projects.filter(p => p.status === 'draft').length,
    totalParticipants: projects.reduce((sum, p) => sum + (p.current_participants || 0), 0)
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
          >
            대시보드로 돌아가기
          </Button>
          {canCreateProject && (
            <Space direction="vertical" align="end">
              <Space>
                <Button
                  type="default"
                  icon={<ThunderboltOutlined />}
                  onClick={() => navigate('/projects/wizard')}
                  size="large"
                >
                  위저드로 생성
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/projects/create')}
                  size="large"
                >
                  직접 생성
                </Button>
              </Space>
              {isSuperAdmin && (
                <>
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={handleCreateTestProject}
                    loading={testProjectLoading}
                    style={{ color: '#999', fontSize: '12px' }}
                  >
                    테스트과제 생성
                  </Button>
                  <Button
                    type="text"
                    icon={<TeamOutlined />}
                    onClick={handleCreateTestWithApplications}
                    loading={testWithAppsLoading}
                    style={{ color: '#999', fontSize: '12px' }}
                  >
                    응모완료과제 생성
                  </Button>
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => setCleanupModalOpen(true)}
                    style={{ color: '#ff4d4f', fontSize: '12px' }}
                  >
                    과제 일괄삭제
                  </Button>
                </>
              )}
            </Space>
          )}
        </div>

        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="내 과제"
                value={stats.total}
                prefix={<FolderOpenOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="모집중"
                value={stats.recruiting}
                valueStyle={{ color: '#1890ff' }}
                prefix={<FolderOpenOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="초안"
                value={stats.draft}
                valueStyle={{ color: '#999' }}
                prefix={<EditOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="총 참여자"
                value={stats.totalParticipants}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <div className="mb-6">
            <Title level={2} className="mb-2">과제 관리</Title>
            <Text className="text-gray-600">
              {isSuperAdmin
                ? '모든 과제를 관리할 수 있습니다.'
                : '내가 생성하거나 관리자로 지정된 과제를 관리합니다.'
              }
            </Text>
          </div>

          <div className="mb-4">
            <Space>
              <Text>상태 필터:</Text>
              <Select
                style={{ width: 150 }}
                placeholder="전체"
                allowClear
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: '초안', value: 'draft' },
                  { label: '승인대기', value: 'pending' },
                  { label: '모집대기', value: 'ready' },
                  { label: '모집중', value: 'recruiting' },
                  { label: '심사중', value: 'reviewing' },
                  { label: '완료', value: 'completed' },
                  { label: '종료', value: 'closed' }
                ]}
              />
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={projects}
            rowKey="project_id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`
            }}
            locale={{
              emptyText: '관리중인 과제가 없습니다.'
            }}
          />
        </Card>

        <TestProjectCleanupModal
          open={cleanupModalOpen}
          onClose={() => setCleanupModalOpen(false)}
          onSuccess={loadData}
        />
      </div>
    </div>
  )
}
