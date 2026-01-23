import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography,
  Table,
  Card,
  Button,
  Tag,
  Space,
  Spin,
  message,
  Select,
  Statistic,
  Row,
  Col
} from 'antd'
import {
  ArrowLeftOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import projectService, {
  ProjectDetail,
  ProjectApplicationListItem
} from '../services/projectService'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// 상태별 태그 색상
const getStatusTag = (status: string) => {
  switch (status) {
    case 'draft':
      return <Tag color="default">임시저장</Tag>
    case 'submitted':
      return <Tag color="blue">제출완료</Tag>
    case 'reviewing':
      return <Tag color="orange">심사중</Tag>
    case 'completed':
      return <Tag color="green">심사완료</Tag>
    default:
      return <Tag>{status}</Tag>
  }
}

// 선발 결과 태그
const getSelectionTag = (result: string) => {
  switch (result) {
    case 'pending':
      return <Tag icon={<ClockCircleOutlined />} color="default">대기</Tag>
    case 'selected':
      return <Tag icon={<CheckCircleOutlined />} color="success">선발</Tag>
    case 'rejected':
      return <Tag icon={<ExclamationCircleOutlined />} color="error">탈락</Tag>
    default:
      return <Tag>{result}</Tag>
  }
}

// 서류 검토 상태 태그
const getDocVerificationTag = (status: string, supplementCount: number) => {
  switch (status) {
    case 'pending':
      return <Tag color="default">미검토</Tag>
    case 'partial':
      return <Tag color="processing">부분승인</Tag>
    case 'approved':
      return <Tag color="success">승인완료</Tag>
    case 'rejected':
      return <Tag color="error">거절</Tag>
    case 'supplement_requested':
      return <Tag color="warning">보충요청 ({supplementCount}건)</Tag>
    default:
      return <Tag>{status}</Tag>
  }
}

// 역할 태그
const getRoleTag = (role: string | null) => {
  if (!role) return '-'
  switch (role) {
    case 'leader':
      return <Tag color="purple">리더코치</Tag>
    case 'participant':
      return <Tag color="cyan">참여코치</Tag>
    case 'supervisor':
      return <Tag color="gold">수퍼바이저</Tag>
    default:
      return <Tag>{role}</Tag>
  }
}

export default function ProjectApplicationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [applications, setApplications] = useState<ProjectApplicationListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  useEffect(() => {
    loadData()
  }, [projectId, statusFilter])

  const loadData = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const [projectData, applicationsData] = await Promise.all([
        projectService.getProject(parseInt(projectId)),
        projectService.getProjectApplications(parseInt(projectId), statusFilter)
      ])
      setProject(projectData)
      setApplications(applicationsData)
    } catch (error: any) {
      console.error('데이터 로드 실패:', error)
      message.error(error.response?.data?.detail || '데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 통계 계산
  const stats = {
    total: applications.length,
    submitted: applications.filter(a => a.status === 'submitted').length,
    selected: applications.filter(a => a.selection_result === 'selected').length,
    pending: applications.filter(a => a.selection_result === 'pending').length
  }

  const columns: ColumnsType<ProjectApplicationListItem> = [
    {
      title: '응모자',
      key: 'applicant',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.applicant.name}</Text>
          <Text type="secondary" className="text-xs">{record.applicant.email}</Text>
        </Space>
      )
    },
    {
      title: '연락처',
      dataIndex: ['applicant', 'phone'],
      key: 'phone',
      width: 130,
      render: (phone: string | null) => phone || '-'
    },
    {
      title: '신청역할',
      dataIndex: 'applied_role',
      key: 'applied_role',
      width: 100,
      render: (role: string | null) => getRoleTag(role)
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '증빙검토',
      key: 'doc_status',
      width: 120,
      render: (_, record) => getDocVerificationTag(
        record.document_verification_status,
        record.supplement_count
      )
    },
    {
      title: '점수',
      key: 'score',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const score = record.final_score ?? record.auto_score
        return score !== null ? (
          <Text strong>{score.toFixed(1)}</Text>
        ) : '-'
      }
    },
    {
      title: '선발결과',
      dataIndex: 'selection_result',
      key: 'selection_result',
      width: 100,
      render: (result: string) => getSelectionTag(result)
    },
    {
      title: '제출일시',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 150,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<FileTextOutlined />}
          onClick={() => navigate(`/coach/projects/${projectId}/apply?mode=view&applicationId=${record.application_id}`)}
        >
          상세
        </Button>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/admin/projects/${projectId}`)}
          className="mb-4"
        >
          과제 상세로 돌아가기
        </Button>

        <Title level={2} className="mb-2">
          <UserOutlined className="mr-2" />
          응모자 목록
        </Title>
        <Text type="secondary" className="text-lg">
          {project?.project_name}
        </Text>
      </div>

      {/* 통계 카드 */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="전체 응모"
              value={stats.total}
              suffix="명"
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="제출 완료"
              value={stats.submitted}
              suffix="명"
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="선발 대기"
              value={stats.pending}
              suffix="명"
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="선발 완료"
              value={stats.selected}
              suffix="명"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 필터 및 테이블 */}
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <Space>
            <Text>상태 필터:</Text>
            <Select
              style={{ width: 150 }}
              placeholder="전체"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'draft', label: '임시저장' },
                { value: 'submitted', label: '제출완료' },
                { value: 'reviewing', label: '심사중' },
                { value: 'completed', label: '심사완료' }
              ]}
            />
          </Space>
          <Button onClick={loadData}>
            새로고침
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={applications}
          rowKey="application_id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}명`
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: '아직 응모자가 없습니다.'
          }}
        />
      </Card>
    </div>
  )
}
