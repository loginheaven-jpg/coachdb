import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Result } from 'antd'
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import api from '../services/api'

const { Title, Text } = Typography

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState('')
  const navigate = useNavigate()

  const onFinish = async (values: { email: string }) => {
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', null, {
        params: { email: values.email }
      })
      setEmail(values.email)
      setSubmitted(true)
    } catch (error: any) {
      // Always show success to prevent email enumeration
      setEmail(values.email)
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <Result
            status="success"
            title="이메일 발송 완료"
            subTitle={
              <div className="text-left">
                <p><strong>{email}</strong>로 비밀번호 재설정 링크를 발송했습니다.</p>
                <p className="mt-2 text-gray-500">
                  이메일이 도착하지 않으면 스팸 폴더를 확인해주세요.
                </p>
              </div>
            }
            extra={[
              <Button type="primary" key="login" onClick={() => navigate('/login')}>
                로그인 페이지로
              </Button>,
              <Button key="retry" onClick={() => setSubmitted(false)}>
                다시 시도
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
          <Title level={2} className="!mb-2">비밀번호 찾기</Title>
          <Text className="text-gray-600">
            가입하신 이메일 주소를 입력해주세요.
            <br />
            비밀번호 재설정 링크를 보내드립니다.
          </Text>
        </div>

        <Form
          name="forgot-password"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해주세요' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다' },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-gray-400" />}
              placeholder="이메일 주소"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item className="mb-4">
            <Button
              type="primary"
              htmlType="submit"
              className="w-full h-12"
              loading={loading}
            >
              재설정 링크 발송
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
