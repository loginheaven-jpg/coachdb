import { Typography, Card, Row, Col, Button, Alert, Statistic, Timeline, Spin, Empty } from 'antd'
import { useAuthStore } from '../stores/authStore'
import {
  FileTextOutlined, CheckCircleOutlined, UserOutlined, InfoCircleOutlined,
  SendOutlined, EditOutlined, TrophyOutlined, WarningOutlined, BellOutlined,
  ClockCircleOutlined, SettingOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import notificationService, { Notification } from '../services/notificationService'
import applicationService, { CoachStats } from '../services/applicationService'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const { Title, Text } = Typography

// 알림 타입별 아이콘 및 색상 매핑
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
    case 'PROJECT_UPDATE':
      return <BellOutlined style={{ color: '#1890ff' }} />
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

export default function CoachDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [needsDetailedProfile, setNeedsDetailedProfile] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [stats, setStats] = useState<CoachStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    // 세부정보 입력 여부 확인
    if (user && (!user.coaching_fields || user.coaching_fields === '[]' || user.coaching_fields === 'null')) {
      setNeedsDetailedProfile(true)
    }
  }, [user])

  // 통계 로드
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoadingStats(true)
        const data = await applicationService.getMyStats()
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

  return (
    <div className="p-8">
      <div className="mb-4">
        <Title level={2} className="mb-0">응모자 대시보드</Title>
        <Text className="block text-gray-600">
          환영합니다, {user?.name}님! - PPMS (Project & coach Profile Management System)
        </Text>
      </div>

      {needsDetailedProfile && (
        <Alert
          message="프로필을 완성해주세요"
          description="더 나은 서비스 제공을 위해 역량 정보를 입력해주세요. 학력, 경력, 자격증 등의 정보를 관리할 수 있습니다."
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
          action={
            <Button size="small" type="primary" onClick={() => navigate('/coach/competencies')}>
              역량 정보 입력
            </Button>
          }
          closable
          onClose={() => setNeedsDetailedProfile(false)}
          className="mb-6"
        />
      )}

      {/* 통계 카드 Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="내 지원서"
              value={stats?.total_applications ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="선발됨"
              value={stats?.selected_count ?? 0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="심사중"
              value={stats?.pending_count ?? 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loadingStats}>
            <Statistic
              title="보완필요"
              value={stats?.supplement_count ?? 0}
              prefix={<WarningOutlined />}
              valueStyle={stats?.supplement_count ? { color: '#ff4d4f' } : undefined}
            />
          </Card>
        </Col>
      </Row>

      {/* 빠른 작업 + 최근 활동 Row */}
      <Row gutter={[16, 16]} className="mt-8">
        <Col xs={24} md={12}>
          <Card title="빠른 작업">
            <div className="space-y-2">
              <Button type="primary" block onClick={() => navigate('/projects')}>
                과제 지원하기
              </Button>
              <Button block onClick={() => navigate('/coach/my-applications')}>
                내 지원서 확인
              </Button>
              <Button block icon={<SettingOutlined />} onClick={() => navigate('/profile/edit')}>
                기본정보 수정
              </Button>
              <Button block icon={<UserOutlined />} onClick={() => navigate('/coach/competencies')}>
                역량 정보 관리
              </Button>
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
                          } else if (notification.related_application_id) {
                            navigate('/coach/my-applications')
                          } else if (notification.related_project_id) {
                            navigate('/projects')
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
