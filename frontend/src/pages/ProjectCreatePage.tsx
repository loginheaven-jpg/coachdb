import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Button,
  message,
  Space,
  Alert,
  Select,
  Modal
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import projectService, { ProjectCreate, ProjectStatus, ProjectType, PROJECT_TYPE_LABELS } from '../services/projectService'
import adminService from '../services/adminService'
import PageGuide from '../components/shared/PageGuide'
import { PAGE_GUIDES } from '../constants/pageGuides'

const { Title, Text } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

export default function ProjectCreatePage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [allUsers, setAllUsers] = useState<{ user_id: number; name: string; email: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // 사용자 목록 로드
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        const users = await adminService.getUsers()
        setAllUsers(users)
      } catch (error) {
        console.error('사용자 목록 로드 실패:', error)
      } finally {
        setLoadingUsers(false)
      }
    }
    loadUsers()
  }, [])

  // 페이지 진입 시 안내 팝업 표시
  useEffect(() => {
    Modal.info({
      title: '과제 생성 안내',
      content: (
        <div>
          <p>과제정보, 설문항목(100점 배점), 심사계획(심사위원지정 포함) 이 완료되어야 과제를 상신할 수 있습니다.</p>
          <p>이를 관리자가 승인하고 모집기간이 도래하면 응모코치들께 과제가 노출됩니다.</p>
        </div>
      ),
      okText: '확인',
      width: 500
    })
  }, [])

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const projectData: ProjectCreate = {
        project_name: values.project_name,
        project_type: values.project_type || ProjectType.OTHER,
        description: values.description || null,
        support_program_name: values.support_program_name || null,
        recruitment_start_date: values.recruitment_period[0].format('YYYY-MM-DD'),
        recruitment_end_date: values.recruitment_period[1].format('YYYY-MM-DD'),
        project_start_date: values.project_period ? values.project_period[0].format('YYYY-MM-DD') : null,
        project_end_date: values.project_period ? values.project_period[1].format('YYYY-MM-DD') : null,
        max_participants: values.max_participants,
        project_manager_id: values.project_manager_id || null,
        status: ProjectStatus.DRAFT  // 항상 초안으로 생성
      }

      const createdProject = await projectService.createProject(projectData)
      message.success('과제가 생성되었습니다.')
      // 과제 수정 페이지로 이동 (설문구성 안내 모달 표시를 위한 new 파라미터)
      navigate(`/admin/projects/${createdProject.project_id}/edit?new=true`)
    } catch (error: any) {
      console.error('과제 생성 실패:', error)
      message.error(error.response?.data?.detail || '과제 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/projects')}
          >
            과제 목록으로 돌아가기
          </Button>
        </div>

        <PageGuide
          guideId={PAGE_GUIDES.PROJECT_CREATE.id}
          title={PAGE_GUIDES.PROJECT_CREATE.title}
          message={PAGE_GUIDES.PROJECT_CREATE.message}
          type={PAGE_GUIDES.PROJECT_CREATE.type}
        />

        <Card>
          <div className="mb-6">
            <Title level={2} className="mb-2">새 과제 생성</Title>
            <Text className="text-gray-600">
              코칭 과제 정보를 입력해주세요.
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              max_participants: 20
            }}
          >
            <Form.Item
              name="project_type"
              label="과제 구분"
              rules={[{ required: true, message: '과제 구분을 선택해주세요.' }]}
              initialValue={ProjectType.OTHER}
            >
              <Select size="large" placeholder="과제 구분 선택">
                {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                  <Select.Option key={value} value={value}>
                    {label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="project_name"
              label="과제명"
              rules={[{ required: true, message: '과제명을 입력해주세요.' }]}
            >
              <Input placeholder="예: 2025년 상반기 리더코치 양성 과제" size="large" />
            </Form.Item>

            <Form.Item
              name="support_program_name"
              label="지원 사업명 (이 과제가 특정 지원 사업의 일부인 경우 입력)"
            >
              <Input placeholder="예: 한국코치협회 2025 상반기 코치양성 지원사업" size="large" />
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
              label="과제 기간 (과제 진행 예정 기간, 나중에 수정 가능)"
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
              label="과제관리자 (다른 사람에게 위임 시 선택, 미선택시 본인이 관리자)"
            >
              <Select
                showSearch
                allowClear
                size="large"
                placeholder="위임할 사용자 검색 (미선택 시 본인)"
                loading={loadingUsers}
                optionFilterProp="children"
                filterOption={(input, option) => {
                  const user = allUsers.find(u => u.user_id === option?.value)
                  if (!user) return false
                  const searchText = input.toLowerCase()
                  return (
                    user.name.toLowerCase().includes(searchText) ||
                    user.email.toLowerCase().includes(searchText)
                  )
                }}
                options={allUsers.map(user => ({
                  value: user.user_id,
                  label: `${user.name} (${user.email})`
                }))}
              />
            </Form.Item>

            <Alert
              type="info"
              className="mb-6"
              message="과제 생성 후 다음 단계"
              description={
                <ol className="mt-2 list-decimal pl-4">
                  <li>과제 상세 페이지에서 설문 구성 (배점 100점 필요)</li>
                  <li>과제 기간 입력 후 '정식저장'하면 모집시작일에 자동 공개</li>
                </ol>
              }
            />

            <Form.Item className="mb-0">
              <Space className="w-full justify-end">
                <Button
                  size="large"
                  onClick={() => navigate('/admin/projects')}
                >
                  취소
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  icon={<SaveOutlined />}
                >
                  과제 생성 (초안)
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  )
}
