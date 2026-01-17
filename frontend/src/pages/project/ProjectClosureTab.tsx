import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Typography,
  Input,
  Alert,
  Modal,
  Form,
  Radio,
  Tag,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Empty
} from 'antd'
import {
  CheckCircleOutlined,
  EditOutlined,
  LockOutlined,
  FormOutlined,
  UserOutlined,
  TrophyOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useProjectEdit } from '../../contexts/ProjectEditContext'
import { useAuthStore } from '../../stores/authStore'
import projectService, {
  CoachEvaluation,
  CoachEvaluationCreate,
  CoachEvaluationUpdate,
  ProjectApplicationListItem,
  ProjectStatus
} from '../../services/projectService'

const { Text, Title } = Typography
const { TextArea } = Input

// Participant with evaluation info
interface ParticipantWithEvaluation extends ProjectApplicationListItem {
  evaluation?: CoachEvaluation | null
}

// Score label mapping
const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  4: { label: '매우 우수', color: 'green' },
  3: { label: '우수', color: 'blue' },
  2: { label: '보통', color: 'orange' },
  1: { label: '미흡', color: 'red' }
}

export default function ProjectClosureTab() {
  const { projectId, project, loadProject } = useProjectEdit()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<ParticipantWithEvaluation[]>([])
  const [overallFeedback, setOverallFeedback] = useState('')
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [closingProject, setClosingProject] = useState(false)

  // Evaluation modal state
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithEvaluation | null>(null)
  const [evaluationForm] = Form.useForm()
  const [savingEvaluation, setSavingEvaluation] = useState(false)

  // Permission check
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN')
  const isProjectManager = project?.project_manager_id === user?.user_id
  const canManageClosure = isSuperAdmin || isProjectManager

  // Check if project can be closed
  const canCloseProject = project?.status === ProjectStatus.EVALUATING ||
                          project?.status === ProjectStatus.IN_PROGRESS

  // Load participants and evaluations
  const loadData = useCallback(async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const [applications, evaluations] = await Promise.all([
        projectService.getProjectApplications(projectId),
        projectService.getProjectEvaluations(projectId)
      ])

      // Filter only selected participants
      const selectedApps = applications.filter(
        app => app.selection_result === 'selected'
      )

      // Merge evaluation data
      const participantsWithEval: ParticipantWithEvaluation[] = selectedApps.map(app => ({
        ...app,
        evaluation: evaluations.find(ev => ev.coach_user_id === app.user_id) || null
      }))

      setParticipants(participantsWithEval)

      // Set overall feedback from project
      if (project?.overall_feedback) {
        setOverallFeedback(project.overall_feedback)
      }
    } catch (error: any) {
      console.error('Failed to load data:', error)
      message.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [projectId, project?.overall_feedback])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Save overall feedback
  const handleSaveFeedback = async () => {
    if (!projectId) return

    try {
      setSavingFeedback(true)
      await projectService.updateProject(projectId, {
        overall_feedback: overallFeedback
      })
      message.success('과제 총평이 저장되었습니다.')
      loadProject()
    } catch (error: any) {
      console.error('Failed to save feedback:', error)
      message.error(error.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setSavingFeedback(false)
    }
  }

  // Open evaluation modal
  const handleOpenEvaluation = (participant: ParticipantWithEvaluation) => {
    setSelectedParticipant(participant)
    if (participant.evaluation) {
      evaluationForm.setFieldsValue({
        participation_score: participant.evaluation.participation_score,
        feedback_text: participant.evaluation.feedback_text,
        special_notes: participant.evaluation.special_notes
      })
    } else {
      evaluationForm.resetFields()
      evaluationForm.setFieldsValue({ participation_score: 3 })
    }
    setEvaluationModalOpen(true)
  }

  // Save evaluation
  const handleSaveEvaluation = async (values: any) => {
    if (!projectId || !selectedParticipant) return

    try {
      setSavingEvaluation(true)

      if (selectedParticipant.evaluation) {
        // Update existing evaluation
        const updateData: CoachEvaluationUpdate = {
          participation_score: values.participation_score,
          feedback_text: values.feedback_text || null,
          special_notes: values.special_notes || null
        }
        await projectService.updateCoachEvaluation(
          selectedParticipant.evaluation.evaluation_id,
          updateData
        )
        message.success('평가가 수정되었습니다.')
      } else {
        // Create new evaluation
        const createData: CoachEvaluationCreate = {
          project_id: projectId,
          coach_user_id: selectedParticipant.user_id,
          participation_score: values.participation_score,
          feedback_text: values.feedback_text || null,
          special_notes: values.special_notes || null
        }
        await projectService.createCoachEvaluation(projectId, createData)
        message.success('평가가 등록되었습니다.')
      }

      setEvaluationModalOpen(false)
      setSelectedParticipant(null)
      loadData()
    } catch (error: any) {
      console.error('Failed to save evaluation:', error)
      message.error(error.response?.data?.detail || '평가 저장에 실패했습니다.')
    } finally {
      setSavingEvaluation(false)
    }
  }

  // Close project
  const handleCloseProject = async () => {
    if (!projectId) return

    try {
      setClosingProject(true)
      await projectService.updateProject(projectId, {
        status: ProjectStatus.CLOSED
      })
      message.success('과제가 종료되었습니다.')
      loadProject()
    } catch (error: any) {
      console.error('Failed to close project:', error)
      message.error(error.response?.data?.detail || '과제 종료에 실패했습니다.')
    } finally {
      setClosingProject(false)
    }
  }

  // Statistics
  const stats = {
    total: participants.length,
    evaluated: participants.filter(p => p.evaluation).length,
    avgScore: participants.filter(p => p.evaluation).length > 0
      ? participants.filter(p => p.evaluation).reduce((sum, p) => sum + (p.evaluation?.participation_score || 0), 0) /
        participants.filter(p => p.evaluation).length
      : 0
  }

  const columns = [
    {
      title: '참여자',
      key: 'participant',
      width: 200,
      render: (_: any, record: ParticipantWithEvaluation) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.applicant.name}</Text>
          <Text type="secondary" className="text-xs">{record.applicant.email}</Text>
        </Space>
      )
    },
    {
      title: '역할',
      dataIndex: 'applied_role',
      key: 'applied_role',
      width: 100,
      render: (role: string | null) => {
        if (!role) return '-'
        const roleLabels: Record<string, { color: string; label: string }> = {
          leader: { color: 'purple', label: '리더코치' },
          participant: { color: 'cyan', label: '참여코치' },
          supervisor: { color: 'gold', label: '수퍼바이저' }
        }
        const info = roleLabels[role]
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{role}</Tag>
      }
    },
    {
      title: '최종점수',
      dataIndex: 'final_score',
      key: 'final_score',
      width: 100,
      align: 'center' as const,
      render: (score: number | null) => score !== null
        ? <Text strong>{score.toFixed(1)}</Text>
        : '-'
    },
    {
      title: '평가상태',
      key: 'evaluation_status',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: ParticipantWithEvaluation) =>
        record.evaluation
          ? <Tag color="success" icon={<CheckCircleOutlined />}>완료</Tag>
          : <Tag color="default">미평가</Tag>
    },
    {
      title: '참여점수',
      key: 'participation_score',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: ParticipantWithEvaluation) => {
        if (!record.evaluation) return '-'
        const score = record.evaluation.participation_score
        const info = SCORE_LABELS[score]
        return info
          ? <Tag color={info.color}>{score}점 ({info.label})</Tag>
          : <Tag>{score}점</Tag>
      }
    },
    {
      title: '피드백',
      key: 'feedback',
      ellipsis: true,
      render: (_: any, record: ParticipantWithEvaluation) =>
        record.evaluation?.feedback_text || '-'
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: ParticipantWithEvaluation) => (
        <Button
          size="small"
          icon={record.evaluation ? <EditOutlined /> : <FormOutlined />}
          onClick={() => handleOpenEvaluation(record)}
          disabled={!canManageClosure}
        >
          {record.evaluation ? '수정' : '평가'}
        </Button>
      )
    }
  ]

  // If project is already closed
  if (project?.status === ProjectStatus.CLOSED) {
    return (
      <div className="space-y-6">
        <Alert
          type="success"
          icon={<LockOutlined />}
          message="과제가 종료되었습니다"
          description="이 과제는 종료 처리되어 더 이상 수정할 수 없습니다."
          showIcon
        />

        {/* Summary info */}
        <Card title="과제 결과 요약">
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="참여 인원"
                value={stats.total}
                suffix="명"
                prefix={<UserOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="평가 완료"
                value={stats.evaluated}
                suffix={`/ ${stats.total}명`}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="평균 참여점수"
                value={stats.avgScore.toFixed(1)}
                suffix="점"
                prefix={<TrophyOutlined />}
              />
            </Col>
          </Row>
        </Card>

        {/* Overall feedback (read-only) */}
        {project?.overall_feedback && (
          <Card title="과제 총평">
            <Text>{project.overall_feedback}</Text>
          </Card>
        )}

        {/* Participants table (read-only) */}
        <Card title="참여자 평가 결과">
          <Table
            columns={columns.filter(c => c.key !== 'actions')}
            dataSource={participants}
            rowKey="application_id"
            loading={loading}
            pagination={false}
            size="small"
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Warning if no participants */}
      {!loading && participants.length === 0 && (
        <Alert
          type="warning"
          message="선발된 참여자가 없습니다"
          description="과제를 종료하려면 먼저 '선발심사' 탭에서 참여자를 선발해주세요."
          showIcon
        />
      )}

      {/* Statistics */}
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="선발 인원"
              value={stats.total}
              suffix="명"
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="평가 완료"
              value={stats.evaluated}
              suffix={`/ ${stats.total}명`}
              valueStyle={{ color: stats.evaluated === stats.total && stats.total > 0 ? '#52c41a' : undefined }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="평균 참여점수"
              value={stats.avgScore > 0 ? stats.avgScore.toFixed(1) : '-'}
              suffix={stats.avgScore > 0 ? '점' : ''}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Overall feedback input */}
      <Card title="과제 총평">
        <div className="space-y-4">
          <TextArea
            value={overallFeedback}
            onChange={(e) => setOverallFeedback(e.target.value)}
            rows={5}
            placeholder="과제 전체에 대한 총평을 입력해주세요. (과제 진행 과정, 성과, 개선점 등)"
            disabled={!canManageClosure}
          />
          <div className="flex justify-end">
            <Button
              type="primary"
              onClick={handleSaveFeedback}
              loading={savingFeedback}
              disabled={!canManageClosure}
            >
              총평 저장
            </Button>
          </div>
        </div>
      </Card>

      {/* Participants evaluation table */}
      <Card title="참여자별 평가">
        {participants.length > 0 ? (
          <Table
            columns={columns}
            dataSource={participants}
            rowKey="application_id"
            loading={loading}
            pagination={false}
            scroll={{ x: 1000 }}
            size="small"
          />
        ) : (
          <Empty
            description="선발된 참여자가 없습니다"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* Close project section */}
      {canManageClosure && (
        <Card title="과제 종료">
          <Alert
            type="info"
            icon={<ExclamationCircleOutlined />}
            message="과제 종료 안내"
            description={
              <ul className="list-disc pl-4 mt-2">
                <li>과제를 종료하면 더 이상 수정할 수 없습니다.</li>
                <li>모든 참여자 평가를 완료한 후 종료하시기 바랍니다.</li>
                <li>과제 총평을 작성해주시면 향후 과제 관리에 도움이 됩니다.</li>
              </ul>
            }
            showIcon
            className="mb-4"
          />

          <div className="flex justify-end">
            <Popconfirm
              title="과제 종료"
              description="과제를 종료하시겠습니까? 종료 후에는 수정이 불가합니다."
              onConfirm={handleCloseProject}
              okText="종료"
              cancelText="취소"
              okButtonProps={{ danger: true }}
              disabled={!canCloseProject}
            >
              <Button
                type="primary"
                danger
                icon={<LockOutlined />}
                loading={closingProject}
                disabled={!canCloseProject}
              >
                과제 종료
              </Button>
            </Popconfirm>
          </div>
        </Card>
      )}

      {/* Evaluation Modal */}
      <Modal
        title={selectedParticipant?.evaluation ? '평가 수정' : '참여자 평가'}
        open={evaluationModalOpen}
        onCancel={() => {
          setEvaluationModalOpen(false)
          setSelectedParticipant(null)
        }}
        footer={null}
        width={600}
      >
        {selectedParticipant && (
          <>
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <Text strong>{selectedParticipant.applicant.name}</Text>
              <Text type="secondary" className="ml-2">
                ({selectedParticipant.applicant.email})
              </Text>
            </div>

            <Alert
              type="info"
              message="평가 기준"
              description={
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><Tag color="green">4점</Tag> 매우 우수</div>
                  <div><Tag color="blue">3점</Tag> 우수</div>
                  <div><Tag color="orange">2점</Tag> 보통</div>
                  <div><Tag color="red">1점</Tag> 미흡</div>
                </div>
              }
              className="mb-4"
            />

            <Form
              form={evaluationForm}
              layout="vertical"
              onFinish={handleSaveEvaluation}
            >
              <Form.Item
                name="participation_score"
                label="참여 점수"
                rules={[{ required: true, message: '참여 점수를 선택해주세요.' }]}
              >
                <Radio.Group>
                  <Space direction="vertical">
                    <Radio value={4}>4점 - 매우 우수</Radio>
                    <Radio value={3}>3점 - 우수</Radio>
                    <Radio value={2}>2점 - 보통</Radio>
                    <Radio value={1}>1점 - 미흡</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="feedback_text"
                label="피드백"
                rules={[{ required: true, message: '피드백을 입력해주세요.' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="참여자의 기여도, 태도, 개선점 등을 작성해주세요."
                />
              </Form.Item>

              <Form.Item
                name="special_notes"
                label="특이사항 (선택)"
              >
                <TextArea
                  rows={3}
                  placeholder="추가로 기록할 내용이 있으면 입력해주세요."
                />
              </Form.Item>

              <div className="flex justify-end gap-2">
                <Button onClick={() => setEvaluationModalOpen(false)}>
                  취소
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={savingEvaluation}
                >
                  {selectedParticipant.evaluation ? '수정' : '저장'}
                </Button>
              </div>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}
