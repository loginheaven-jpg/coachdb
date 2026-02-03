import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Table,
  Card,
  Button,
  Tag,
  Space,
  Spin,
  message,
  Statistic,
  Row,
  Col,
  Tooltip,
  Progress,
  Popconfirm,
  Alert
} from 'antd'
import {
  CalculatorOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
  FormOutlined,
  StarOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useProjectEdit } from '../../contexts/ProjectEditContext'
import { useAuthStore } from '../../stores/authStore'
import scoringService, {
  ApplicationWithScores,
  ReviewDashboardStats,
  SelectionResult
} from '../../services/scoringService'
import ReviewerEvaluationModal from '../../components/ReviewerEvaluationModal'
import SelectionModal from '../../components/SelectionModal'
import ApplicantHistoryModal from '../../components/ApplicantHistoryModal'
import dayjs from 'dayjs'

const { Text } = Typography

// Selection result tag
const getSelectionTag = (result: string) => {
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

export default function ProjectSelectionTab() {
  const navigate = useNavigate()
  const { projectId, project } = useProjectEdit()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ReviewDashboardStats | null>(null)
  const [applications, setApplications] = useState<ApplicationWithScores[]>([])
  const [weights, setWeights] = useState({ quantitative: 70, qualitative: 30 })

  // Modal states
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false)
  const [selectionModalOpen, setSelectionModalOpen] = useState(false)
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null)

  // History modal states
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedUserName, setSelectedUserName] = useState<string>('')

  const handleOpenHistory = (userId: number, userName: string) => {
    setSelectedUserId(userId)
    setSelectedUserName(userName)
    setHistoryModalOpen(true)
  }

  // Action loading states
  const [calculatingScores, setCalculatingScores] = useState(false)
  const [finalizingScores, setFinalizingScores] = useState(false)

  // 권한 체크
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN')
  const isProjectManager = project?.project_manager_id === user?.user_id
  const canManageSelection = isSuperAdmin || isProjectManager

  const loadData = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const [statsData, applicationsData, weightsData] = await Promise.all([
        scoringService.getReviewDashboardStats(projectId),
        scoringService.getApplicationsWithScores(projectId),
        scoringService.getProjectWeights(projectId)
      ])
      setStats(statsData)
      setApplications(applicationsData)
      setWeights({
        quantitative: weightsData.quantitative_weight,
        qualitative: weightsData.qualitative_weight
      })
    } catch (error: any) {
      console.error('Failed to load data:', error)
      message.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Calculate auto scores
  const handleCalculateScores = async () => {
    if (!projectId) return

    try {
      setCalculatingScores(true)
      const result = await scoringService.calculateProjectScores(projectId)
      message.success(`${result.calculated_count}건의 점수가 계산되었습니다.`)
      if (result.error_count > 0) {
        message.warning(`${result.error_count}건에서 오류가 발생했습니다.`)
      }
      loadData()
    } catch (error: any) {
      console.error('Score calculation failed:', error)
      message.error(error.response?.data?.detail || '점수 계산에 실패했습니다.')
    } finally {
      setCalculatingScores(false)
    }
  }

  // Finalize scores (apply weights)
  const handleFinalizeScores = async () => {
    if (!projectId) return

    try {
      setFinalizingScores(true)
      const result = await scoringService.finalizeProjectScores(projectId)
      message.success(`${result.finalized_count}건의 최종 점수가 계산되었습니다.`)
      if (result.no_evaluation_count > 0) {
        message.info(`${result.no_evaluation_count}건은 정성평가가 없어 정량점수만 반영됩니다.`)
      }
      loadData()
    } catch (error: any) {
      console.error('Score finalization failed:', error)
      message.error(error.response?.data?.detail || '최종 점수 계산에 실패했습니다.')
    } finally {
      setFinalizingScores(false)
    }
  }

  // Open evaluation modal
  const handleOpenEvaluation = (applicationId: number) => {
    setSelectedApplicationId(applicationId)
    setEvaluationModalOpen(true)
  }

  // Open selection modal
  const handleOpenSelection = () => {
    setSelectionModalOpen(true)
  }

  // Update single selection
  const handleUpdateSelection = async (applicationId: number, result: SelectionResult) => {
    try {
      await scoringService.updateSelectionResult(applicationId, {
        selection_result: result
      })
      message.success('선발 결과가 업데이트되었습니다.')
      loadData()
    } catch (error: any) {
      console.error('Selection update failed:', error)
      message.error(error.response?.data?.detail || '선발 결과 업데이트에 실패했습니다.')
    }
  }

  const columns: ColumnsType<ApplicationWithScores> = [
    {
      title: '순위',
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (rank: number | null) => rank ? (
        <span className={rank <= 3 ? 'font-bold text-kca-primary' : ''}>
          {rank}
        </span>
      ) : '-'
    },
    {
      title: '응모자',
      key: 'applicant',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <a
            onClick={() => handleOpenHistory(record.user_id, record.user_name)}
            className="font-medium"
          >
            {record.user_name}
          </a>
          <Text type="secondary" className="text-xs">{record.user_email}</Text>
        </Space>
      )
    },
    {
      title: '역할',
      dataIndex: 'applied_role',
      key: 'applied_role',
      width: 100,
      render: (role: string | null) => getRoleTag(role)
    },
    {
      title: '정량점수',
      dataIndex: 'auto_score',
      key: 'auto_score',
      width: 100,
      align: 'center',
      render: (score: number | null) => score !== null ? (
        <Text>{score.toFixed(1)}</Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '정성점수',
      key: 'qualitative',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.qualitative_avg !== null ? (
            <>
              <Text>{record.qualitative_avg.toFixed(1)}</Text>
              <Text type="secondary" className="text-xs">
                ({record.evaluation_count}명 평가)
              </Text>
            </>
          ) : (
            <Text type="secondary">미평가</Text>
          )}
        </Space>
      )
    },
    {
      title: '최종점수',
      dataIndex: 'final_score',
      key: 'final_score',
      width: 100,
      align: 'center',
      render: (score: number | null) => score !== null ? (
        <Text strong className="text-kca-primary">{score.toFixed(1)}</Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '선발결과',
      dataIndex: 'selection_result',
      key: 'selection_result',
      width: 100,
      render: (result: string) => getSelectionTag(result)
    },
    {
      title: '제출일',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 120,
      render: (date: string | null) =>
        date ? dayjs(date).format('MM-DD HH:mm') : '-'
    },
    {
      title: '작업',
      key: 'actions',
      width: canManageSelection ? 180 : 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<FormOutlined />}
            onClick={() => handleOpenEvaluation(record.application_id)}
          >
            평가
          </Button>
          {canManageSelection && (
            <>
              <Popconfirm
                title="선발 확인"
                description={`${record.user_name}님을 선발하시겠습니까?`}
                onConfirm={() => handleUpdateSelection(record.application_id, SelectionResult.SELECTED)}
                okText="선발"
                cancelText="취소"
                disabled={record.selection_result === 'selected'}
              >
                <Tooltip title="선발">
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<CheckCircleOutlined />}
                    disabled={record.selection_result === 'selected'}
                  />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title="탈락 확인"
                description={`${record.user_name}님을 탈락 처리하시겠습니까?`}
                onConfirm={() => handleUpdateSelection(record.application_id, SelectionResult.REJECTED)}
                okText="탈락"
                cancelText="취소"
                okButtonProps={{ danger: true }}
                disabled={record.selection_result === 'rejected'}
              >
                <Tooltip title="탈락">
                  <Button
                    size="small"
                    danger
                    ghost
                    icon={<CloseCircleOutlined />}
                    disabled={record.selection_result === 'rejected'}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  const evaluationProgress = stats
    ? Math.round((stats.evaluations_complete / Math.max(stats.total_applications, 1)) * 100)
    : 0

  const selectionProgress = stats
    ? Math.round((stats.selected_count / Math.max(stats.total_applications, 1)) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <Row gutter={16}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="전체 응모"
              value={stats?.total_applications || 0}
              suffix="명"
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="평가 완료"
              value={stats?.evaluations_complete || 0}
              suffix="명"
              prefix={<FormOutlined />}
            />
            <Progress percent={evaluationProgress} size="small" showInfo={false} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="선발 완료"
              value={stats?.selected_count || 0}
              suffix="명"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
            <Progress percent={selectionProgress} size="small" showInfo={false} status="success" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="평균 점수"
              value={stats?.average_final_score?.toFixed(1) || '-'}
              prefix={<StarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 가중치 정보 및 액션 버튼 */}
      <Card size="small">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <Space>
            <Text>배점 비율:</Text>
            <Tag color="blue">정량 {weights.quantitative}%</Tag>
            <Tag color="green">정성 {weights.qualitative}%</Tag>
          </Space>
          <Space wrap>
            <Button
              icon={<CalculatorOutlined />}
              onClick={handleCalculateScores}
              loading={calculatingScores}
            >
              정량점수 계산
            </Button>
            <Button
              icon={<CalculatorOutlined />}
              onClick={handleFinalizeScores}
              loading={finalizingScores}
            >
              최종점수 집계
            </Button>
            {canManageSelection && (
              <Button
                type="primary"
                icon={<TeamOutlined />}
                onClick={handleOpenSelection}
              >
                선발 추천
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
            >
              새로고침
            </Button>
          </Space>
        </div>
      </Card>

      {/* 응모자 테이블 */}
      <Card>
        <Alert
          message="이름을 클릭하시면 응모자와 응모서류를 보실 수 있습니다."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={applications}
          rowKey="application_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`
          }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>

      {/* 평가 모달 */}
      {selectedApplicationId && (
        <ReviewerEvaluationModal
          open={evaluationModalOpen}
          applicationId={selectedApplicationId}
          onClose={() => {
            setEvaluationModalOpen(false)
            setSelectedApplicationId(null)
          }}
          onSuccess={() => {
            setEvaluationModalOpen(false)
            setSelectedApplicationId(null)
            loadData()
          }}
        />
      )}

      {/* 선발 추천 모달 */}
      {projectId && (
        <SelectionModal
          open={selectionModalOpen}
          projectId={projectId}
          maxParticipants={project?.max_participants || 0}
          onClose={() => setSelectionModalOpen(false)}
          onSuccess={() => {
            setSelectionModalOpen(false)
            loadData()
          }}
        />
      )}

      {/* 응모자 이력 모달 */}
      <ApplicantHistoryModal
        open={historyModalOpen}
        userId={selectedUserId}
        userName={selectedUserName}
        onClose={() => {
          setHistoryModalOpen(false)
          setSelectedUserId(null)
        }}
      />
    </div>
  )
}
