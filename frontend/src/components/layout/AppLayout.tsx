import { Layout, Menu, Dropdown, Button, Avatar } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { UserOutlined, LogoutOutlined, SettingOutlined, LoginOutlined, TeamOutlined, FolderOpenOutlined, FileTextOutlined, ToolOutlined } from '@ant-design/icons'
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

  // 역할 체크 헬퍼
  const hasRole = (role: string) => userRoles.includes(role)
  const isProjectManager = hasRole('SUPER_ADMIN') || hasRole('PROJECT_MANAGER') || hasRole('VERIFIER') || hasRole('REVIEWER') || hasRole('admin')

  // 역할별 메뉴 아이템 생성
  const menuItems: MenuProps['items'] = []

  // 대시보드 메뉴 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    menuItems.push({
      key: 'dashboard',
      label: '대시보드',
      onClick: () => navigate('/dashboard')
    })
  }

  // 과제참여 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    menuItems.push({
      key: 'projects-participate',
      label: '과제참여',
      onClick: () => navigate('/projects')
    })
  }

  // 과제관리 (PROJECT_MANAGER 이상)
  if (isProjectManager) {
    menuItems.push({
      key: 'projects-manage',
      label: '과제관리',
      onClick: () => navigate('/projects/manage')
    })
  }

  // 내 지원서 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    menuItems.push({
      key: 'my-applications',
      label: '내 지원서',
      onClick: () => navigate('/my-applications')
    })
  }

  // 현재 경로에서 선택된 메뉴 키 결정
  const getSelectedKey = () => {
    const path = location.pathname
    if (path === '/dashboard' || path.startsWith('/admin/dashboard') || path.startsWith('/coach/dashboard') || path.startsWith('/staff/dashboard')) return 'dashboard'
    if (path.startsWith('/projects/manage') || path.startsWith('/admin/projects')) return 'projects-manage'
    if (path.startsWith('/projects') || path.startsWith('/coach/projects')) return 'projects-participate'
    if (path.startsWith('/my-applications') || path.startsWith('/coach/my-applications')) return 'my-applications'
    return ''
  }

  // SUPER_ADMIN 권한 체크
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN')

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
    // SUPER_ADMIN만 사용자 관리 메뉴 표시
    ...(isSuperAdmin ? [
      {
        type: 'divider' as const
      },
      {
        key: 'user-management',
        icon: <TeamOutlined />,
        label: '사용자 관리',
        onClick: () => navigate('/admin/users')
      }
    ] : []),
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
              } else {
                // 통합 대시보드로 이동
                navigate('/dashboard')
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
