import { Typography, Card, Row, Col, Button, Alert, message } from 'antd'
import { useAuthStore } from '../stores/authStore'
import { FileTextOutlined, CheckCircleOutlined, UserOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

const { Title, Text } = Typography

export default function CoachDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [needsDetailedProfile, setNeedsDetailedProfile] = useState(false)

  useEffect(() => {
    // 세부정보 입력 여부 확인 (예: CoachProfile이 없는 경우)
    // 현재는 간단히 coaching_fields가 없으면 세부정보 미입력으로 판단
    if (user && (!user.coaching_fields || user.coaching_fields === '[]' || user.coaching_fields === 'null')) {
      setNeedsDetailedProfile(true)
    }
  }, [user])

  return (
    <div className="p-8">
        <div className="mb-4">
          <Title level={2} className="mb-0">코치 대시보드</Title>
          <Text className="block text-gray-600">
            환영합니다, {user?.name}님! - PPMS (Project & coach Profile Management System)
          </Text>
        </div>

      {needsDetailedProfile && (
        <Alert
          message="프로필을 완성해주세요"
          description="더 나은 서비스 제공을 위해 역량 및 세부정보를 입력해주세요. 학력, 경력, 자격증 등의 정보를 관리할 수 있습니다."
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
          action={
            <Button size="small" type="primary" onClick={() => navigate('/coach/competencies')}>
              역량 및 세부정보 입력
            </Button>
          }
          closable
          onClose={() => setNeedsDetailedProfile(false)}
          className="mb-6"
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <div className="text-center">
              <UserOutlined className="text-4xl text-orange-500 mb-4" />
              <Title level={4}>프로필 관리</Title>
              <Text className="text-gray-600">기본정보 및 세부정보</Text>
              <div className="mt-4 flex flex-col gap-2">
                <Button type="default" onClick={() => navigate('/profile/edit')}>
                  기본정보 수정
                </Button>
                <Button type="primary" onClick={() => navigate('/profile/detailed')}>
                  세부정보 관리
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <div className="text-center">
              <FileTextOutlined className="text-4xl text-green-500 mb-4" />
              <Title level={4}>내 지원서</Title>
              <Text className="text-gray-600">0개</Text>
              <div className="mt-4 flex flex-col gap-2">
                <Button type="primary" onClick={() => navigate('/coach/projects')}>
                  과제 지원하기
                </Button>
                <Button onClick={() => navigate('/coach/my-applications')}>
                  내 지원서 확인
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <div className="text-center">
              <CheckCircleOutlined className="text-4xl text-purple-500 mb-4" />
              <Title level={4}>선발 결과</Title>
              <Text className="text-gray-600">0개</Text>
              <div className="mt-4">
                <Button onClick={() => message.info('선발 결과 확인 기능은 준비 중입니다.')}>
                  결과 확인
                </Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="mt-8">
        <Title level={4}>최근 활동</Title>
        <Text className="text-gray-500">아직 활동 내역이 없습니다.</Text>
      </Card>
    </div>
  )
}
