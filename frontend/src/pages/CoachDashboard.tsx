import { Typography, Card, Row, Col, Button, Alert, message, Timeline, Spin, Empty } from 'antd'
import { useAuthStore } from '../stores/authStore'
import {
  FileTextOutlined, CheckCircleOutlined, UserOutlined, InfoCircleOutlined,
  SendOutlined, EditOutlined, TrophyOutlined, WarningOutlined, BellOutlined, ClockCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import notificationService, { Notification } from '../services/notificationService'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const { Title, Text } = Typography

// 알림 타입별 아이콘 및 색상 매핑
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'APPLICATION_SUBMITTED':
      return <SendOutlined style={{ color: '#52c41a' }} />
    case 'APPLICATION_UPDATED':
      return <EditOutlined style={{ color: '#1890ff' }} />
    case 'SELECTION_RESULT':
      return <TrophyOutlined style={{ color: '#faad14' }} />
    case 'SUPPLEMENT_REQUEST':
      return <WarningOutlined style={{ color: '#ff4d4f' }} />
    case 'SUPPLEMENT_SUBMITTED':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'PROJECT_UPDATE':
      return <BellOutlined style={{ color: '#1890ff' }} />
    case 'DEADLINE_REMINDER':
      return <ClockCircleOutlined style={{ color: '#ff7a45' }} />
    case 'REVIEW_COMPLETE':
      return <CheckCircleOutlined style={{ color: '#722ed1' }} />
    // 증빙 검증 관련
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

  useEffect(() => {
    // 세부정보 입력 여부 확인 (예: CoachProfile이 없는 경우)
    // 현재는 간단히 coaching_fields가 없으면 세부정보 미입력으로 판단
    if (user && (!user.coaching_fields || user.coaching_fields === '[]' || user.coaching_fields === 'null')) {
      setNeedsDetailedProfile(true)
    }
  }, [user])

  // 최근 활동 (알림) 로드
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setLoadingNotifications(true)
        const data = await notificationService.getMyNotifications(false, 10)
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
          <Timeline
            items={notifications.map((notification) => ({
              dot: getNotificationIcon(notification.type),
              children: (
                <div
                  className={`cursor-pointer hover:bg-gray-50 p-2 rounded -m-2 ${!notification.is_read ? 'font-medium' : ''}`}
                  onClick={() => {
                    // 알림 읽음 처리
                    if (!notification.is_read) {
                      notificationService.markAsRead(notification.notification_id)
                    }
                    // 관련 페이지로 이동
                    if (notification.related_competency_id) {
                      // 증빙 관련 알림 - 역량/세부정보 페이지로 이동
                      navigate('/coach/competencies')
                    } else if (notification.related_application_id) {
                      navigate(`/coach/my-applications`)
                    } else if (notification.related_project_id) {
                      navigate(`/coach/projects`)
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className={!notification.is_read ? 'text-blue-600' : ''}>
                        {notification.title}
                      </div>
                      {notification.message && (
                        <div className="text-gray-500 text-sm mt-1">
                          {notification.message}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs whitespace-nowrap ml-4">
                      {dayjs(notification.created_at).fromNow()}
                    </div>
                  </div>
                </div>
              )
            }))}
          />
        )}
      </Card>
    </div>
  )
}
