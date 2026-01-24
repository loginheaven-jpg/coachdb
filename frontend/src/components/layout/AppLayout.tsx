import { useState, useEffect } from 'react'
import { Layout, Menu, Dropdown, Button, Avatar, Badge, Popover, List, Typography, Empty, Spin } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  UserOutlined, LogoutOutlined, SettingOutlined, LoginOutlined, FolderOutlined,
  FileTextOutlined, AuditOutlined, TrophyOutlined, ToolOutlined, BellOutlined,
  SendOutlined, EditOutlined, WarningOutlined, ClockCircleOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import authService from '../../services/authService'
import notificationService, { Notification } from '../../services/notificationService'
import { message } from 'antd'
import type { MenuProps } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const { Text } = Typography

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

const { Header, Content } = Layout

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
}

export default function AppLayout({ children }: AppLayoutProps) {
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

  // 역할별 메뉴 아이템 생성
  const menuItems: MenuProps['items'] = []

  // 1. 과제참여 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    menuItems.push({
      key: 'projects',
      label: '과제참여',
      onClick: () => navigate('/projects')
    })
  }

  // 2. 과제관리 (PROJECT_MANAGER 또는 SUPER_ADMIN)
  if (isProjectManager || isSuperAdmin) {
    menuItems.push({
      key: 'projects-manage',
      label: '과제관리',
      onClick: () => navigate('/projects/manage')
    })
  }

  // 3. 증빙검토 (VERIFIER 또는 SUPER_ADMIN)
  if (isVerifier || isSuperAdmin) {
    menuItems.push({
      key: 'verifications',
      label: '증빙검토',
      onClick: () => navigate('/admin/verifications')
    })
  }

  // 4. 과제심사 (REVIEWER 또는 SUPER_ADMIN)
  if (isReviewer || isSuperAdmin) {
    menuItems.push({
      key: 'evaluations',
      label: '과제심사',
      onClick: () => navigate('/evaluations')
    })
  }

  // 5. 시스템관리 (SUPER_ADMIN only)
  if (isSuperAdmin) {
    menuItems.push({
      key: 'admin',
      label: '시스템관리',
      onClick: () => navigate('/admin/users')
    })
  }

  // 6. 나의 정보 (모든 로그인 사용자 - 우측)
  if (userRoles.length > 0) {
    menuItems.push({
      key: 'my-info',
      label: '나의 정보',
      onClick: () => navigate('/profile/edit')
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

  // 사용자 드롭다운 메뉴 (로그아웃만)
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout
    }
  ]

  return (
    <Layout className="min-h-screen">
      <Header className="flex items-center justify-between px-8 bg-white shadow-sm">
        <div className="flex items-center gap-8">
          <div
            className="cursor-pointer flex flex-col"
            onClick={() => {
              if (!user) {
                navigate('/')
              } else {
                // 통합 대시보드로 이동
                navigate('/dashboard')
              }
            }}
          >
            <span className="text-xl font-bold text-blue-600 leading-tight">PCMS</span>
            <span className="text-[10px] text-gray-400 leading-tight">Project & Coach pool Management System</span>
          </div>

          {user && menuItems.length > 0 && (
            <Menu
              mode="horizontal"
              selectedKeys={[getSelectedKey()]}
              items={menuItems}
              style={{ border: 'none', flexShrink: 0 }}
            />
          )}
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            {/* 알림 아이콘 */}
            <Popover
              content={
                <div style={{ width: 350 }}>
                  <div className="flex justify-between items-center mb-2 pb-2 border-b">
                    <Text strong>알림</Text>
                    {unreadCount > 0 && (
                      <Button type="link" size="small" onClick={handleMarkAllAsRead}>
                        모두 읽음
                      </Button>
                    )}
                  </div>
                  {loadingNotifications ? (
                    <div className="text-center py-4">
                      <Spin size="small" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="새 알림이 없습니다"
                      style={{ margin: '16px 0' }}
                    />
                  ) : (
                    <List
                      size="small"
                      dataSource={notifications}
                      style={{ maxHeight: 300, overflowY: 'auto' }}
                      renderItem={(notification) => (
                        <List.Item
                          className={`cursor-pointer hover:bg-gray-50 ${!notification.is_read ? 'bg-blue-50' : ''}`}
                          style={{ padding: '8px 4px' }}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <List.Item.Meta
                            avatar={getNotificationIcon(notification.type)}
                            title={<Text strong={!notification.is_read}>{notification.title}</Text>}
                            description={
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {dayjs(notification.created_at).fromNow()}
                              </Text>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                  <div className="pt-2 mt-2 border-t text-center">
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setPopoverVisible(false)
                        navigate('/dashboard')
                      }}
                    >
                      전체 보기
                    </Button>
                  </div>
                </div>
              }
              title={null}
              trigger="click"
              open={popoverVisible}
              onOpenChange={handlePopoverVisibleChange}
              placement="bottomRight"
            >
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<BellOutlined style={{ fontSize: 18 }} />}
                  className="flex items-center justify-center"
                />
              </Badge>
            </Popover>

            {/* 사용자 드롭다운 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" className="flex items-center gap-2">
                <Avatar icon={<UserOutlined />} size="small" />
                <span>{user.name}</span>
              </Button>
            </Dropdown>
          </div>
        ) : (
          <Button
            type="text"
            icon={<LoginOutlined />}
            onClick={() => navigate('/login')}
          >
            로그인
          </Button>
        )}
      </Header>

      <Content className="bg-gray-100">
        {children}
      </Content>
    </Layout>
  )
}
