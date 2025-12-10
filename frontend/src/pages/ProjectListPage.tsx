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
  CheckCircleOutlined
} from '@ant-design/icons'
import projectService, { ProjectListItem, ProjectStatus } from '../services/projectService'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function ProjectListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [testProjectLoading, setTestProjectLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | undefined>()

  useEffect(() => {
    loadProjects()
  }, [statusFilter])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await projectService.listProjects({ status: statusFilter })
      setProjects(data)
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
      loadProjects()
    } catch (error: any) {
      console.error('테스트 과제 생성 실패:', error)
      message.error('테스트 과제 생성에 실패했습니다.')
    } finally {
      setTestProjectLoading(false)
    }
  }

  const getStatusTag = (status: ProjectStatus) => {
    const statusMap: Record<ProjectStatus, { color: string; text: string }> = {
      draft: { color: 'default', text: '초안' },
      recruiting: { color: 'blue', text: '모집중' },
      reviewing: { color: 'orange', text: '심사중' },
      completed: { color: 'green', text: '완료' },
      closed: { color: 'red', text: '종료' }
    }
    const config = statusMap[status]
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const columns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      width: '25%',
      render: (text: string, record: ProjectListItem) => (
        <a onClick={() => navigate(`/admin/projects/${record.project_id}`)}>
          {text}
        </a>
      ),
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
      render: (_: any, record: ProjectListItem) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/projects/${record.project_id}`)}
          >
            상세
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/projects/${record.project_id}/edit`)}
          >
            수정
          </Button>
        </Space>
      ),
    },
  ]

  // 통계 계산
  const stats = {
    total: projects.length,
    recruiting: projects.filter(p => p.status === 'recruiting').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalParticipants: projects.reduce((sum, p) => sum + (p.current_participants || 0), 0)
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/dashboard')}
          >
            대시보드로 돌아가기
          </Button>
          <Space direction="vertical" align="end">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/projects/create')}
              size="large"
            >
              새 과제 생성
            </Button>
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={handleCreateTestProject}
              loading={testProjectLoading}
              style={{ color: '#999', fontSize: '12px' }}
            >
              테스트과제 생성
            </Button>
          </Space>
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
                title="완료"
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
            <Title level={2} className="mb-2">과제 관리</Title>
            <Text className="text-gray-600">
              코칭 과제를 생성하고 관리할 수 있습니다.
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
