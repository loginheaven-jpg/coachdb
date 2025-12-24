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
  Select
} from 'antd'
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  LogoutOutlined,
  EditOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import authService from '../services/authService'
import projectService, { ProjectListItem, ProjectStatus } from '../services/projectService'
import applicationService, { ParticipationProject } from '../services/applicationService'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function ProjectBrowsePage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [myApplications, setMyApplications] = useState<ParticipationProject[]>([])
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | undefined>(ProjectStatus.RECRUITING)

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
      console.error('데이터 로드 실패:', error)
      message.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
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

  const handleLogout = () => {
    authService.logout()
    logout()
    message.success('로그아웃되었습니다.')
    navigate('/login')
  }

  const getStatusTag = (status: ProjectStatus) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '초안' },
      ready: { color: 'gold', text: '모집대기' },
      recruiting: { color: 'blue', text: '모집중' },
      reviewing: { color: 'orange', text: '심사중' },
      in_progress: { color: 'cyan', text: '과제진행중' },
      evaluating: { color: 'geekblue', text: '과제평가중' },
      completed: { color: 'green', text: '완료' },
      closed: { color: 'red', text: '종료' }
    }
    const config = statusMap[status] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const columns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      width: '30%',
    },
    {
      title: '모집 기간',
      key: 'recruitment_period',
      width: '20%',
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
      width: '20%',
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
      render: (status: ProjectStatus) => getStatusTag(status),
    },
    {
      title: '정원',
      key: 'participants',
      width: '10%',
      render: (_: any, record: ProjectListItem) => (
        <span>{record.current_participants || 0} / {record.max_participants}</span>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: '15%',
      render: (_: any, record: ProjectListItem) => {
        const existingApp = getMyApplication(record.project_id)

        if (existingApp) {
          // 이미 지원한 경우
          const editable = canEditApplication(existingApp, record)
          return (
            <Space>
              <Tag color="green" icon={<CheckCircleOutlined />}>
                지원완료
              </Tag>
              {editable && (
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/coach/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}`)}
                >
                  수정
                </Button>
              )}
            </Space>
          )
        }

        // 신규 지원
        return (
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/coach/projects/${record.project_id}/apply`)}
            disabled={record.status !== 'recruiting'}
          >
            지원하기
          </Button>
        )
      },
    },
  ]

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/coach/dashboard')}
          >
            대시보드로 돌아가기
          </Button>
          <Button
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            size="large"
          >
            로그아웃
          </Button>
        </div>

        <Card>
          <div className="mb-6">
            <Title level={2} className="mb-2">과제 지원</Title>
            <Text className="text-gray-600">
              참여를 원하는 과제를 선택하여 지원할 수 있습니다.
            </Text>
          </div>

          <div className="mb-4">
            <Space>
              <Text>상태 필터:</Text>
              <Select
                style={{ width: 150 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: '전체', value: undefined },
                  { label: '모집중', value: 'recruiting' },
                  { label: '심사중', value: 'reviewing' },
                  { label: '완료', value: 'completed' }
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
              emptyText: '모집중인 과제가 없습니다.'
            }}
          />
        </Card>
      </div>
    </div>
  )
}
