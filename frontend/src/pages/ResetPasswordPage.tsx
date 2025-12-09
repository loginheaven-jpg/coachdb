import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Result, Spin } from 'antd'
import { LockOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import api from '../services/api'

const { Title, Text } = Typography

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 링크입니다. 비밀번호 찾기를 다시 시도해주세요.')
    }
  }, [token])

  const onFinish = async (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', null, {
        params: {
          token: token,
          new_password: values.password
        }
      })
      setSuccess(true)
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '비밀번호 재설정에 실패했습니다.'
      message.error(errorMessage)
      if (errorMessage.includes('만료') || errorMessage.includes('유효하지')) {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <Result
            status="error"
            title="링크가 유효하지 않습니다"
            subTitle={error}
            extra={[
              <Button type="primary" key="forgot" onClick={() => navigate('/forgot-password')}>
                비밀번호 찾기 다시 하기
              </Button>,
              <Button key="login" onClick={() => navigate('/login')}>
                로그인 페이지로
              </Button>,
            ]}
          />
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <Result
            status="success"
            title="비밀번호 변경 완료"
            subTitle="새로운 비밀번호로 로그인할 수 있습니다."
            extra={[
              <Button type="primary" key="login" onClick={() => navigate('/login')}>
                로그인 하기
              </Button>,
            ]}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <Title level={2} className="!mb-2">새 비밀번호 설정</Title>
          <Text className="text-gray-600">
            새로운 비밀번호를 입력해주세요.
          </Text>
        </div>

        <Form
          name="reset-password"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '새 비밀번호를 입력해주세요' },
              { min: 8, message: '비밀번호는 8자 이상이어야 합니다' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="새 비밀번호 (8자 이상)"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            rules={[
              { required: true, message: '비밀번호를 다시 입력해주세요' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="새 비밀번호 확인"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item className="mb-4">
            <Button
              type="primary"
              htmlType="submit"
              className="w-full h-12"
              loading={loading}
            >
              비밀번호 변경
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <Link to="/login" className="text-purple-600 hover:text-purple-800">
            <ArrowLeftOutlined className="mr-1" />
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </Card>
    </div>
  )
}
