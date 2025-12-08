import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Table,
  Tag,
  message,
  Space
} from 'antd'
import {
  ArrowLeftOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import authService from '../services/authService'
import applicationService, { ParticipationProject } from '../services/applicationService'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function MyApplicationsPage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [applications, setApplications] = useState<ParticipationProject[]>([])

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    setLoading(true)
    try {
      const data = await applicationService.getMyApplications()
      setApplications(data)
    } catch (error: any) {
      console.error('참여과제 데이터 로드 실패:', error)
      if (error.response?.status === 401) {
        message.error('인증이 만료되었습니다. 잠시 후 로그인 페이지로 이동합니다.')
      } else {
        message.error('데이터를 불러오는데 실패했습니다. ' + (error.response?.data?.detail || error.message))
      }
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    authService.logout()
    logout()
    message.success('로그아웃되었습니다.')
    navigate('/login')
  }

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '작성중' },
      submitted: { color: 'blue', text: '제출완료' },
      reviewing: { color: 'orange', text: '심사중' },
      completed: { color: 'green', text: '완료' }
    }
    const config = statusMap[status] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const getVerificationStatusTag = (status: string, supplementCount?: number) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '검토중' },
      approved: { color: 'green', icon: <CheckCircleOutlined />, text: '승인' },
      rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '반려' },
      partial: { color: 'blue', icon: <ClockCircleOutlined />, text: '부분승인' },
      supplement_requested: {
        color: 'red',
        icon: <ExclamationCircleOutlined />,
        text: supplementCount ? `보충필요 (${supplementCount}건)` : '보충필요'
      },
      supplemented: { color: 'cyan', icon: <ClockCircleOutlined />, text: '보충제출' }
    }
    const config = statusMap[status] || statusMap.pending
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  const getSelectionResultTag = (result: string) => {
    const resultMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '대기' },
      selected: { color: 'green', icon: <CheckCircleOutlined />, text: '선발' },
      rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '미선발' }
    }
    const config = resultMap[result] || resultMap.pending
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  // 수정 가능 여부 확인: 제출 완료 상태 + 모집기간 내
  const canEditApplication = (record: ParticipationProject): boolean => {
    if (record.application_status !== 'submitted') return false
    const now = dayjs()
    const endDate = dayjs(record.recruitment_end_date).endOf('day')
    return now.isBefore(endDate) || now.isSame(endDate, 'day')
  }

  const handleEditApplication = (record: ParticipationProject) => {
    navigate(`/coach/projects/${record.project_id}/apply?applicationId=${record.application_id}`)
  }

  const columns = [
    {
      title: '기간',
      key: 'period',
      render: (_: any, record: ParticipationProject) => (
        <div>
          <div>{dayjs(record.recruitment_start_date).format('YYYY-MM-DD')}</div>
          <div className="text-xs text-gray-500">~</div>
          <div>{dayjs(record.recruitment_end_date).format('YYYY-MM-DD')}</div>
        </div>
      ),
    },
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: '참여 상태',
      dataIndex: 'application_status',
      key: 'application_status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '서류 검증',
      dataIndex: 'document_verification_status',
      key: 'document_verification_status',
      render: (_: string, record: ParticipationProject) =>
        getVerificationStatusTag(record.document_verification_status, record.supplement_count),
    },
    {
      title: '심사 점수',
      dataIndex: 'review_score',
      key: 'review_score',
      render: (score: number | null) => score !== null ? `${score}점` : '-',
    },
    {
      title: '최종 선발',
      dataIndex: 'selection_result',
      key: 'selection_result',
      render: (result: string) => getSelectionResultTag(result),
    },
    {
      title: '제출일',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '액션',
      key: 'action',
      render: (_: any, record: ParticipationProject) => {
        const editable = canEditApplication(record)
        const hasSupplementRequest = record.has_supplement_request

        return (
          <Space>
            {hasSupplementRequest && (
              <Button
                type="primary"
                danger
                icon={<ExclamationCircleOutlined />}
                onClick={() => handleEditApplication(record)}
              >
                보충제출
              </Button>
            )}
            {editable && !hasSupplementRequest && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEditApplication(record)}
              >
                수정
              </Button>
            )}
          </Space>
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
            <Title level={2} className="mb-2">참여 과제 리스트</Title>
            <Text className="text-gray-600">
              참여한 과제의 진행 상황을 확인할 수 있습니다.
            </Text>
          </div>

          <Table
            columns={columns}
            dataSource={applications}
            rowKey="application_id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`
            }}
            locale={{
              emptyText: '참여한 과제가 없습니다.'
            }}
          />
        </Card>
      </div>
    </div>
  )
}
