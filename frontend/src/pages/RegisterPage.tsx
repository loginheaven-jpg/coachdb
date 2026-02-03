import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Select, InputNumber, Checkbox, Modal } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, HomeOutlined } from '@ant-design/icons'
import authService from '../services/authService'
import { useAuthStore } from '../stores/authStore'

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

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const registerData = {
        ...values,
        birth_year: values.birth_year || undefined,
        in_person_coaching_area: values.in_person_coaching_area || undefined,
        roles: ['COACH']  // 모든 사용자는 COACH로만 가입
      }

      const response = await authService.register(registerData)
      login(response.user, response.access_token, response.refresh_token)

      message.success('회원가입이 완료되었습니다!')

      // 역량 정보 입력 유도 팝업
      Modal.confirm({
        title: '회원가입 완료',
        content: '역량 정보를 입력하시면 과제 응모에 편리합니다. 지금 입력하시겠습니까?',
        okText: '역량정보 입력',
        cancelText: '아니요',
        onOk: () => navigate('/coach/competencies'),
        onCancel: () => navigate('/dashboard')
      })
    } catch (error: any) {
      message.error(error.response?.data?.detail || '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-8">
      <Card className="w-full max-w-2xl">
        <div className="text-center mb-4">
          <Title level={2} className="text-kca-primary mb-1">PCMS</Title>
          <p className="text-gray-500 text-sm">Project & Coach pool Management System</p>
        </div>
        <Title level={4} className="text-center mb-2">
          회원가입
        </Title>
        <Text className="block text-center text-gray-600 mb-6">
          PCMS에 오신 것을 환영합니다
        </Text>

        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          initialValues={{ gender: '남성' }}
          scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            {/* 필수 정보 */}
            <Form.Item
              label="이메일"
              name="email"
              rules={[
                { required: true, message: '이메일을 입력해주세요!' },
                { type: 'email', message: '올바른 이메일 형식이 아닙니다!' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="example@email.com" />
            </Form.Item>

            <Form.Item
              label="비밀번호"
              name="password"
              rules={[
                { required: true, message: '비밀번호를 입력해주세요!' },
                { min: 8, message: '최소 8자 이상이어야 합니다!' },
                {
                  pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                  message: '영문과 숫자를 포함해야 합니다!'
                }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="최소 8자, 영문+숫자" />
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
                <Option value="기타">기타</Option>
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

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="w-full"
              loading={loading}
              size="large"
            >
              회원가입
            </Button>
          </Form.Item>

          <div className="text-center">
            <span className="text-gray-600">이미 계정이 있으신가요? </span>
            <Link to="/login" className="text-kca-primary hover:text-kca-primary-hover">
              로그인
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}
