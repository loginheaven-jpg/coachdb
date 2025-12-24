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
  Statistic
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  UserOutlined,
  CheckCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import projectService, { ProjectListItem, ProjectStatus, DisplayStatus } from '../services/projectService'
import applicationService, { ParticipationProject } from '../services/applicationService'
import { useAuthStore } from '../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// 관리자 역할 체크
const isAdminRole = (roles: string[]): boolean => {
  return roles.some(r => ['SUPER_ADMIN', 'PROJECT_MANAGER', 'admin'].includes(r))
}

// 과제 관리 권한 체크 (본인 생성 또는 PM 지정)
const canManageProject = (project: ProjectListItem, userId: number | undefined, roles: string[]): boolean => {
  if (!userId) return false
  if (roles.includes('SUPER_ADMIN') || roles.includes('admin')) return true
  return project.created_by === userId || project.project_manager_id === userId
}

export default function ProjectListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [testProjectLoading, setTestProjectLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [myApplications, setMyApplications] = useState<ParticipationProject[]>([])
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | undefined>()

  // 사용자 역할 파싱
  const userRoles: string[] = (() => {
    try {
      return user?.roles ? JSON.parse(user.roles) : []
    } catch {
      return []
    }
  })()

  // 관리자 여부
  const isAdmin = isAdminRole(userRoles)
  // 수퍼어드민 (loginheaven@gmail.com) 여부 확인
  const isSuperAdmin = user?.email === 'loginheaven@gmail.com' || userRoles.includes('SUPER_ADMIN')

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      // 과제 목록과 내 지원 목록을 병렬로 로드
      const [projectsData, applicationsData] = await Promise.all([
        projectService.listProjects({ status: statusFilter }),
        applicationService.getMyApplications()
      ])
      setProjects(projectsData)
      setMyApplications(applicationsData)
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

  // 특정 과제에 대한 내 지원서 찾기
  const getMyApplication = (projectId: number): ParticipationProject | undefined => {
    return myApplications.find(app => app.project_id === projectId)
  }

  // 지원서 수정 가능 여부: 제출완료 상태 + 모집기간 내
  const canEditApplication = (app: ParticipationProject, record: ProjectListItem): boolean => {
    if (app.application_status !== 'submitted') return false
    const now = dayjs()
    const endDate = dayjs(record.recruitment_end_date).endOf('day')
    return now.isBefore(endDate) || now.isSame(endDate, 'day')
  }

  // display_status를 사용하여 상태 표시
  const getStatusTag = (displayStatus: string | undefined, status: ProjectStatus) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '초안' },
      pending: { color: 'gold', text: '모집대기' },
      ready: { color: 'gold', text: '모집대기' },
      recruiting: { color: 'blue', text: '모집중' },
      recruiting_ended: { color: 'purple', text: '모집종료' },
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

  // 모집중인지 확인 (display_status 기준)
  const isRecruiting = (record: ProjectListItem): boolean => {
    return record.display_status === 'recruiting'
  }

  const columns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      width: '25%',
      render: (text: string, record: ProjectListItem) => {
        const canManage = canManageProject(record, user?.user_id, userRoles)
        const existingApp = getMyApplication(record.project_id)

        // 관리자는 관리 페이지로, 지원한 과제는 지원서 보기로
        if (canManage) {
          return (
            <a onClick={() => navigate(`/admin/projects/${record.project_id}`)}>
              {text}
            </a>
          )
        } else if (existingApp) {
          return (
            <a onClick={() => navigate(`/coach/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=view`)}>
              {text}
            </a>
          )
        }
        return <span>{text}</span>
      },
    },
    {
      title: '모집 기간',
      key: 'recruitment_period',
      width: '18%',
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
      width: '18%',
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
      width: '10%',
      render: (_: ProjectStatus, record: ProjectListItem) => getStatusTag(record.display_status, record.status),
    },
    {
      title: '정원',
      key: 'participants',
      width: '10%',
      render: (_: any, record: ProjectListItem) => {
        const appCount = record.application_count || 0
        const selectedCount = record.current_participants || 0
        // 선발 완료 상태 (IN_PROGRESS, EVALUATING, CLOSED, COMPLETED)
        const selectionComplete = ['in_progress', 'evaluating', 'closed', 'completed'].includes(record.status)

        if (selectionComplete) {
          // 선발 완료: 응모자(선발)/정원
          return <span>{appCount}({selectedCount}) / {record.max_participants}</span>
        }
        // 모집/심사 중: 응모자/정원
        return <span>{appCount} / {record.max_participants}</span>
      },
    },
    {
      title: '작업',
      key: 'actions',
      width: '21%',
      render: (_: any, record: ProjectListItem) => {
        const existingApp = getMyApplication(record.project_id)
        const canManage = canManageProject(record, user?.user_id, userRoles)
        const recruiting = isRecruiting(record)

        return (
          <Space wrap>
            {/* 지원/지원완료 버튼 */}
            {existingApp ? (
              <>
                <Tag
                  color="green"
                  icon={<CheckCircleOutlined />}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/coach/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=view`)}
                >
                  지원완료
                </Tag>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/coach/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=view`)}
                >
                  보기
                </Button>
                {canEditApplication(existingApp, record) && (
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/coach/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=edit`)}
                  >
                    수정
                  </Button>
                )}
              </>
            ) : recruiting ? (
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/coach/projects/${record.project_id}/apply`)}
              >
                지원하기
              </Button>
            ) : null}

            {/* 관리자 버튼들 */}
            {canManage && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/admin/projects/${record.project_id}`)}
                >
                  관리
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/admin/projects/${record.project_id}/edit`)}
                >
                  수정
                </Button>
              </>
            )}
          </Space>
        )
      },
    },
  ]

  // 통계 계산
  const stats = {
    total: projects.length,
    recruiting: projects.filter(p => p.display_status === 'recruiting').length,
    completed: projects.filter(p => p.status === 'completed' || p.status === 'closed').length,
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
          {isAdmin && (
            <Space direction="vertical" align="end">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/admin/projects/create')}
                size="large"
              >
                새 과제 생성
              </Button>
              {isSuperAdmin && (
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={handleCreateTestProject}
                  loading={testProjectLoading}
                  style={{ color: '#999', fontSize: '12px' }}
                >
                  테스트과제 생성
                </Button>
              )}
            </Space>
          )}
        </div>

        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="전체 과제"
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
                title="완료/종료"
                value={stats.completed}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
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
            <Title level={2} className="mb-2">과제 목록</Title>
            <Text className="text-gray-600">
              {isAdmin
                ? '코칭 과제를 생성하고 관리하거나, 모집중인 과제에 지원할 수 있습니다.'
                : '참여를 원하는 과제를 선택하여 지원할 수 있습니다.'
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
              emptyText: '등록된 과제가 없습니다.'
            }}
          />
        </Card>
      </div>
    </div>
  )
}
