import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Descriptions,
  Tag,
  message,
  Space,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Tabs,
  Dropdown
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  TeamOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownOutlined
} from '@ant-design/icons'
import projectService, {
  ProjectDetail,
  ProjectStatus,
  CustomQuestion,
  CustomQuestionCreate,
  CoachEvaluation,
  ProjectItem,
  CompetencyItem,
  ScoreValidation
} from '../services/projectService'
import SurveyBuilder from '../components/SurveyBuilder'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input
const { TabPane } = Tabs

export default function ProjectDetailPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [questions, setQuestions] = useState<CustomQuestion[]>([])
  const [evaluations, setEvaluations] = useState<CoachEvaluation[]>([])
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([])
  const [competencyItems, setCompetencyItems] = useState<CompetencyItem[]>([])
  const [scoreValidation, setScoreValidation] = useState<ScoreValidation | null>(null)
  const [questionModalVisible, setQuestionModalVisible] = useState(false)
  const [surveyBuilderVisible, setSurveyBuilderVisible] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [questionForm] = Form.useForm()

  useEffect(() => {
    if (projectId) {
      loadProjectDetail()
      loadQuestions()
      loadEvaluations()
      loadProjectItems()
      loadCompetencyItems()
    }
  }, [projectId])

  const loadProjectDetail = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await projectService.getProject(parseInt(projectId))
      setProject(data)
    } catch (error: any) {
      console.error('과제 상세 로드 실패:', error)
      message.error('과제 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestions = async () => {
    if (!projectId) return
    try {
      const data = await projectService.getProjectQuestions(parseInt(projectId))
      setQuestions(data)
    } catch (error: any) {
      console.error('질문 목록 로드 실패:', error)
    }
  }

  const loadEvaluations = async () => {
    if (!projectId) return
    try {
      const data = await projectService.getProjectEvaluations(parseInt(projectId))
      setEvaluations(data)
    } catch (error: any) {
      console.error('평가 목록 로드 실패:', error)
    }
  }

  const loadProjectItems = async () => {
    if (!projectId) return
    try {
      const data = await projectService.getProjectItems(parseInt(projectId))
      setProjectItems(data)
      // Load score validation
      await validateScore()
    } catch (error: any) {
      console.error('설문항목 로드 실패:', error)
    }
  }

  const loadCompetencyItems = async () => {
    try {
      const data = await projectService.getCompetencyItems()
      setCompetencyItems(data)
    } catch (error: any) {
      console.error('역량 항목 로드 실패:', error)
    }
  }

  const validateScore = async () => {
    if (!projectId) return
    try {
      const data = await projectService.validateProjectScore(parseInt(projectId))
      setScoreValidation(data)
    } catch (error: any) {
      console.error('점수 검증 실패:', error)
    }
  }

  const handleCreateQuestion = async (values: any) => {
    if (!projectId) return
    try {
      const questionData: CustomQuestionCreate = {
        project_id: parseInt(projectId),
        question_text: values.question_text,
        question_type: values.question_type,
        is_required: values.is_required,
        display_order: values.display_order,
        options: values.options || null,
        max_score: values.is_evaluation ? values.max_score : null,
        allows_text: true,
        allows_file: false,
        file_required: false
      }
      await projectService.createCustomQuestion(questionData)
      message.success('질문이 추가되었습니다.')
      setQuestionModalVisible(false)
      questionForm.resetFields()
      loadQuestions()
    } catch (error: any) {
      console.error('질문 생성 실패:', error)
      message.error('질문 추가에 실패했습니다.')
    }
  }

  const handleDeleteProjectItem = async (projectItemId: number) => {
    if (!projectId) return
    Modal.confirm({
      title: '설문항목 삭제',
      content: '이 설문항목을 삭제하시겠습니까?',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await projectService.deleteProjectItem(parseInt(projectId), projectItemId)
          message.success('설문항목이 삭제되었습니다.')
          loadProjectItems()
        } catch (error: any) {
          console.error('설문항목 삭제 실패:', error)
          message.error('설문항목 삭제에 실패했습니다.')
        }
      }
    })
  }

  // display_status를 사용하여 상태 표시
  const getStatusConfig = (displayStatus: string | undefined): { color: string; text: string } => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '초안' },
      pending: { color: 'gold', text: '모집대기' },
      ready: { color: 'gold', text: '모집대기' },  // fallback
      recruiting: { color: 'blue', text: '모집중' },
      recruiting_ended: { color: 'purple', text: '모집종료' },
      reviewing: { color: 'orange', text: '심사중' },
      in_progress: { color: 'cyan', text: '과제진행중' },
      evaluating: { color: 'geekblue', text: '과제평가중' },
      completed: { color: 'green', text: '완료' },
      closed: { color: 'default', text: '종료' }
    }
    return statusMap[displayStatus || 'draft'] || { color: 'default', text: displayStatus || 'unknown' }
  }

  const getStatusTag = () => {
    const displayStatus = project?.display_status || project?.status
    const config = getStatusConfig(displayStatus)
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 상태 전환 가능 목록 (draft는 정식저장 버튼으로 처리)
  const getNextStatuses = (currentStatus: ProjectStatus): ProjectStatus[] => {
    const transitions: Record<string, ProjectStatus[]> = {
      draft: [],  // draft는 정식저장 버튼으로 처리
      ready: [ProjectStatus.REVIEWING],  // ready(모집중)에서 심사중으로
      recruiting: [ProjectStatus.REVIEWING],  // legacy 호환
      reviewing: [ProjectStatus.IN_PROGRESS],
      in_progress: [ProjectStatus.EVALUATING],
      evaluating: [ProjectStatus.CLOSED],
      completed: [ProjectStatus.CLOSED],
      closed: []
    }
    return transitions[currentStatus] || []
  }

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!projectId) return
    try {
      await projectService.updateProject(parseInt(projectId), { status: newStatus })
      message.success('상태가 변경되었습니다.')
      loadProjectDetail()
    } catch (error: any) {
      console.error('상태 변경 실패:', error)
      message.error('상태 변경에 실패했습니다.')
    }
  }

  const handleDelete = () => {
    Modal.confirm({
      title: '과제 삭제',
      content: (
        <div>
          <p>정말 이 과제를 삭제하시겠습니까?</p>
          <p className="text-red-500 mt-2">이 작업은 되돌릴 수 없으며, 모든 관련 데이터(지원서, 평가 등)가 함께 삭제됩니다.</p>
        </div>
      ),
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        if (!projectId) return
        setDeleteLoading(true)
        try {
          await projectService.deleteProject(parseInt(projectId))
          message.success('과제가 삭제되었습니다.')
          navigate('/admin/projects')
        } catch (error: any) {
          console.error('과제 삭제 실패:', error)
          message.error(error.response?.data?.detail || '과제 삭제에 실패했습니다.')
        } finally {
          setDeleteLoading(false)
        }
      }
    })
  }

  const questionColumns = [
    {
      title: '순서',
      dataIndex: 'display_order',
      key: 'display_order',
      width: 80,
    },
    {
      title: '질문',
      dataIndex: 'question_text',
      key: 'question_text',
    },
    {
      title: '유형',
      dataIndex: 'question_type',
      key: 'question_type',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          text: '단답형',
          textarea: '장문형',
          select: '선택형',
          file: '파일 첨부'
        }
        return typeMap[type] || type
      }
    },
    {
      title: '필수',
      dataIndex: 'is_required',
      key: 'is_required',
      width: 80,
      render: (required: boolean) => required ? <Tag color="red">필수</Tag> : <Tag>선택</Tag>
    },
  ]

  const evaluationColumns = [
    {
      title: '코치명',
      dataIndex: 'coach_name',
      key: 'coach_name',
      render: (_: any, record: CoachEvaluation) => record.coach?.full_name || record.coach?.username || '-'
    },
    {
      title: '참여 점수',
      dataIndex: 'participation_score',
      key: 'participation_score',
      render: (score: number) => {
        const scoreText = ['', '탈락', '참여 어려움', '만족', '매우 적극적']
        return <Tag color={score >= 3 ? 'green' : score === 2 ? 'orange' : 'red'}>{score}점 - {scoreText[score]}</Tag>
      }
    },
    {
      title: '피드백',
      dataIndex: 'feedback_text',
      key: 'feedback_text',
      ellipsis: true
    },
    {
      title: '평가일',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    }
  ]

  if (!project) {
    return <div className="p-8">로딩 중...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/projects')}
          >
            과제 목록으로 돌아가기
          </Button>
          <Space>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/admin/projects/${projectId}/edit`)}
            >
              과제 수정
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
              loading={deleteLoading}
            >
              삭제
            </Button>
          </Space>
        </div>

        <Card className="mb-4">
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <Title level={2} className="mb-2">{project.project_name}</Title>
                <Space>
                  <Text type="secondary">
                    생성일: {dayjs(project.created_at).format('YYYY-MM-DD')}
                  </Text>
                </Space>
              </div>
              <div className="flex items-center gap-3">
                {/* 상태 Badge - display_status 사용 */}
                <Tag color={getStatusConfig(project.display_status || project.status).color} style={{ fontSize: 16, padding: '4px 12px' }}>
                  {getStatusConfig(project.display_status || project.status).text}
                </Tag>
                {/* 상태 변경 버튼 (draft 제외 - 정식저장 버튼으로 처리) */}
                {getNextStatuses(project.status).length > 0 && (
                  <Dropdown
                    menu={{
                      items: getNextStatuses(project.status).map(nextStatus => ({
                        key: nextStatus,
                        label: `${getStatusConfig(nextStatus).text}(으)로 변경`,
                        onClick: () => {
                          Modal.confirm({
                            title: '상태 변경',
                            content: `정말 "${getStatusConfig(nextStatus).text}" 상태로 변경하시겠습니까?`,
                            okText: '변경',
                            cancelText: '취소',
                            onOk: () => handleStatusChange(nextStatus)
                          })
                        }
                      }))
                    }}
                  >
                    <Button>
                      상태 변경 <DownOutlined />
                    </Button>
                  </Dropdown>
                )}
              </div>
            </div>
          </div>

          <Descriptions bordered column={1} labelStyle={{ width: 120, whiteSpace: 'nowrap' }}>
            <Descriptions.Item label="과제 설명">
              <div style={{ whiteSpace: 'pre-wrap' }}>{project.description || '-'}</div>
            </Descriptions.Item>
            <Descriptions.Item label="모집 기간">
              {dayjs(project.recruitment_start_date).format('YYYY-MM-DD')} ~ {dayjs(project.recruitment_end_date).format('YYYY-MM-DD')}
            </Descriptions.Item>
            <Descriptions.Item label="과제 기간">
              {project.project_start_date && project.project_end_date
                ? `${dayjs(project.project_start_date).format('YYYY-MM-DD')} ~ ${dayjs(project.project_end_date).format('YYYY-MM-DD')}`
                : project.project_start_date
                  ? `${dayjs(project.project_start_date).format('YYYY-MM-DD')} ~ 미정`
                  : '미정'}
            </Descriptions.Item>
            <Descriptions.Item label="실제 기간">
              {project.actual_start_date && project.actual_end_date
                ? `${dayjs(project.actual_start_date).format('YYYY-MM-DD')} ~ ${dayjs(project.actual_end_date).format('YYYY-MM-DD')}`
                : project.actual_start_date
                  ? `${dayjs(project.actual_start_date).format('YYYY-MM-DD')} ~ 진행중`
                  : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="모집 인원">
              최대 {project.max_participants}명 / 현재 {project.current_participants || 0}명
            </Descriptions.Item>
            {project.overall_feedback && (
              <Descriptions.Item label="과제 총평">
                <div style={{ whiteSpace: 'pre-wrap' }}>{project.overall_feedback}</div>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Action Buttons */}
        <div className="mb-4">
          <Space size="middle">
            <Button
              type="primary"
              icon={<UnorderedListOutlined />}
              onClick={() => setSurveyBuilderVisible(true)}
              size="large"
            >
              설문 구성
            </Button>
            {scoreValidation && (
              <Text type={scoreValidation.is_valid ? 'success' : 'warning'}>
                {scoreValidation.is_valid ? (
                  <><CheckCircleOutlined /> {scoreValidation.message}</>
                ) : (
                  <><CloseCircleOutlined /> {scoreValidation.message}</>
                )}
              </Text>
            )}
          </Space>
        </div>

        <Tabs defaultActiveKey="applications" className="application-tabs">
          <TabPane
            tab={
              <span>
                <TeamOutlined />
                지원자 목록
              </span>
            }
            key="applications"
          >
            <Card>
              <Title level={4}>지원자 관리</Title>
              <Text type="secondary">지원자 관리 기능은 추후 구현 예정입니다.</Text>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <BarChartOutlined />
                코치 평가 ({evaluations.length})
              </span>
            }
            key="evaluations"
          >
            <Card>
              <div className="flex justify-between items-center mb-4">
                <Title level={4} className="mb-0">코치 평가 결과</Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate(`/admin/projects/${projectId}/evaluations/create`)}
                >
                  평가 추가
                </Button>
              </div>
              <Table
                columns={evaluationColumns}
                dataSource={evaluations}
                rowKey="evaluation_id"
                pagination={false}
                locale={{ emptyText: '평가가 없습니다.' }}
              />
            </Card>
          </TabPane>
        </Tabs>

        <Modal
          title="커스텀 질문 추가"
          open={questionModalVisible}
          onCancel={() => {
            setQuestionModalVisible(false)
            questionForm.resetFields()
          }}
          onOk={() => questionForm.submit()}
          width={600}
        >
          <Form
            form={questionForm}
            layout="vertical"
            onFinish={handleCreateQuestion}
            initialValues={{
              question_type: 'textarea',
              is_required: true,
              is_evaluation: false,
              display_order: questions.length + 1
            }}
          >
            <Form.Item
              name="question_text"
              label="질문 내용"
              rules={[{ required: true, message: '질문을 입력해주세요.' }]}
            >
              <TextArea rows={3} placeholder="예: 본 과제에 지원하게 된 동기는 무엇인가요?" />
            </Form.Item>

            <Form.Item
              name="question_type"
              label="답변 유형"
              rules={[{ required: true }]}
            >
              <Select>
                <Select.Option value="text">단답형</Select.Option>
                <Select.Option value="textarea">장문형</Select.Option>
                <Select.Option value="select">선택형</Select.Option>
                <Select.Option value="file">파일 첨부</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="is_required"
              label="필수 여부"
              valuePropName="checked"
            >
              <Switch checkedChildren="필수" unCheckedChildren="선택" />
            </Form.Item>

            <Form.Item
              name="is_evaluation"
              label="평가 여부"
              valuePropName="checked"
              help="이 질문을 평가 항목으로 사용하려면 체크하세요."
            >
              <Switch checkedChildren="평가" unCheckedChildren="일반" />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.is_evaluation !== currentValues.is_evaluation}
            >
              {({ getFieldValue }) =>
                getFieldValue('is_evaluation') ? (
                  <Form.Item
                    name="max_score"
                    label="배점"
                    rules={[
                      { required: true, message: '배점을 입력해주세요.' },
                      { type: 'number', min: 0, message: '0 이상이어야 합니다.' }
                    ]}
                    help="이 질문의 최대 배점을 입력하세요."
                  >
                    <InputNumber min={0} max={1000} step={1} style={{ width: '100%' }} placeholder="예: 10" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item
              name="display_order"
              label="표시 순서"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="options"
              label="선택지 (선택형인 경우)"
              help='JSON 형식으로 입력해주세요. 예: ["옵션1", "옵션2"]'
            >
              <TextArea rows={2} placeholder='["리더코치", "참여코치", "수퍼비전 코치"]' />
            </Form.Item>
          </Form>
        </Modal>

        {/* Survey Builder */}
        <SurveyBuilder
          projectId={parseInt(projectId || '0')}
          visible={surveyBuilderVisible}
          onClose={() => setSurveyBuilderVisible(false)}
          onSave={() => {
            loadProjectItems()
            validateScore()
          }}
        />
      </div>
    </div>
  )
}
