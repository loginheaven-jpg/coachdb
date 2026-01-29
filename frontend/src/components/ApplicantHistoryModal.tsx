import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Divider,
  Tooltip,
  Button,
  Tabs
} from 'antd'
import {
  UserOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  StarOutlined,
  QuestionCircleOutlined,
  FileTextOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import projectService, {
  UserProjectHistory,
  UserProjectHistoryItem
} from '../services/projectService'
import adminService, { UserFullProfile } from '../services/adminService'
import dayjs from 'dayjs'

const { Text, Title } = Typography

interface ApplicantHistoryModalProps {
  open: boolean
  userId: number | null
  userName?: string
  onClose: () => void
}

// Score labels (1-3점)
const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  3: { label: '우수', color: 'green' },
  2: { label: '보통', color: 'blue' },
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
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<UserProjectHistory | null>(null)
  const [userProfile, setUserProfile] = useState<UserFullProfile | null>(null)
  const [activeTab, setActiveTab] = useState('history')

  useEffect(() => {
    if (open && userId) {
      loadData()
      setActiveTab('history')
    }
  }, [open, userId])

  const loadData = async () => {
    if (!userId) return

    try {
      setLoading(true)
      // 병렬로 이력과 프로필 정보 로드
      const [history, profile] = await Promise.all([
        projectService.getUserProjectHistory(userId),
        adminService.getUserFullProfile(userId).catch(() => null) // 프로필 로드 실패해도 계속 진행
      ])
      setData(history)
      setUserProfile(profile)
    } catch (error: any) {
      console.error('Failed to load user history:', error)
      message.error('이력을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 지원서 보기 핸들러
  const handleViewApplication = (record: UserProjectHistoryItem) => {
    if (record.application_id) {
      onClose() // 모달 닫기
      navigate(`/coach/projects/${record.project_id}/apply?mode=view&applicationId=${record.application_id}`)
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
      title: (
        <Tooltip title="해당 과제의 현재 진행 상태">
          상태 <QuestionCircleOutlined className="text-gray-400" />
        </Tooltip>
      ),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: (
        <Tooltip title="응모자의 선발 결과 (대기/선발/탈락)">
          결과 <QuestionCircleOutlined className="text-gray-400" />
        </Tooltip>
      ),
      dataIndex: 'selection_result',
      key: 'selection_result',
      width: 90,
      render: (result: string | null) => getSelectionTag(result)
    },
    {
      title: (
        <Tooltip title="정량점수 + 정성점수를 가중치로 합산한 점수">
          최종점수 <QuestionCircleOutlined className="text-gray-400" />
        </Tooltip>
      ),
      dataIndex: 'final_score',
      key: 'final_score',
      width: 90,
      align: 'center' as const,
      render: (score: number | null) =>
        score !== null ? <Text strong>{score.toFixed(1)}</Text> : '-'
    },
    {
      title: (
        <Tooltip title="과제 종료 후 참여도 평가 (1~3점)">
          참여평가 <QuestionCircleOutlined className="text-gray-400" />
        </Tooltip>
      ),
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
    },
    {
      title: '지원서',
      key: 'application',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: UserProjectHistoryItem) =>
        record.application_id ? (
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleViewApplication(record)}
          >
            보기
          </Button>
        ) : (
          <Text type="secondary">-</Text>
        )
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

  // 역량 카테고리 라벨
  const categoryLabels: Record<string, string> = {
    BASIC: '기본정보',
    CERTIFICATION: '자격증',
    EDUCATION: '교육',
    EXPERIENCE: '경력',
    COACHING: '코칭경력',
    OTHER: '기타'
  }

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          <span>{userName || data?.user_name || '응모자'} 정보</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={950}
      destroyOnClose
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : !data ? (
        <Empty description="정보가 없습니다" />
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'history',
              label: (
                <span>
                  <TrophyOutlined />
                  과제 이력
                </span>
              ),
              children: (
                <div className="space-y-6">
                  {/* 통계 */}
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
                      scroll={{ x: 850, y: 350 }}
                    />
                  ) : (
                    <Empty description="과제 참여 이력이 없습니다" />
                  )}
                </div>
              )
            },
            {
              key: 'profile',
              label: (
                <span>
                  <ProfileOutlined />
                  기본정보
                </span>
              ),
              children: userProfile ? (
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="이름">{userProfile.name}</Descriptions.Item>
                  <Descriptions.Item label="이메일">{userProfile.email}</Descriptions.Item>
                  <Descriptions.Item label="전화번호">{userProfile.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="생년">{userProfile.birth_year || '-'}</Descriptions.Item>
                  <Descriptions.Item label="성별">
                    {userProfile.gender === 'male' ? '남성' : userProfile.gender === 'female' ? '여성' : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="주소" span={2}>{userProfile.address || '-'}</Descriptions.Item>
                  <Descriptions.Item label="가입일">
                    {userProfile.created_at ? dayjs(userProfile.created_at).format('YYYY-MM-DD') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="역량 현황">
                    {userProfile.verified_count}/{userProfile.competency_count} 검증완료
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty description="기본정보를 불러올 수 없습니다" />
              )
            },
            {
              key: 'competencies',
              label: (
                <span>
                  <SafetyCertificateOutlined />
                  역량정보 {userProfile && `(${userProfile.competency_count})`}
                </span>
              ),
              children: userProfile?.competencies && userProfile.competencies.length > 0 ? (
                <Table
                  dataSource={userProfile.competencies}
                  rowKey="competency_id"
                  size="small"
                  pagination={false}
                  scroll={{ y: 400 }}
                  columns={[
                    {
                      title: '항목명',
                      dataIndex: 'item_name',
                      key: 'item_name',
                      width: 200
                    },
                    {
                      title: '카테고리',
                      dataIndex: 'category',
                      key: 'category',
                      width: 100,
                      render: (cat: string) => categoryLabels[cat] || cat
                    },
                    {
                      title: '값',
                      dataIndex: 'value',
                      key: 'value',
                      ellipsis: true
                    },
                    {
                      title: '상태',
                      dataIndex: 'verification_status',
                      key: 'verification_status',
                      width: 100,
                      render: (status: string) => {
                        const statusMap: Record<string, { color: string; text: string }> = {
                          verified: { color: 'success', text: '검증완료' },
                          pending: { color: 'default', text: '대기중' },
                          rejected: { color: 'error', text: '반려' }
                        }
                        const config = statusMap[status] || { color: 'default', text: status }
                        return <Tag color={config.color}>{config.text}</Tag>
                      }
                    }
                  ]}
                />
              ) : (
                <Empty description="등록된 역량이 없습니다" />
              )
            }
          ]}
        />
      )}
    </Modal>
  )
}
