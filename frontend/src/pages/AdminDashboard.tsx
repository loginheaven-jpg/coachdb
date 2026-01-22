import { Typography, Card, Row, Col, Button, Statistic, Timeline, Spin, Empty } from 'antd'
import { useAuthStore } from '../stores/authStore'
import {
  FolderOpenOutlined, UserOutlined, FileTextOutlined, CheckCircleOutlined,
  SettingOutlined, WarningOutlined, BellOutlined,
  SendOutlined, EditOutlined, TrophyOutlined, ClockCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import notificationService, { Notification } from '../services/notificationService'
import adminService, { DashboardStats } from '../services/adminService'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const { Title, Text } = Typography

// 알림 타입별 아이콘 매핑
const getNotificationIcon = (type: string) => {
  switch (type) {
    // 응모 관련
    case 'application_draft_saved':
      return <EditOutlined style={{ color: '#8c8c8c' }} />
    case 'application_submitted':
    case 'APPLICATION_SUBMITTED':
      return <SendOutlined style={{ color: '#52c41a' }} />
    case 'APPLICATION_UPDATED':
      return <EditOutlined style={{ color: '#1890ff' }} />
    // 선발 관련
    case 'SELECTION_RESULT':
    case 'selection_result':
      return <TrophyOutlined style={{ color: '#faad14' }} />
    // 보충 요청
    case 'SUPPLEMENT_REQUEST':
    case 'supplement_request':
      return <WarningOutlined style={{ color: '#ff4d4f' }} />
    case 'SUPPLEMENT_SUBMITTED':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'DEADLINE_REMINDER':
      return <ClockCircleOutlined style={{ color: '#ff7a45' }} />
    // 심사/검증 관련
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

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // 대시보드 통계 로드
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoadingStats(true)
        const data = await adminService.getDashboardStats()
        setStats(data)
      } catch (error) {
        console.error('통계 로드 실패:', error)
      } finally {
        setLoadingStats(false)
      }
    }
    loadStats()
  }, [])

  // 최근 활동 (알림) 로드
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

  return (
    <div className="p-8">
        <div className="mb-4">
          <Title level={2} className="mb-0">관리자 대시보드</Title>
          <Text className="block text-gray-600">
            환영합니다, {user?.name}님! - PCMS (Project & Coach pool Management System)
          </Text>
        </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="전체 과제"
              value={stats?.total_projects ?? 0}
              prefix={<FolderOpenOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="등록된 응모자"
              value={stats?.total_coaches ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="전체 지원서"
              value={stats?.total_applications ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="심사 대기"
              value={stats?.pending_review_count ?? 0}
              prefix={<ClockCircleOutlined />}
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
              <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                <Timeline
                  items={notifications.map((notification) => ({
                    dot: getNotificationIcon(notification.type),
                    children: (
                      <div
                        className={`cursor-pointer hover:bg-gray-50 p-2 rounded ${!notification.is_read ? 'bg-blue-50' : ''}`}
                        onClick={async () => {
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
                        }}
                      >
                        <Text strong={!notification.is_read}>{notification.title}</Text>
                        {notification.message && (
                          <Text className="block text-gray-500 text-sm">{notification.message}</Text>
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
