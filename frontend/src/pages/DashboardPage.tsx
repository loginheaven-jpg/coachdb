import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Card, Row, Col, Statistic, Button, Spin, Timeline, Empty } from 'antd'
import {
  FileTextOutlined,
  FolderOutlined,
  AuditOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
  SendOutlined,
  EditOutlined,
  WarningOutlined,
  BellOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import applicationService from '../services/applicationService'
import projectService from '../services/projectService'
import notificationService, { Notification } from '../services/notificationService'
import verificationService from '../services/verificationService'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

// 알림 타입별 아이콘 및 색상 매핑
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'application_draft_saved':
      return <EditOutlined style={{ color: '#8c8c8c' }} />
    case 'application_submitted':
    case 'APPLICATION_SUBMITTED':
      return <SendOutlined style={{ color: '#52c41a' }} />
    case 'APPLICATION_UPDATED':
      return <EditOutlined style={{ color: '#1890ff' }} />
    case 'SELECTION_RESULT':
    case 'selection_result':
      return <TrophyOutlined style={{ color: '#faad14' }} />
    case 'SUPPLEMENT_REQUEST':
    case 'supplement_request':
      return <WarningOutlined style={{ color: '#ff4d4f' }} />
    case 'SUPPLEMENT_SUBMITTED':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'PROJECT_UPDATE':
      return <BellOutlined style={{ color: '#1890ff' }} />
    case 'DEADLINE_REMINDER':
      return <ClockCircleOutlined style={{ color: '#ff7a45' }} />
    case 'REVIEW_COMPLETE':
    case 'review_complete':
      return <CheckCircleOutlined style={{ color: '#722ed1' }} />
    case 'verification_supplement_request':
      return <WarningOutlined style={{ color: '#ff4d4f' }} />
    case 'verification_completed':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    default:
      return <BellOutlined style={{ color: '#8c8c8c' }} />
  }
}

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
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

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

  // 알림 로드
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setLoadingNotifications(true)
        const data = await notificationService.getMyNotifications(false, 20)
        setNotifications(data)
      } catch (error) {
        console.error('알림 로드 실패:', error)
      } finally {
        setLoadingNotifications(false)
      }
    }
    loadNotifications()
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

      // 증빙 검토 대기 건수 (VERIFIER 또는 SUPER_ADMIN)
      let pendingVerifications = 0
      if (isVerifier || isSuperAdmin) {
        try {
          const verifications = await verificationService.getPendingVerifications()
          pendingVerifications = verifications.length
        } catch (error) {
          console.error('증빙 검토 건수 로드 실패:', error)
        }
      }

      setStats({
        myApplications,
        managedProjects,
        pendingVerifications,
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

      {/* 빠른 시작 + 최근 활동 Row */}
      <Row gutter={[16, 16]} className="mt-8">
        <Col xs={24} lg={12}>
          <Card title="빠른 시작">
            <div className="space-y-2">
              <Button type="primary" block onClick={() => navigate('/projects')}>
                모집중인 과제 보기
              </Button>
              <Button block onClick={() => navigate('/coach/competencies')}>
                내 역량 정보 관리
              </Button>
              {(isProjectManager || isSuperAdmin) && (
                <Button block onClick={() => navigate('/projects/create')}>
                  새 과제 만들기
                </Button>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="최근 활동">
            {loadingNotifications ? (
              <div className="text-center py-8">
                <Spin />
              </div>
            ) : notifications.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="아직 활동 내역이 없습니다."
              />
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                <Timeline
                  items={notifications.map((notification) => ({
                    dot: getNotificationIcon(notification.type),
                    children: (
                      <div
                        className={`cursor-pointer hover:bg-gray-50 p-2 rounded ${!notification.is_read ? 'bg-blue-50' : ''}`}
                        onClick={async () => {
                          // 알림 읽음 처리
                          if (!notification.is_read) {
                            await notificationService.markAsRead(notification.notification_id)
                            setNotifications(prev =>
                              prev.map(n =>
                                n.notification_id === notification.notification_id
                                  ? { ...n, is_read: true }
                                  : n
                              )
                            )
                          }
                          // 관련 페이지로 이동
                          if (notification.related_competency_id) {
                            navigate('/coach/competencies')
                          } else if (notification.related_application_id && notification.related_project_id) {
                            // 응모 서류 보완 요청인 경우 직접 수정 화면으로 이동
                            navigate(
                              `/projects/${notification.related_project_id}/apply?applicationId=${notification.related_application_id}&mode=edit`
                            )
                          } else if (notification.related_application_id) {
                            navigate('/my-applications')
                          } else if (notification.related_project_id) {
                            navigate('/projects')
                          }
                        }}
                      >
                        <Text strong={!notification.is_read}>{notification.title}</Text>
                        {notification.message && (
                          <Text className="block text-gray-500 text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                            {notification.message.length > 100
                              ? notification.message.substring(0, 100) + '...'
                              : notification.message}
                          </Text>
                        )}
                        <Text className="block text-gray-400 text-xs mt-1">
                          {dayjs(notification.created_at).fromNow()}
                        </Text>
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
