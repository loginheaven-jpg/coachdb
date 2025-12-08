import { Typography, Card, Row, Col, Button } from 'antd'
import { useAuthStore } from '../stores/authStore'
import { FolderOpenOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function StaffDashboard() {
  const { user } = useAuthStore()

  return (
    <div className="p-8">
        <div className="mb-4">
          <Title level={2} className="mb-0">심사위원 대시보드</Title>
          <Text className="block text-gray-600">
            환영합니다, {user?.name}님!
          </Text>
        </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <div className="text-center">
              <FolderOpenOutlined className="text-4xl text-blue-500 mb-4" />
              <Title level={4}>할당된 과제</Title>
              <Text className="text-gray-600">0개</Text>
              <div className="mt-4">
                <Button type="primary">과제 목록</Button>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <div className="text-center">
              <ClockCircleOutlined className="text-4xl text-orange-500 mb-4" />
              <Title level={4}>대기 중인 리뷰</Title>
              <Text className="text-gray-600">0개</Text>
              <div className="mt-4">
                <Button>리뷰 시작</Button>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <div className="text-center">
              <CheckCircleOutlined className="text-4xl text-green-500 mb-4" />
              <Title level={4}>완료한 리뷰</Title>
              <Text className="text-gray-600">0개</Text>
              <div className="mt-4">
                <Button>이력 확인</Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="mt-8">
        <Title level={4}>최근 리뷰 활동</Title>
        <Text className="text-gray-500">아직 리뷰 내역이 없습니다.</Text>
      </Card>
    </div>
  )
}
