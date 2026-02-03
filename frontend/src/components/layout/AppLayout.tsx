import { useState, useEffect } from 'react'
import { Layout } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  SendOutlined, WarningOutlined, CheckCircleOutlined, TrophyOutlined, BellOutlined
} from '@ant-design/icons'
import authService from '../../services/authService'
import notificationService, { Notification } from '../../services/notificationService'
import { message } from 'antd'
import KCATopbar from './KCATopbar'
import KCASubnav, { SubnavItem } from './KCASubnav'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const { Content } = Layout

// 알림 타입별 아이콘
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'application_submitted':
    case 'APPLICATION_SUBMITTED':
      return <SendOutlined style={{ color: '#52c41a' }} />
    case 'SELECTION_RESULT':
    case 'selection_result':
      return <TrophyOutlined style={{ color: '#faad14' }} />
    case 'SUPPLEMENT_REQUEST':
    case 'supplement_request':
    case 'verification_supplement_request':
      return <WarningOutlined style={{ color: '#ff4d4f' }} />
    case 'REVIEW_COMPLETE':
    case 'review_complete':
    case 'verification_completed':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    default:
      return <BellOutlined style={{ color: '#8c8c8c' }} />
  }
}

// 안전한 roles 파싱 헬퍼 함수
const parseUserRoles = (roles: string | null | undefined): string[] => {
  if (!roles) return []
  try {
    const parsed = JSON.parse(roles)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error('[AppLayout] Failed to parse user roles:', roles)
    return []
  }
}

interface AppLayoutProps {
  children: React.ReactNode
  showSubnav?: boolean
  subnavItems?: SubnavItem[]
}

export default function AppLayout({
  children,
  showSubnav = false,
  subnavItems = []
}: AppLayoutProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // 알림 상태
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [popoverVisible, setPopoverVisible] = useState(false)

  const userRoles = parseUserRoles(user?.roles)

  // 알림 개수 로드 (주기적 갱신)
  useEffect(() => {
    if (!user) return

    const loadUnreadCount = async () => {
      try {
        const count = await notificationService.getUnreadCount()
        setUnreadCount(count)
      } catch (error) {
        console.error('알림 개수 로드 실패:', error)
      }
    }

    loadUnreadCount()
    // 30초마다 갱신
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Popover 열릴 때 알림 목록 로드
  const handlePopoverVisibleChange = async (visible: boolean) => {
    setPopoverVisible(visible)
    if (visible && user) {
      setLoadingNotifications(true)
      try {
        const data = await notificationService.getMyNotifications(false, 10)
        setNotifications(data)
      } catch (error) {
        console.error('알림 목록 로드 실패:', error)
      } finally {
        setLoadingNotifications(false)
      }
    }
  }

  // 알림 클릭 처리
  const handleNotificationClick = async (notification: Notification) => {
    // 읽음 처리
    if (!notification.is_read) {
      await notificationService.markAsRead(notification.notification_id)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev =>
        prev.map(n =>
          n.notification_id === notification.notification_id
            ? { ...n, is_read: true }
            : n
        )
      )
    }
    setPopoverVisible(false)
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
    } else {
      navigate('/dashboard')
    }
  }

  // 모두 읽음 처리
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (error) {
      console.error('모두 읽음 처리 실패:', error)
    }
  }

  const handleLogout = () => {
    authService.logout()
    logout()
    message.success('로그아웃되었습니다.')
    navigate('/login')
  }

  // 역할 체크 헬퍼
  const hasRole = (role: string) => userRoles.includes(role)
  const isSuperAdmin = hasRole('SUPER_ADMIN')
  const isProjectManager = hasRole('PROJECT_MANAGER')
  const isVerifier = hasRole('VERIFIER')
  const isReviewer = hasRole('REVIEWER')

  // 역할별 topbar links 생성
  const topbarLinks = []

  // 1. 과제참여 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    topbarLinks.push({
      key: 'projects',
      label: '과제참여',
      path: '/projects',
      visible: true
    })
  }

  // 2. 과제관리 (PROJECT_MANAGER 또는 SUPER_ADMIN)
  if (isProjectManager || isSuperAdmin) {
    topbarLinks.push({
      key: 'projects-manage',
      label: '과제관리',
      path: '/projects/manage',
      visible: true
    })
  }

  // 3. 증빙검토 (VERIFIER 또는 SUPER_ADMIN)
  if (isVerifier || isSuperAdmin) {
    topbarLinks.push({
      key: 'verifications',
      label: '증빙검토',
      path: '/admin/verifications',
      visible: true
    })
  }

  // 4. 과제심사 (REVIEWER 또는 SUPER_ADMIN)
  if (isReviewer || isSuperAdmin) {
    topbarLinks.push({
      key: 'evaluations',
      label: '과제심사',
      path: '/evaluations',
      visible: true
    })
  }

  // 5. 시스템관리 (SUPER_ADMIN only)
  if (isSuperAdmin) {
    topbarLinks.push({
      key: 'admin',
      label: '시스템관리',
      path: '/admin/users',
      visible: true
    })
  }

  // 6. 나의 정보 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    topbarLinks.push({
      key: 'my-info',
      label: '나의 정보',
      path: '/profile/edit',
      visible: true
    })
  }

  // 현재 경로에서 선택된 메뉴 키 결정
  const getSelectedKey = () => {
    const path = location.pathname
    if (path.startsWith('/projects/manage') || path.startsWith('/admin/projects')) return 'projects-manage'
    if (path.startsWith('/projects') || path.startsWith('/coach/projects')) return 'projects'
    if (path.startsWith('/profile/edit')) return 'my-info'
    if (path.startsWith('/admin/verifications')) return 'verifications'
    if (path.startsWith('/evaluations')) return 'evaluations'
    if (path.startsWith('/admin/users')) return 'admin'
    return ''
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {user && (
        <KCATopbar
          links={topbarLinks}
          selectedKey={getSelectedKey()}
          userName={user.name}
          onLogout={handleLogout}
          notifications={notifications}
          unreadCount={unreadCount}
          loadingNotifications={loadingNotifications}
          popoverVisible={popoverVisible}
          onPopoverVisibleChange={handlePopoverVisibleChange}
          onNotificationClick={handleNotificationClick}
          onMarkAllAsRead={handleMarkAllAsRead}
          getNotificationIcon={getNotificationIcon}
        />
      )}

      {showSubnav && (
        <KCASubnav
          items={subnavItems}
          onHomeClick={() => navigate('/dashboard')}
        />
      )}

      <Content
        style={{
          marginTop: showSubnav ? '130px' : (user ? '80px' : '0'),
          background: 'var(--kca-bg-page)',
          minHeight: 'calc(100vh - 80px)',
        }}
      >
        {children}
      </Content>
    </Layout>
  )
}
