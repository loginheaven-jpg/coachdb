import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Select, InputNumber, Checkbox, Alert, Tabs } from 'antd'
import { UserOutlined, MailOutlined, PhoneOutlined, HomeOutlined, ArrowLeftOutlined, LockOutlined, FormOutlined, FileTextOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import authService, { UserUpdateData } from '../services/authService'
import UnifiedCompetencyPage from './UnifiedCompetencyPage'

const { Title, Text } = Typography
const { Option } = Select

// 코칭 분야 옵션
const COACHING_FIELDS = [
  { value: 'business', label: '비즈니스코칭' },
  { value: 'career', label: '진로코칭' },
  { value: 'youth', label: '청년코칭' },
  { value: 'adolescent', label: '청소년코칭' },
  { value: 'family', label: '가족코칭' },
  { value: 'life', label: '그 외 라이프코칭' }
]

export default function ProfileEditPage() {
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()

  // required 모드: 프로필 미완성 시 강제 이동된 경우
  const isRequiredMode = searchParams.get('required') === 'true'

  // 역할에 따라 적절한 대시보드로 이동
  const navigateToDashboard = () => {
    if (!user) {
      navigate('/')
      return
    }
    // 통합 대시보드로 이동
    navigate('/dashboard')
  }

  useEffect(() => {
    if (user) {
      // 사용자 정보로 폼 초기화
      const userRoles = JSON.parse(user.roles)
      const coachingFields = user.coaching_fields && user.coaching_fields !== 'null'
        ? JSON.parse(user.coaching_fields)
        : []

      form.setFieldsValue({
        email: user.email,
        name: user.name,
        phone: user.phone,
        birth_year: user.birth_year,
        gender: user.gender,
        address: user.address,
        organization: user.organization,
        in_person_coaching_area: user.in_person_coaching_area,
        roles: userRoles,
        coach_certification_number: user.coach_certification_number,
        coaching_fields: coachingFields,
        introduction: user.introduction
      })
    }
  }, [user, form])

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const updateData: UserUpdateData = {
        name: values.name,
        phone: values.phone,
        birth_year: values.birth_year,
        gender: values.gender,
        address: values.address,
        organization: values.organization,
        in_person_coaching_area: values.in_person_coaching_area,
        coach_certification_number: values.coach_certification_number,
        coaching_fields: values.coaching_fields,
        introduction: values.introduction
      }

      const updatedUser = await authService.updateProfile(updateData)

      // authStore 업데이트
      useAuthStore.getState().setUser(updatedUser as any)

      message.success('프로필이 업데이트되었습니다!')
      navigateToDashboard()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '프로필 업데이트에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const onPasswordChange = async (values: any) => {
    setPasswordLoading(true)
    try {
      await authService.changePassword(values.new_password)
      message.success('비밀번호가 변경되었습니다!')
      passwordForm.resetFields()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '비밀번호 변경에 실패했습니다.')
    } finally {
      setPasswordLoading(false)
    }
  }

  // 기본정보 탭 컨텐츠
  const basicInfoContent = (
    <>
      {isRequiredMode && (
        <Alert
          message="프로필 정보 입력 필요"
          description="서비스 이용을 위해 기본 정보를 입력해주세요. 새 비밀번호도 설정하실 수 있습니다."
          type="info"
          showIcon
          className="mb-6"
        />
      )}

      <Form
        form={form}
        name="profile-edit"
        onFinish={onFinish}
        layout="vertical"
        size="large"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <Form.Item
            label="이메일"
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해주세요!' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다!' }
            ]}
          >
            <Input prefix={<MailOutlined />} disabled />
          </Form.Item>

          <Form.Item
            label="이름"
            name="name"
            rules={[
              { required: true, message: '이름을 입력해주세요!' },
              { min: 2, message: '최소 2자 이상이어야 합니다!' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="홍길동" />
          </Form.Item>

          <Form.Item
            label="역할 (복수 선택 가능)"
            name="roles"
            rules={[{ required: true, message: '역할을 최소 1개 이상 선택해주세요!' }]}
          >
            <Select mode="multiple" placeholder="역할 선택 (복수 가능)" disabled>
              <Option value="coach">코치</Option>
              <Option value="staff">심사위원</Option>
              <Option value="admin">관리자</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="전화번호"
            name="phone"
            rules={[{ required: true, message: '전화번호를 입력해주세요!' }]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="010-1234-5678" />
          </Form.Item>

          <Form.Item
            label="생년"
            name="birth_year"
            rules={[
              { required: true, message: '생년을 입력해주세요!' },
              { type: 'number', min: 1900, max: new Date().getFullYear(), message: '올바른 연도를 입력해주세요' }
            ]}
          >
            <InputNumber
              className="w-full"
              placeholder="예: 1985"
              min={1900}
              max={new Date().getFullYear()}
            />
          </Form.Item>

          <Form.Item
            label="성별"
            name="gender"
            rules={[{ required: true, message: '성별을 선택해주세요!' }]}
          >
            <Select placeholder="성별 선택">
              <Option value="남성">남성</Option>
              <Option value="여성">여성</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="코치 자격증 번호 (최상위 자격)"
            name="coach_certification_number"
            rules={[{ required: true, message: '코치 자격증 번호를 입력해주세요!' }]}
          >
            <Input placeholder="최상위 자격증 번호" />
          </Form.Item>
        </div>

        <Form.Item
          label="주소 (시/군/구)"
          name="address"
          rules={[{ required: true, message: '주소를 입력해주세요!' }]}
        >
          <Input
            prefix={<HomeOutlined />}
            placeholder="시/군/구 단위로 입력해주세요 (예: 서울시 강남구)"
          />
        </Form.Item>

        <Form.Item
          label="소속"
          name="organization"
        >
          <Input
            placeholder="소속 기관/단체명 (선택)"
          />
        </Form.Item>

        <Form.Item
          label="대면코칭 가능 지역"
          name="in_person_coaching_area"
        >
          <Input
            placeholder="대면 코칭 가능한 지역을 입력해주세요 (예: 서울 전지역, 경기 남부)"
          />
        </Form.Item>

        <Form.Item
          label="코칭 분야 (복수 선택 가능)"
          name="coaching_fields"
          rules={[{ required: true, message: '코칭 분야를 최소 1개 이상 선택해주세요!' }]}
        >
          <Checkbox.Group>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {COACHING_FIELDS.map(field => (
                <Checkbox key={field.value} value={field.value}>
                  {field.label}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item
          label="자기소개"
          name="introduction"
        >
          <Input.TextArea
            rows={4}
            placeholder="본인을 소개해 주세요 (선택)"
          />
        </Form.Item>

        <div className="flex gap-4">
          {!isRequiredMode && (
            <Button
              type="default"
              onClick={navigateToDashboard}
              className="flex-1"
              size="large"
            >
              취소
            </Button>
          )}
          <Button
            type="primary"
            htmlType="submit"
            className={isRequiredMode ? "w-full" : "flex-1"}
            loading={loading}
            size="large"
          >
            저장
          </Button>
        </div>
      </Form>

      {/* 비밀번호 변경 섹션 */}
      <Card className="mt-6">
        <Title level={4} className="mb-4">
          비밀번호 변경
        </Title>
        <Text className="block text-gray-600 mb-6">
          새로운 비밀번호를 입력하여 변경할 수 있습니다 (최소 6자 이상)
        </Text>

        <Form
          form={passwordForm}
          name="password-change"
          onFinish={onPasswordChange}
          layout="vertical"
          size="large"
        >
          <Form.Item
            label="새 비밀번호"
            name="new_password"
            rules={[
              { required: true, message: '새 비밀번호를 입력해주세요!' },
              { min: 6, message: '비밀번호는 최소 6자 이상이어야 합니다!' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="새 비밀번호 (최소 6자)"
            />
          </Form.Item>

          <Form.Item
            label="비밀번호 확인"
            name="confirm_password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '비밀번호를 다시 입력해주세요!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다!'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호 확인"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={passwordLoading}
            size="large"
          >
            비밀번호 변경
          </Button>
        </Form>
      </Card>
    </>
  )

  // 탭 아이템 정의
  const tabItems = [
    {
      key: 'basic',
      label: (
        <span>
          <FormOutlined />
          기본정보
        </span>
      ),
      children: basicInfoContent
    },
    {
      key: 'detail',
      label: (
        <span>
          <FileTextOutlined />
          세부정보
        </span>
      ),
      children: <UnifiedCompetencyPage embedded={true} />
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {!isRequiredMode && (
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={navigateToDashboard}
            className="mb-4"
          >
            대시보드로 돌아가기
          </Button>
        )}

        <Card>
          <div className="flex justify-between items-start mb-4">
            <Title level={2} className="mb-0">
              {isRequiredMode ? '프로필 정보 입력' : '프로필 수정'}
            </Title>
            {user?.updated_at && (
              <div className="text-right text-gray-500 text-sm whitespace-nowrap">
                <div className="font-semibold">최종 수정일</div>
                <div>{new Date(user.updated_at).toLocaleString('ko-KR')}</div>
              </div>
            )}
          </div>

          <Tabs
            defaultActiveKey="basic"
            items={tabItems}
            size="large"
            className="application-tabs"
          />
        </Card>
      </div>
    </div>
  )
}
