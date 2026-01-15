import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Typography,
  Card,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Button,
  message,
  Select,
  Space,
  Alert,
  Divider,
  Tabs,
  Modal
} from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, WarningOutlined, FormOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons'
import projectService, { ProjectDetail, ProjectUpdate, ProjectStatus, ScoreValidation } from '../services/projectService'
import SurveyBuilder from '../components/SurveyBuilder'
import PageGuide from '../components/shared/PageGuide'
import { PAGE_GUIDES } from '../constants/pageGuides'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

export default function ProjectEditPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [finalizeLoading, setFinalizeLoading] = useState(false)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [scoreValidation, setScoreValidation] = useState<ScoreValidation | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [showSetupModal, setShowSetupModal] = useState(false)

  // Watch project_period for reactive condition display
  const projectPeriod = Form.useWatch('project_period', form)

  useEffect(() => {
    if (projectId) {
      loadProject()
      loadScoreValidation()
    }
  }, [projectId])

  // 신규 생성 후 설문구성 안내 모달 표시
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowSetupModal(true)
      // URL에서 new 파라미터 제거
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams])

  const loadScoreValidation = async () => {
    if (!projectId) return
    try {
      const validation = await projectService.validateProjectScore(parseInt(projectId))
      setScoreValidation(validation)
    } catch (error) {
      console.error('점수 검증 실패:', error)
    }
  }

  const loadProject = async () => {
    if (!projectId) return
    try {
      const data = await projectService.getProject(parseInt(projectId))
      setProject(data)

      // 폼에 데이터 설정
      form.setFieldsValue({
        project_name: data.project_name,
        description: data.description,
        recruitment_period: [
          dayjs(data.recruitment_start_date),
          dayjs(data.recruitment_end_date)
        ],
        project_period: data.project_start_date && data.project_end_date ? [
          dayjs(data.project_start_date),
          dayjs(data.project_end_date)
        ] : null,
        actual_period: data.actual_start_date && data.actual_end_date ? [
          dayjs(data.actual_start_date),
          dayjs(data.actual_end_date)
        ] : null,
        max_participants: data.max_participants,
        project_manager_id: data.project_manager_id,
        status: data.status,
        overall_feedback: data.overall_feedback
      })
    } catch (error: any) {
      console.error('과제 로드 실패:', error)
      message.error('과제 정보를 불러오는데 실패했습니다.')
    }
  }

  // 폼 데이터를 ProjectUpdate로 변환
  const getUpdateData = (values: any): ProjectUpdate => ({
    project_name: values.project_name,
    description: values.description || null,
    recruitment_start_date: values.recruitment_period[0].format('YYYY-MM-DD'),
    recruitment_end_date: values.recruitment_period[1].format('YYYY-MM-DD'),
    project_start_date: values.project_period ? values.project_period[0].format('YYYY-MM-DD') : null,
    project_end_date: values.project_period ? values.project_period[1].format('YYYY-MM-DD') : null,
    actual_start_date: values.actual_period ? values.actual_period[0].format('YYYY-MM-DD') : null,
    actual_end_date: values.actual_period ? values.actual_period[1].format('YYYY-MM-DD') : null,
    max_participants: values.max_participants,
    project_manager_id: values.project_manager_id || null,
    overall_feedback: values.overall_feedback || null
  })

  // 임시저장 - draft 상태 유지/전환
  const handleTempSave = async () => {
    if (!projectId) return
    try {
      const values = await form.validateFields()
      setLoading(true)
      const updateData = getUpdateData(values)
      updateData.status = ProjectStatus.DRAFT  // 초안 상태로 설정
      await projectService.updateProject(parseInt(projectId), updateData)
      message.success('임시저장 되었습니다.')
      loadProject()
    } catch (error: any) {
      console.error('임시저장 실패:', error)
      message.error(error.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 정식저장 - 조건 검증 후 ready 상태로 전환
  const handleFinalize = async () => {
    if (!projectId) return
    try {
      const values = await form.validateFields()
      setFinalizeLoading(true)

      // 먼저 기본 정보 저장
      const updateData = getUpdateData(values)
      await projectService.updateProject(parseInt(projectId), updateData)

      // finalize API 호출 (100점 검증 + ready 상태 전환)
      await projectService.finalizeProject(parseInt(projectId))
      message.success('정식저장 되었습니다. 모집시작일에 자동으로 공개됩니다.')
      navigate(`/admin/projects/${projectId}`)
    } catch (error: any) {
      console.error('정식저장 실패:', error)
      message.error(error.response?.data?.detail || '정식저장에 실패했습니다.')
    } finally {
      setFinalizeLoading(false)
    }
  }

  // 기존 handleSubmit은 임시저장으로 변경
  const handleSubmit = async () => {
    handleTempSave()
  }

  if (!project) {
    return <div className="p-8">로딩 중...</div>
  }

  // 탭 아이템 정의
  const tabItems = [
    {
      key: 'basic',
      label: (
        <span>
          <FormOutlined />
          과제정보
        </span>
      ),
      children: (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="project_name"
            label="과제명"
            rules={[{ required: true, message: '과제명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 2025년 상반기 리더코치 양성 과제" size="large" />
          </Form.Item>

          <Form.Item
            name="description"
            label="과제 설명"
          >
            <TextArea
              rows={4}
              placeholder="과제에 대한 설명을 입력해주세요."
            />
          </Form.Item>

          <Form.Item
            name="recruitment_period"
            label="모집 기간"
            rules={[{ required: true, message: '모집 기간을 선택해주세요.' }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="project_period"
            label="과제 기간 (예정)"
            help="과제 진행 예정 기간입니다."
          >
            <RangePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="actual_period"
            label="과제 기간 (실제)"
            help="실제 과제가 진행된 기간입니다."
          >
            <RangePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="max_participants"
            label="최대 참여 인원"
            rules={[
              { required: true, message: '최대 참여 인원을 입력해주세요.' },
              { type: 'number', min: 1, message: '1명 이상이어야 합니다.' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={1000}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="project_manager_id"
            label="과제관리자 ID"
            help="과제를 관리할 사용자의 ID를 입력해주세요."
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              size="large"
              placeholder="사용자 ID"
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="과제 상태"
            rules={[{ required: true }]}
            help="상태 변경은 임시저장/정식저장 버튼을 사용해주세요."
          >
            <Select size="large">
              <Select.Option value="draft">초안</Select.Option>
              <Select.Option value="ready">모집개시 (정식저장)</Select.Option>
              <Select.Option value="reviewing">심사중</Select.Option>
              <Select.Option value="in_progress">과제진행중</Select.Option>
              <Select.Option value="evaluating">과제평가중</Select.Option>
              <Select.Option value="closed">종료</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="overall_feedback"
            label="과제 총평"
            help="과제 종료 후 전체 총평을 입력할 수 있습니다."
          >
            <TextArea
              rows={4}
              placeholder="과제 전반에 대한 총평을 입력해주세요."
            />
          </Form.Item>

          <Divider />

          {/* 정식저장 조건 표시 */}
          <div className="mb-6">
            <Title level={5}>정식저장 조건</Title>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {projectPeriod ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <WarningOutlined style={{ color: '#faad14' }} />
                )}
                <Text>과제 기간 입력: {projectPeriod ? '완료' : '미입력'}</Text>
              </div>
              <div className="flex items-center gap-2">
                {scoreValidation?.is_valid ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <WarningOutlined style={{ color: '#faad14' }} />
                )}
                <Text>설문 점수: {scoreValidation?.total_score || 0}/100점</Text>
                {!scoreValidation?.is_valid && (
                  <Button
                    type="link"
                    onClick={() => setActiveTab('survey')}
                    style={{ padding: 0 }}
                  >
                    설문항목 탭에서 구성 →
                  </Button>
                )}
              </div>
            </div>
            {(!projectPeriod || !scoreValidation?.is_valid) && (
              <Alert
                type="warning"
                className="mt-3"
                message="정식저장을 하려면 위 조건을 모두 충족해야 합니다."
                description={
                  <ul className="mt-2 list-disc pl-4">
                    {!projectPeriod && <li>과제 기간(예정)을 입력해주세요</li>}
                    {!scoreValidation?.is_valid && (
                      <li>설문항목 탭에서 배점을 100점으로 맞춰주세요 (현재: {scoreValidation?.total_score || 0}점)</li>
                    )}
                  </ul>
                }
              />
            )}
          </div>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                size="large"
                onClick={() => navigate(`/admin/projects/${projectId}`)}
              >
                취소
              </Button>
              <Button
                size="large"
                loading={loading}
                onClick={handleTempSave}
              >
                임시저장 (초안)
              </Button>
              <Button
                type="primary"
                size="large"
                loading={finalizeLoading}
                onClick={handleFinalize}
                icon={<CheckCircleOutlined />}
              >
                정식저장
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'survey',
      label: (
        <span>
          <FileTextOutlined />
          설문항목 ({scoreValidation?.total_score || 0}/100점)
          {!scoreValidation?.is_valid && (
            <span style={{ color: '#ff4d4f', marginLeft: 4 }}>●</span>
          )}
        </span>
      ),
      children: (
        <SurveyBuilder
          projectId={parseInt(projectId!)}
          embedded={true}
          onSave={() => {
            loadScoreValidation()
          }}
        />
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/admin/projects/${projectId}`)}
          >
            과제 상세로 돌아가기
          </Button>
        </div>

        <PageGuide
          guideId={PAGE_GUIDES.PROJECT_EDIT.id}
          title={PAGE_GUIDES.PROJECT_EDIT.title}
          message={PAGE_GUIDES.PROJECT_EDIT.message}
          type={PAGE_GUIDES.PROJECT_EDIT.type}
        />

        <Card>
          <div className="mb-4">
            <Title level={2} className="mb-0">과제 수정</Title>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            className="application-tabs"
          />
        </Card>
      </div>

      {/* 신규 생성 후 설문구성 안내 모달 */}
      <Modal
        open={showSetupModal}
        title={
          <div className="flex items-center gap-2">
            <SettingOutlined style={{ color: '#1890ff' }} />
            <span>설문 구성 안내</span>
          </div>
        }
        footer={[
          <Button key="later" onClick={() => setShowSetupModal(false)}>
            나중에
          </Button>,
          <Button
            key="go"
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => {
              setShowSetupModal(false)
              setActiveTab('survey')
            }}
          >
            설문구성 바로가기
          </Button>
        ]}
        onCancel={() => setShowSetupModal(false)}
      >
        <div className="py-4">
          <Alert
            type="info"
            showIcon
            message="과제 생성이 완료되었습니다!"
            description={
              <div className="mt-2">
                <p className="mb-2">
                  과제를 공개하려면 <strong>설문 구성(100점 만점)</strong>이 필요합니다.
                </p>
                <ul className="list-disc pl-4 text-gray-600">
                  <li>설문항목 탭에서 지원자가 입력할 항목을 선택하세요</li>
                  <li>각 항목에 배점을 설정하여 총합 100점을 맞춰주세요</li>
                  <li>설문 구성 후 '정식저장'하면 모집 시작일에 자동 공개됩니다</li>
                </ul>
              </div>
            }
          />
        </div>
      </Modal>
    </div>
  )
}
