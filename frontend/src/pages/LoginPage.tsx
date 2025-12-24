import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Checkbox } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import authService from '../services/authService'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

const SAVED_CREDENTIALS_KEY = 'saved_login_credentials'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { login } = useAuthStore()

  // Load saved credentials on mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem(SAVED_CREDENTIALS_KEY)
    if (savedCredentials) {
      try {
        const { email, password } = JSON.parse(savedCredentials)
        form.setFieldsValue({ email, password })
        setRememberMe(true)
      } catch (e) {
        localStorage.removeItem(SAVED_CREDENTIALS_KEY)
      }
    }
  }, [form])

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const response = await authService.login(values)
      console.log('로그인 응답:', response)
      login(response.user, response.access_token, response.refresh_token)

      // Save or remove credentials based on rememberMe
      if (rememberMe) {
        localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify({
          email: values.email,
          password: values.password
        }))
      } else {
        localStorage.removeItem(SAVED_CREDENTIALS_KEY)
      }

      // 토큰 저장 확인
      console.log('저장된 access_token:', localStorage.getItem('access_token'))
      console.log('저장된 refresh_token:', localStorage.getItem('refresh_token'))

      message.success('로그인 성공!')

      // 프로필 미완성 시 프로필 수정 페이지로 이동
      if (!response.profile_complete) {
        message.info('프로필 정보를 완성해주세요.')
        navigate('/profile/edit?required=true')
        return
      }

      // 통합 대시보드로 이동 (역할별 탭이 자동 선택됨)
      navigate('/dashboard')
    } catch (error: any) {
      console.error('로그인 에러:', error)
      message.error(error.response?.data?.detail || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <Title level={2} className="text-blue-600 mb-1">PPMS</Title>
          <p className="text-gray-500 text-sm">Project & coach Profile Management System</p>
        </div>
        <Title level={4} className="text-center mb-6">
          로그인
        </Title>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해주세요!' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다!' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="이메일"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력해주세요!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item className="mb-2">
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            >
              로그인 정보 저장
            </Checkbox>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="w-full"
              loading={loading}
            >
              로그인
            </Button>
          </Form.Item>

          <div className="text-center">
            <span className="text-gray-600">계정이 없으신가요? </span>
            <Link to="/register" className="text-blue-600 hover:text-blue-800">
              회원가입
            </Link>
          </div>

          <div className="text-center mt-3">
            <Link to="/forgot-password" className="text-gray-500 hover:text-gray-700 text-sm">
              비밀번호를 잊어버리셨나요? 이메일 리셋
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}
