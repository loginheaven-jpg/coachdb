import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Popover, Dropdown, Avatar, List, Typography, Empty, Spin, Drawer } from 'antd'
import { UserOutlined, LogoutOutlined, BellOutlined, HomeOutlined, MenuOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import type { Notification } from '../../services/notificationService'
import dayjs from 'dayjs'
import './KCATopbar.css'

const { Text } = Typography

interface TopbarLink {
  key: string
  label: string
  path: string
  visible: boolean
}

interface KCATopbarProps {
  links: TopbarLink[]
  selectedKey: string
  userName?: string
  onLogout: () => void
  // Notification props
  notifications?: Notification[]
  unreadCount?: number
  loadingNotifications?: boolean
  popoverVisible?: boolean
  onPopoverVisibleChange?: (visible: boolean) => void
  onNotificationClick?: (notification: Notification) => void
  onMarkAllAsRead?: () => void
  getNotificationIcon?: (type: string) => React.ReactNode
}

export default function KCATopbar({
  links,
  selectedKey,
  userName,
  onLogout,
  notifications = [],
  unreadCount = 0,
  loadingNotifications = false,
  popoverVisible = false,
  onPopoverVisibleChange,
  onNotificationClick,
  onMarkAllAsRead,
  getNotificationIcon,
}: KCATopbarProps) {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: onLogout,
    },
  ]

  // Notification popover content
  const notificationContent = (
    <div style={{ width: 350 }}>
      <div className="flex justify-between items-center mb-2 pb-2 border-b">
        <Text strong>알림</Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={onMarkAllAsRead}>
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
              onClick={() => onNotificationClick?.(notification)}
            >
              <List.Item.Meta
                avatar={getNotificationIcon?.(notification.type)}
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
            onPopoverVisibleChange?.(false)
            navigate('/dashboard')
          }}
        >
          전체 보기
        </Button>
      </div>
    </div>
  )

  return (
    <header className="kca-topbar">
      {/* Logo */}
      <a className="kca-topbar-logo" onClick={() => navigate('/dashboard')}>
        <div className="logo-pcms">
          P<span className="logo-c-dot">C</span>MS
        </div>
        <div className="logo-names">
          <div className="logo-name-kr">(사) 한국코치협회 과제&코치풀관리시스템</div>
          <div className="logo-name-en">Project & Coach pool Management System</div>
        </div>
      </a>

      {/* Desktop Navigation */}
      <nav className="kca-topbar-nav kca-topbar-nav-desktop">
        {links
          .filter((link) => link.visible)
          .map((link) => (
            <a
              key={link.key}
              className={selectedKey === link.key ? 'active' : ''}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </a>
          ))}
      </nav>

      {/* Right Section */}
      <div className="kca-topbar-right">
        {/* Mobile Menu Button */}
        <Button
          type="text"
          icon={<MenuOutlined style={{ fontSize: 20 }} />}
          className="kca-mobile-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
        />

        {/* Notification Bell */}
        {userName && onPopoverVisibleChange && (
          <Popover
            content={notificationContent}
            trigger="click"
            placement="bottomRight"
            open={popoverVisible}
            onOpenChange={onPopoverVisibleChange}
          >
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                className="kca-notification-btn"
              />
            </Badge>
          </Popover>
        )}

        {/* User Dropdown */}
        {userName && (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <button className="kca-topbar-login">
              <UserOutlined />
              <span className="kca-username">{userName}</span>
            </button>
          </Dropdown>
        )}
      </div>

      {/* Mobile Menu Drawer */}
      <Drawer
        title="메뉴"
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={280}
      >
        <div className="kca-mobile-nav">
          {links
            .filter((link) => link.visible)
            .map((link) => (
              <a
                key={link.key}
                className={selectedKey === link.key ? 'active' : ''}
                onClick={() => {
                  navigate(link.path)
                  setMobileMenuOpen(false)
                }}
              >
                {link.label}
              </a>
            ))}
        </div>
      </Drawer>
    </header>
  )
}
