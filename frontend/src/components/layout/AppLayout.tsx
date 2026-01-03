import { Layout, Menu, Dropdown, Button, Avatar } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { UserOutlined, LogoutOutlined, SettingOutlined, LoginOutlined, FolderOutlined, FileTextOutlined, AuditOutlined, TrophyOutlined, ToolOutlined } from '@ant-design/icons'
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

  // 2. 내 지원서 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    menuItems.push({
      key: 'my-applications',
      label: '내 지원서',
      onClick: () => navigate('/my-applications')
    })
  }

  // 3. 세부정보 (모든 로그인 사용자)
  if (userRoles.length > 0) {
    menuItems.push({
      key: 'competencies',
      label: '세부정보',
      onClick: () => navigate('/coach/competencies')
    })
  }

  // 4. 과제관리 (PROJECT_MANAGER 또는 SUPER_ADMIN)
  if (isProjectManager || isSuperAdmin) {
    menuItems.push({
      key: 'projects-manage',
      label: '과제관리',
      onClick: () => navigate('/projects/manage')
    })
  }

  // 5. 증빙검토 (VERIFIER 또는 SUPER_ADMIN)
  if (isVerifier || isSuperAdmin) {
    menuItems.push({
      key: 'verifications',
      label: '증빙검토',
      onClick: () => navigate('/admin/verifications')
    })
  }

  // 6. 과제심사 (REVIEWER 또는 SUPER_ADMIN)
  if (isReviewer || isSuperAdmin) {
    menuItems.push({
      key: 'evaluations',
      label: '과제심사',
      onClick: () => navigate('/evaluations')
    })
  }

  // 7. 시스템관리 (SUPER_ADMIN only)
  if (isSuperAdmin) {
    menuItems.push({
      key: 'admin',
      label: '시스템관리',
      onClick: () => navigate('/admin/users')
    })
  }

  // 현재 경로에서 선택된 메뉴 키 결정
  const getSelectedKey = () => {
    const path = location.pathname
    if (path.startsWith('/projects/manage') || path.startsWith('/admin/projects')) return 'projects-manage'
    if (path.startsWith('/projects') || path.startsWith('/coach/projects')) return 'projects'
    if (path.startsWith('/my-applications') || path.startsWith('/coach/my-applications')) return 'my-applications'
    if (path.startsWith('/coach/competencies') || path.startsWith('/profile/detailed')) return 'competencies'
    if (path.startsWith('/admin/verifications')) return 'verifications'
    if (path.startsWith('/evaluations')) return 'evaluations'
    if (path.startsWith('/admin/users')) return 'admin'
    return ''
  }

  // 사용자 드롭다운 메뉴 (프로필 수정 + 로그아웃만)
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: '프로필 수정',
      onClick: () => navigate('/profile/edit')
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
            <span className="text-xl font-bold text-blue-600 leading-tight">PPMS</span>
            <span className="text-[10px] text-gray-400 leading-tight">Project & coach Profile Management System</span>
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
