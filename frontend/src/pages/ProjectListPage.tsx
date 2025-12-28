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
  Row,
  Col,
  Statistic
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import projectService, { ProjectListItem, ProjectStatus } from '../services/projectService'
import applicationService, { ParticipationProject } from '../services/applicationService'
import { useAuthStore } from '../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function ProjectListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [myApplications, setMyApplications] = useState<ParticipationProject[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // 과제참여 모드: 모집중인 과제만 조회
      const [projectsData, applicationsData] = await Promise.all([
        projectService.listProjects({ mode: 'participate' }),
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

  const columns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      width: '30%',
      render: (text: string, record: ProjectListItem) => {
        const existingApp = getMyApplication(record.project_id)

        if (existingApp) {
          return (
            <a onClick={() => navigate(`/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=view`)}>
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
        return <span>{appCount} / {record.max_participants}</span>
      },
    },
    {
      title: '작업',
      key: 'actions',
      width: '14%',
      render: (_: any, record: ProjectListItem) => {
        const existingApp = getMyApplication(record.project_id)

        return (
          <Space wrap>
            {existingApp ? (
              <>
                <Tag
                  color="green"
                  icon={<CheckCircleOutlined />}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=view`)}
                >
                  지원완료
                </Tag>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=view`)}
                >
                  보기
                </Button>
                {canEditApplication(existingApp, record) && (
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/projects/${record.project_id}/apply?applicationId=${existingApp.application_id}&mode=edit`)}
                  >
                    수정
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/projects/${record.project_id}/apply`)}
              >
                지원하기
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  // 통계 계산
  const stats = {
    total: projects.length,
    applied: myApplications.filter(app =>
      projects.some(p => p.project_id === app.project_id)
    ).length,
    notApplied: projects.filter(p =>
      !myApplications.some(app => app.project_id === p.project_id)
    ).length
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
        </div>

        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="모집중 과제"
                value={stats.total}
                prefix={<FolderOpenOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="지원 완료"
                value={stats.applied}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="미지원"
                value={stats.notApplied}
                valueStyle={{ color: '#1890ff' }}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <div className="mb-6">
            <Title level={2} className="mb-2">과제 참여</Title>
            <Text className="text-gray-600">
              현재 모집중인 과제 목록입니다. 참여를 원하는 과제를 선택하여 지원하세요.
            </Text>
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
              emptyText: '현재 모집중인 과제가 없습니다.'
            }}
          />
        </Card>
      </div>
    </div>
  )
}
