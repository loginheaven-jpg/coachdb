import { Layout, Menu, Dropdown, Button, Avatar } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { UserOutlined, LogoutOutlined, SettingOutlined, LoginOutlined } from '@ant-design/icons'
import authService from '../../services/authService'
import { message } from 'antd'
import type { MenuProps } from 'antd'

const { Header, Content } = Layout

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const userRoles = user ? (JSON.parse(user.roles) as string[]) : []

  const handleLogout = () => {
    authService.logout()
    logout()
    message.success('로그아웃되었습니다.')
    navigate('/login')
  }

  // 역할별 메뉴 아이템 생성
  const menuItems: MenuProps['items'] = []

  // Admin 메뉴
  if (userRoles.includes('admin')) {
    menuItems.push({
      key: 'admin-dashboard',
      label: '관리자 대시보드',
      onClick: () => navigate('/admin/dashboard')
    })
    menuItems.push({
      key: 'admin-projects',
      label: '과제 관리',
      onClick: () => navigate('/admin/projects')
    })
  }

  // Staff 메뉴
  if (userRoles.includes('staff')) {
    menuItems.push({
      key: 'staff-dashboard',
      label: '심사위원 대시보드',
      onClick: () => navigate('/staff/dashboard')
    })
  }

  // Coach 메뉴
  if (userRoles.includes('coach')) {
    menuItems.push({
      key: 'coach-dashboard',
      label: '코치 대시보드',
      onClick: () => navigate('/coach/dashboard')
    })
    menuItems.push({
      key: 'coach-projects',
      label: '과제 지원',
      onClick: () => navigate('/coach/projects')
    })
    menuItems.push({
      key: 'coach-applications',
      label: '내 지원서',
      onClick: () => navigate('/coach/my-applications')
    })
  }

  // 현재 경로에서 선택된 메뉴 키 결정
  const getSelectedKey = () => {
    const path = location.pathname
    if (path.startsWith('/admin/dashboard')) return 'admin-dashboard'
    if (path.startsWith('/admin/projects')) return 'admin-projects'
    if (path.startsWith('/staff/dashboard')) return 'staff-dashboard'
    if (path.startsWith('/coach/dashboard')) return 'coach-dashboard'
    if (path.startsWith('/coach/projects')) return 'coach-projects'
    if (path.startsWith('/coach/my-applications')) return 'coach-applications'
    return ''
  }

  // 사용자 드롭다운 메뉴
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: '프로필 수정',
      onClick: () => navigate('/profile/edit')
    },
    {
      key: 'competencies',
      icon: <UserOutlined />,
      label: '세부정보 관리',
      onClick: () => navigate('/coach/competencies')
    },
    {
      type: 'divider'
    },
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
            className="cursor-pointer"
            onClick={() => {
              if (!user) {
                navigate('/')
              } else if (userRoles.includes('admin')) {
                navigate('/admin/dashboard')
              } else if (userRoles.includes('staff')) {
                navigate('/staff/dashboard')
              } else if (userRoles.includes('coach')) {
                navigate('/coach/dashboard')
              } else {
                navigate('/')
              }
            }}
          >
            <span className="text-xl font-bold text-blue-600">PPMS</span>
            <span className="text-xs text-gray-500 ml-2 hidden md:inline">Project & coach Profile Management System</span>
          </div>

          {user && menuItems.length > 0 && (
            <Menu
              mode="horizontal"
              selectedKeys={[getSelectedKey()]}
              items={menuItems}
              style={{ flex: 1, minWidth: 0, border: 'none' }}
            />
          )}
        </div>

        {user ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" className="flex items-center gap-2">
              <Avatar icon={<UserOutlined />} size="small" />
              <span>{user.name}</span>
            </Button>
          </Dropdown>
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
