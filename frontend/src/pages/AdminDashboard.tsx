import { Typography, Card, Row, Col, Button, Statistic } from 'antd'
import { useAuthStore } from '../stores/authStore'
import { FolderOpenOutlined, UserOutlined, FileTextOutlined, CheckCircleOutlined, SettingOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const getUserRoles = (): string[] => {
    try {
      return JSON.parse(user?.roles || '[]')
    } catch {
      return []
    }
  }

  // Check if user is SUPER_ADMIN (only SUPER_ADMIN can manage competency items)
  const isSuperAdmin = () => {
    return getUserRoles().includes('SUPER_ADMIN')
  }

  // Check if user can verify (SUPER_ADMIN, PROJECT_MANAGER, or VERIFIER)
  const canVerify = () => {
    const roles = getUserRoles()
    return roles.some(r => ['SUPER_ADMIN', 'PROJECT_MANAGER', 'VERIFIER'].includes(r))
  }

  return (
    <div className="p-8">
        <div className="mb-4">
          <Title level={2} className="mb-0">관리자 대시보드</Title>
          <Text className="block text-gray-600">
            환영합니다, {user?.name}님! - PPMS (Project & coach Profile Management System)
          </Text>
        </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="전체 과제"
              value={0}
              prefix={<FolderOpenOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="등록된 코치"
              value={0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="전체 지원서"
              value={0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="선발 완료"
              value={0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-8">
        <Col xs={24} md={12}>
          <Card title="빠른 작업">
            <div className="space-y-2">
              <Button type="primary" block onClick={() => navigate('/admin/projects/create')}>
                새 과제 생성
              </Button>
              <Button block onClick={() => navigate('/admin/projects')}>
                과제 관리
              </Button>
              {canVerify() && (
                <Button
                  block
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => navigate('/admin/verifications')}
                >
                  증빙 확인
                </Button>
              )}
              {isSuperAdmin() && (
                <Button block onClick={() => navigate('/admin/users')}>
                  사용자 및 시스템 관리
                </Button>
              )}
              {isSuperAdmin() && (
                <Button
                  block
                  icon={<SettingOutlined />}
                  onClick={() => navigate('/admin/competency-items')}
                >
                  설문항목 관리
                </Button>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="최근 활동">
            <Text className="text-gray-500">아직 활동 내역이 없습니다.</Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
