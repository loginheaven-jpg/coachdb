import { useState, useEffect } from 'react'
import {
  Modal,
  Spin,
  Typography,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Card,
  Space,
  Empty,
  message,
  Descriptions,
  Divider
} from 'antd'
import {
  UserOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  StarOutlined
} from '@ant-design/icons'
import projectService, {
  UserProjectHistory,
  UserProjectHistoryItem
} from '../services/projectService'
import dayjs from 'dayjs'

const { Text, Title } = Typography

interface ApplicantHistoryModalProps {
  open: boolean
  userId: number | null
  userName?: string
  onClose: () => void
}

// Score labels
const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  4: { label: '매우 우수', color: 'green' },
  3: { label: '우수', color: 'blue' },
  2: { label: '보통', color: 'orange' },
  1: { label: '미흡', color: 'red' }
}

// Selection result tag
const getSelectionTag = (result: string | null) => {
  if (!result) return null
  switch (result) {
    case 'pending':
      return <Tag icon={<ClockCircleOutlined />} color="default">대기</Tag>
    case 'selected':
      return <Tag icon={<CheckCircleOutlined />} color="success">선발</Tag>
    case 'rejected':
      return <Tag icon={<CloseCircleOutlined />} color="error">탈락</Tag>
    default:
      return <Tag>{result}</Tag>
  }
}

// Role tag
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

// Status tag
const getStatusTag = (status: string) => {
  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '초안' },
    ready: { color: 'blue', text: '진행중' },
    recruiting: { color: 'blue', text: '모집중' },
    reviewing: { color: 'purple', text: '심사중' },
    in_progress: { color: 'cyan', text: '과제진행' },
    evaluating: { color: 'gold', text: '평가중' },
    closed: { color: 'default', text: '종료' }
  }
  const config = statusMap[status] || { color: 'default', text: status }
  return <Tag color={config.color}>{config.text}</Tag>
}

export default function ApplicantHistoryModal({
  open,
  userId,
  userName,
  onClose
}: ApplicantHistoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<UserProjectHistory | null>(null)

  useEffect(() => {
    if (open && userId) {
      loadData()
    }
  }, [open, userId])

  const loadData = async () => {
    if (!userId) return

    try {
      setLoading(true)
      const history = await projectService.getUserProjectHistory(userId)
      setData(history)
    } catch (error: any) {
      console.error('Failed to load user history:', error)
      message.error('이력을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      ellipsis: true,
      render: (name: string, record: UserProjectHistoryItem) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.project_start_date && record.project_end_date && (
            <Text type="secondary" className="text-xs">
              {dayjs(record.project_start_date).format('YYYY.MM')} ~ {dayjs(record.project_end_date).format('YYYY.MM')}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string | null) => getRoleTag(role)
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '결과',
      dataIndex: 'selection_result',
      key: 'selection_result',
      width: 80,
      render: (result: string | null) => getSelectionTag(result)
    },
    {
      title: '최종점수',
      dataIndex: 'final_score',
      key: 'final_score',
      width: 80,
      align: 'center' as const,
      render: (score: number | null) =>
        score !== null ? <Text strong>{score.toFixed(1)}</Text> : '-'
    },
    {
      title: '참여평가',
      key: 'evaluation',
      width: 100,
      render: (_: any, record: UserProjectHistoryItem) => {
        if (!record.evaluation) return <Text type="secondary">-</Text>
        const score = record.evaluation.participation_score
        const info = SCORE_LABELS[score]
        return (
          <Tag color={info?.color || 'default'}>
            {score}점 ({info?.label || '-'})
          </Tag>
        )
      }
    }
  ]

  // Expanded row for evaluation details
  const expandedRowRender = (record: UserProjectHistoryItem) => {
    if (!record.evaluation) {
      return <Text type="secondary">평가 정보 없음</Text>
    }

    return (
      <div className="p-2 bg-gray-50 rounded">
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="피드백">
            {record.evaluation.feedback_text || '-'}
          </Descriptions.Item>
          {record.evaluation.special_notes && (
            <Descriptions.Item label="특이사항">
              {record.evaluation.special_notes}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="평가일">
            {dayjs(record.evaluation.evaluated_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          <span>{userName || data?.user_name || '응모자'} 이력</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : !data ? (
        <Empty description="이력 정보가 없습니다" />
      ) : (
        <div className="space-y-6">
          {/* 사용자 기본 정보 */}
          <Card size="small">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="총 응모 횟수"
                  value={data.total_projects}
                  suffix="회"
                  prefix={<TrophyOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="선발 횟수"
                  value={data.selected_count}
                  suffix="회"
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="평균 최종점수"
                  value={data.avg_score?.toFixed(1) || '-'}
                  prefix={<StarOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="평균 참여평가"
                  value={data.avg_evaluation_score?.toFixed(1) || '-'}
                  suffix={data.avg_evaluation_score ? '점' : ''}
                  prefix={<StarOutlined />}
                />
              </Col>
            </Row>
          </Card>

          <Divider orientation="left">과제 참여 이력</Divider>

          {/* 과제 이력 테이블 */}
          {data.history.length > 0 ? (
            <Table
              columns={columns}
              dataSource={data.history}
              rowKey="project_id"
              size="small"
              pagination={false}
              expandable={{
                expandedRowRender,
                rowExpandable: (record) => !!record.evaluation
              }}
              scroll={{ y: 400 }}
            />
          ) : (
            <Empty description="과제 참여 이력이 없습니다" />
          )}
        </div>
      )}
    </Modal>
  )
}
