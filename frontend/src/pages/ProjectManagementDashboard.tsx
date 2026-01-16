import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Table,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Modal,
  Input,
  message,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SendOutlined,
  UndoOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import projectService, { ProjectListItem, ProjectStatus } from '../services/projectService'

const { Title, Text } = Typography
const { TextArea } = Input

// 상태별 태그 색상
const getStatusTag = (status: string, displayStatus?: string) => {
  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '초안' },
    pending: { color: 'orange', text: '승인대기' },
    rejected: { color: 'red', text: '반려됨' },
    ready: { color: 'blue', text: '승인됨' },
    recruiting: { color: 'green', text: '모집중' },
    reviewing: { color: 'purple', text: '심사중' },
    in_progress: { color: 'cyan', text: '진행중' },
    closed: { color: 'default', text: '종료' },
  }

  // display_status가 recruiting이면 모집중으로 표시
  if (displayStatus === 'recruiting') {
    return <Tag color="green">모집중</Tag>
  }

  const info = statusMap[status] || { color: 'default', text: status }
  return <Tag color={info.color}>{info.text}</Tag>
}

export default function ProjectManagementDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // 사용자 역할 확인
  const getUserRoles = (): string[] => {
    try {
      return JSON.parse(user?.roles || '[]')
    } catch {
      return []
    }
  }
  const userRoles = getUserRoles()
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN')

  // 정렬 함수: 승인대기(pending) > 반려됨(rejected) > 나머지 (관리자 액션 필요한 항목 우선)
  const sortByPriority = (projects: ProjectListItem[]) => {
    const statusPriority: Record<string, number> = {
      pending: 0,      // 최우선: 승인 필요
      rejected: 1,     // 두 번째: 재상신 대기
      draft: 2,
      ready: 3,
      recruiting: 4,
      reviewing: 5,
      in_progress: 6,
      closed: 7
    }

    return [...projects].sort((a, b) => {
      const priorityA = statusPriority[a.status] ?? 99
      const priorityB = statusPriority[b.status] ?? 99

      // 우선순위가 같으면 최근 생성순
      if (priorityA === priorityB) {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
      return priorityA - priorityB
    })
  }

  // 과제 목록 조회
  const fetchProjects = async () => {
    setLoading(true)
    try {
      const data = await projectService.listProjects()
      // SUPER_ADMIN은 모든 과제, 그 외는 본인 과제만 필터링
      // 승인대기 과제가 상단에 표시되도록 정렬
      if (isSuperAdmin) {
        setProjects(sortByPriority(data))
      } else {
        // 본인이 생성한 과제만 표시
        const myProjects = data.filter(p => p.created_by === user?.user_id)
        setProjects(sortByPriority(myProjects))
      }
    } catch (error) {
      console.error('과제 목록 조회 실패:', error)
      message.error('과제 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // 통계 계산
  const stats = {
    total: projects.length,
    draft: projects.filter(p => p.status === 'draft').length,
    pending: projects.filter(p => p.status === 'pending').length,
    rejected: projects.filter(p => p.status === 'rejected').length,
    ready: projects.filter(p => p.status === 'ready').length,
  }

  // 과제 승인
  const handleApprove = async (projectId: number) => {
    setActionLoading(true)
    try {
      await projectService.approveProject(projectId)
      message.success('과제가 승인되었습니다.')
      fetchProjects()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '승인에 실패했습니다.')
    } finally {
      setActionLoading(false)
    }
  }

  // 과제 반려 모달 열기
  const openRejectModal = (projectId: number) => {
    setSelectedProjectId(projectId)
    setRejectReason('')
    setRejectModalVisible(true)
  }

  // 과제 반려
  const handleReject = async () => {
    if (!selectedProjectId || !rejectReason.trim()) {
      message.warning('반려 사유를 입력해주세요.')
      return
    }

    setActionLoading(true)
    try {
      await projectService.rejectProject(selectedProjectId, rejectReason)
      message.success('과제가 반려되었습니다.')
      setRejectModalVisible(false)
      fetchProjects()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '반려에 실패했습니다.')
    } finally {
      setActionLoading(false)
    }
  }

  // 과제 재상신
  const handleResubmit = async (projectId: number) => {
    setActionLoading(true)
    try {
      await projectService.resubmitProject(projectId)
      message.success('과제가 재상신되었습니다.')
      fetchProjects()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '재상신에 실패했습니다.')
    } finally {
      setActionLoading(false)
    }
  }

  // 테이블 컬럼
  const columns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (text: string, record: ProjectListItem) => (
        <Button type="link" onClick={() => navigate(`/admin/projects/${record.project_id}`)}>
          {text}
        </Button>
      )
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: ProjectListItem) => getStatusTag(status, record.display_status)
    },
    {
      title: '모집기간',
      key: 'recruitment_period',
      width: 200,
      render: (_: any, record: ProjectListItem) => (
        <Text type="secondary">
          {record.recruitment_start_date} ~ {record.recruitment_end_date}
        </Text>
      )
    },
    {
      title: '응모자',
      dataIndex: 'application_count',
      key: 'application_count',
      width: 80,
      align: 'center' as const,
      render: (count: number) => count || 0
    },
    {
      title: '작업',
      key: 'actions',
      width: 200,
      render: (_: any, record: ProjectListItem) => {
        const isOwner = record.created_by === user?.user_id

        return (
          <Space size="small">
            <Tooltip title="상세보기">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/admin/projects/${record.project_id}`)}
              />
            </Tooltip>

            {/* 본인 과제: 수정 버튼 */}
            {isOwner && record.status === 'draft' && (
              <Tooltip title="수정">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/admin/projects/${record.project_id}/edit`)}
                />
              </Tooltip>
            )}

            {/* 본인 과제: 반려된 과제 재상신 */}
            {isOwner && record.status === 'rejected' && (
              <Tooltip title="재상신">
                <Button
                  size="small"
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => handleResubmit(record.project_id)}
                  loading={actionLoading}
                />
              </Tooltip>
            )}

            {/* SUPER_ADMIN: 승인대기 과제 승인/반려 */}
            {isSuperAdmin && record.status === 'pending' && (
              <>
                <Tooltip title="승인">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleApprove(record.project_id)}
                    loading={actionLoading}
                  />
                </Tooltip>
                <Tooltip title="반려">
                  <Button
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => openRejectModal(record.project_id)}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        )
      }
    }
  ]

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="mb-0">과제관리</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/admin/projects/create')}
        >
          새 과제 만들기
        </Button>
      </div>

      {/* 통계 카드 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="전체 과제"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="승인대기"
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="승인됨"
              value={stats.ready}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="반려됨"
              value={stats.rejected}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 과제 목록 테이블 */}
      <Card>
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
        />
      </Card>

      {/* 반려 모달 */}
      <Modal
        title="과제 반려"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => setRejectModalVisible(false)}
        confirmLoading={actionLoading}
        okText="반려"
        cancelText="취소"
        okButtonProps={{ danger: true }}
      >
        <div className="mb-4">
          <Text>반려 사유를 입력해주세요. 과제 생성자에게 알림이 전송됩니다.</Text>
        </div>
        <TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="반려 사유를 입력해주세요..."
        />
      </Modal>
    </div>
  )
}
