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
  Statistic,
  Row,
  Col,
  Modal,
  InputNumber,
  Tooltip,
  Progress,
  Divider,
  Checkbox
} from 'antd'
import {
  ArrowLeftOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  TrophyOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
  FormOutlined,
  SettingOutlined,
  StarOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import projectService, { ProjectDetail } from '../services/projectService'
import scoringService, {
  ApplicationWithScores,
  ReviewDashboardStats,
  SelectionResult
} from '../services/scoringService'
import ReviewerEvaluationModal from '../components/ReviewerEvaluationModal'
import SelectionModal from '../components/SelectionModal'
import dayjs from 'dayjs'

const { Title, Text } = Typography

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

export default function ProjectReviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [stats, setStats] = useState<ReviewDashboardStats | null>(null)
  const [applications, setApplications] = useState<ApplicationWithScores[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [weights, setWeights] = useState({ quantitative: 70, qualitative: 30 })

  // Modal states
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false)
  const [selectionModalOpen, setSelectionModalOpen] = useState(false)
  const [weightsModalOpen, setWeightsModalOpen] = useState(false)
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null)

  // Action loading states
  const [calculatingScores, setCalculatingScores] = useState(false)
  const [finalizingScores, setFinalizingScores] = useState(false)

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const [projectData, statsData, applicationsData, weightsData] = await Promise.all([
        projectService.getProject(parseInt(projectId)),
        scoringService.getReviewDashboardStats(parseInt(projectId)),
        scoringService.getApplicationsWithScores(parseInt(projectId)),
        scoringService.getProjectWeights(parseInt(projectId))
      ])
      setProject(projectData)
      setStats(statsData)
      setApplications(applicationsData)
      setWeights({
        quantitative: weightsData.quantitative_weight,
        qualitative: weightsData.qualitative_weight
      })
    } catch (error: any) {
      console.error('Failed to load data:', error)
      message.error(error.response?.data?.detail || '데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Calculate auto scores
  const handleCalculateScores = async () => {
    if (!projectId) return

    try {
      setCalculatingScores(true)
      const result = await scoringService.calculateProjectScores(parseInt(projectId))
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
      const result = await scoringService.finalizeProjectScores(parseInt(projectId))
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

  // Update weights
  const handleUpdateWeights = async () => {
    if (!projectId) return

    if (weights.quantitative + weights.qualitative !== 100) {
      message.error('정량/정성 가중치 합계는 100이어야 합니다.')
      return
    }

    try {
      await scoringService.updateProjectWeights(parseInt(projectId), {
        quantitative_weight: weights.quantitative,
        qualitative_weight: weights.qualitative
      })
      message.success('가중치가 저장되었습니다.')
      setWeightsModalOpen(false)
    } catch (error: any) {
      console.error('Weight update failed:', error)
      message.error(error.response?.data?.detail || '가중치 저장에 실패했습니다.')
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
        <span className={rank <= 3 ? 'font-bold text-blue-600' : ''}>
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
          <Text strong>{record.user_name}</Text>
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
        <Text strong className="text-blue-600">{score.toFixed(1)}</Text>
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
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="정성평가">
            <Button
              size="small"
              icon={<FormOutlined />}
              onClick={() => handleOpenEvaluation(record.application_id)}
            />
          </Tooltip>
          <Tooltip title="선발">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CheckCircleOutlined />}
              onClick={() => handleUpdateSelection(record.application_id, SelectionResult.SELECTED)}
              disabled={record.selection_result === 'selected'}
            />
          </Tooltip>
          <Tooltip title="탈락">
            <Button
              size="small"
              danger
              ghost
              icon={<CloseCircleOutlined />}
              onClick={() => handleUpdateSelection(record.application_id, SelectionResult.REJECTED)}
              disabled={record.selection_result === 'rejected'}
            />
          </Tooltip>
        </Space>
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

  const evaluationProgress = stats ?
    Math.round((stats.evaluations_complete / stats.total_applications) * 100) || 0 : 0

  const selectionProgress = stats ?
    Math.round(((stats.selected_count + stats.rejected_count) / stats.total_applications) * 100) || 0 : 0

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
          <TrophyOutlined className="mr-2" />
          심사 및 선발
        </Title>
        <Text type="secondary" className="text-lg">
          {project?.project_name}
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="전체 응모"
              value={stats?.total_applications || 0}
              suffix="명"
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="평가 완료"
              value={stats?.evaluations_complete || 0}
              suffix={`/ ${stats?.total_applications || 0}`}
              valueStyle={{ color: '#1890ff' }}
              prefix={<FormOutlined />}
            />
            <Progress percent={evaluationProgress} size="small" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="선발 완료"
              value={stats?.selected_count || 0}
              suffix={`/ ${project?.max_participants || 0}`}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="평균 점수"
              value={stats?.average_final_score || stats?.average_auto_score || '-'}
              precision={1}
              valueStyle={{ color: '#722ed1' }}
              prefix={<StarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Weight Info & Actions */}
      <Card className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <Text>
                <strong>배점 비율:</strong> 정량 {weights.quantitative}% / 정성 {weights.qualitative}%
              </Text>
              <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setWeightsModalOpen(true)}
              >
                가중치 설정
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
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
              <Button
                type="primary"
                icon={<TeamOutlined />}
                onClick={handleOpenSelection}
              >
                선발 추천
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
              >
                새로고침
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Applications Table */}
      <Card title="응모자 목록">
        <Table
          columns={columns}
          dataSource={applications}
          rowKey="application_id"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[])
          }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}명`
          }}
          scroll={{ x: 1300 }}
          locale={{
            emptyText: '아직 응모자가 없습니다.'
          }}
        />
      </Card>

      {/* Weights Modal */}
      <Modal
        title="평가 가중치 설정"
        open={weightsModalOpen}
        onOk={handleUpdateWeights}
        onCancel={() => setWeightsModalOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Text>정량평가 가중치 (%)</Text>
            <InputNumber
              min={0}
              max={100}
              value={weights.quantitative}
              onChange={(v) => setWeights(prev => ({
                ...prev,
                quantitative: v || 0,
                qualitative: 100 - (v || 0)
              }))}
              className="w-full"
            />
          </div>
          <div>
            <Text>정성평가 가중치 (%)</Text>
            <InputNumber
              min={0}
              max={100}
              value={weights.qualitative}
              onChange={(v) => setWeights(prev => ({
                ...prev,
                qualitative: v || 0,
                quantitative: 100 - (v || 0)
              }))}
              className="w-full"
            />
          </div>
          <div>
            <Text type={weights.quantitative + weights.qualitative === 100 ? 'success' : 'danger'}>
              합계: {weights.quantitative + weights.qualitative}%
              {weights.quantitative + weights.qualitative !== 100 && ' (100%가 되어야 합니다)'}
            </Text>
          </div>
        </div>
      </Modal>

      {/* Evaluation Modal */}
      {selectedApplicationId && (
        <ReviewerEvaluationModal
          open={evaluationModalOpen}
          applicationId={selectedApplicationId}
          onClose={() => {
            setEvaluationModalOpen(false)
            setSelectedApplicationId(null)
          }}
          onSuccess={() => {
            loadData()
            setEvaluationModalOpen(false)
            setSelectedApplicationId(null)
          }}
        />
      )}

      {/* Selection Modal */}
      {projectId && (
        <SelectionModal
          open={selectionModalOpen}
          projectId={parseInt(projectId)}
          maxParticipants={project?.max_participants || 0}
          onClose={() => setSelectionModalOpen(false)}
          onSuccess={() => {
            loadData()
            setSelectionModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
