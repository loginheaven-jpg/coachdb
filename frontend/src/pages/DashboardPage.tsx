import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Card, Row, Col, Statistic, Button, Spin } from 'antd'
import {
  FileTextOutlined,
  FolderOutlined,
  AuditOutlined,
  TrophyOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import applicationService from '../services/applicationService'
import projectService from '../services/projectService'

const { Title, Text } = Typography

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    myApplications: 0,
    managedProjects: 0,
    pendingVerifications: 0,
    pendingEvaluations: 0
  })

  // Get user's roles
  const getUserRoles = (): string[] => {
    try {
      return JSON.parse(user?.roles || '[]')
    } catch {
      return []
    }
  }

  const userRoles = getUserRoles()
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN')
  const isProjectManager = userRoles.includes('PROJECT_MANAGER')
  const isVerifier = userRoles.includes('VERIFIER')
  const isReviewer = userRoles.includes('REVIEWER')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      // 내 지원서 개수
      const applications = await applicationService.getMyApplications()
      const myApplications = applications.filter(a => a.application_status !== 'draft').length

      // 관리 중인 과제 개수 (PROJECT_MANAGER 또는 SUPER_ADMIN)
      let managedProjects = 0
      if (isProjectManager || isSuperAdmin) {
        const projects = await projectService.listProjects({ mode: 'manage' })
        managedProjects = projects.length
      }

      // 심사 대기 과제 개수 (REVIEWER 또는 SUPER_ADMIN)
      let pendingEvaluations = 0
      if (isReviewer || isSuperAdmin) {
        const reviewProjects = await projectService.listProjects({ mode: 'review' })
        pendingEvaluations = reviewProjects.length
      }

      setStats({
        myApplications,
        managedProjects,
        pendingVerifications: 0, // TODO: 증빙검토 API 연동
        pendingEvaluations
      })
    } catch (error) {
      console.error('통계 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* 환영 메시지 */}
      <div className="mb-8">
        <Title level={2}>안녕하세요, {user?.name}님!</Title>
        <Text type="secondary" className="text-lg">
          PPMS에 오신 것을 환영합니다.
        </Text>
      </div>

      {/* 요약 카드들 */}
      <Row gutter={[16, 16]}>
        {/* 내 지원서 */}
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/my-applications')}>
            <Statistic
              title="내 지원서"
              value={stats.myApplications}
              suffix="건"
              prefix={<FileTextOutlined className="text-blue-500" />}
            />
            <Button
              type="link"
              className="mt-4 p-0"
              icon={<ArrowRightOutlined />}
            >
              바로가기
            </Button>
          </Card>
        </Col>

        {/* 관리 과제 (PROJECT_MANAGER 또는 SUPER_ADMIN) */}
        {(isProjectManager || isSuperAdmin) && (
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable onClick={() => navigate('/projects/manage')}>
              <Statistic
                title="관리 중인 과제"
                value={stats.managedProjects}
                suffix="개"
                prefix={<FolderOutlined className="text-green-500" />}
              />
              <Button
                type="link"
                className="mt-4 p-0"
                icon={<ArrowRightOutlined />}
              >
                바로가기
              </Button>
            </Card>
          </Col>
        )}

        {/* 증빙검토 (VERIFIER 또는 SUPER_ADMIN) */}
        {(isVerifier || isSuperAdmin) && (
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable onClick={() => navigate('/admin/verifications')}>
              <Statistic
                title="증빙 검토"
                value={stats.pendingVerifications}
                suffix="건 대기"
                prefix={<AuditOutlined className="text-orange-500" />}
              />
              <Button
                type="link"
                className="mt-4 p-0"
                icon={<ArrowRightOutlined />}
              >
                바로가기
              </Button>
            </Card>
          </Col>
        )}

        {/* 과제심사 (REVIEWER 또는 SUPER_ADMIN) */}
        {(isReviewer || isSuperAdmin) && (
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable onClick={() => navigate('/evaluations')}>
              <Statistic
                title="심사 대상 과제"
                value={stats.pendingEvaluations}
                suffix="개"
                prefix={<TrophyOutlined className="text-purple-500" />}
              />
              <Button
                type="link"
                className="mt-4 p-0"
                icon={<ArrowRightOutlined />}
              >
                바로가기
              </Button>
            </Card>
          </Col>
        )}
      </Row>

      {/* 빠른 시작 안내 */}
      <Card className="mt-8">
        <Title level={4}>빠른 시작</Title>
        <Row gutter={[16, 16]} className="mt-4">
          <Col>
            <Button type="primary" onClick={() => navigate('/projects')}>
              모집중인 과제 보기
            </Button>
          </Col>
          <Col>
            <Button onClick={() => navigate('/coach/competencies')}>
              내 세부정보 관리
            </Button>
          </Col>
          {(isProjectManager || isSuperAdmin) && (
            <Col>
              <Button onClick={() => navigate('/projects/create')}>
                새 과제 만들기
              </Button>
            </Col>
          )}
        </Row>
      </Card>
    </div>
  )
}
