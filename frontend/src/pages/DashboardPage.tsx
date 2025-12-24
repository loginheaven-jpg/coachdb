import { useState, useEffect } from 'react'
import { Typography, Tabs } from 'antd'
import {
  UserOutlined,
  TeamOutlined,
  AuditOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'

// Import existing dashboard content components
import AdminDashboardContent from './AdminDashboard'
import CoachDashboardContent from './CoachDashboard'
import StaffDashboardContent from './StaffDashboard'

const { Title, Text } = Typography

// Role groups
const ADMIN_ROLES = ['SUPER_ADMIN', 'PROJECT_MANAGER', 'admin']
const VERIFIER_ROLES = ['VERIFIER', 'REVIEWER', 'staff']
const COACH_ROLES = ['COACH', 'coach']

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<string>('')

  // Get user's roles
  const getUserRoles = (): string[] => {
    try {
      return JSON.parse(user?.roles || '[]')
    } catch {
      return []
    }
  }

  const userRoles = getUserRoles()

  // Determine which tabs to show based on user roles
  const hasAdminAccess = userRoles.some(r => ADMIN_ROLES.includes(r))
  const hasVerifierAccess = userRoles.some(r => VERIFIER_ROLES.includes(r))
  const hasCoachAccess = userRoles.some(r => COACH_ROLES.includes(r))

  // Set default tab on mount
  useEffect(() => {
    if (!activeTab) {
      if (hasAdminAccess) setActiveTab('admin')
      else if (hasVerifierAccess) setActiveTab('staff')
      else if (hasCoachAccess) setActiveTab('coach')
    }
  }, [hasAdminAccess, hasVerifierAccess, hasCoachAccess, activeTab])

  // Build tabs array based on user roles
  const tabs = []

  if (hasCoachAccess) {
    tabs.push({
      key: 'coach',
      label: (
        <span>
          <UserOutlined />
          응모자 대시보드
        </span>
      ),
      children: <CoachDashboardContent />
    })
  }

  if (hasAdminAccess) {
    tabs.push({
      key: 'admin',
      label: (
        <span>
          <TeamOutlined />
          관리자 대시보드
        </span>
      ),
      children: <AdminDashboardContent />
    })
  }

  if (hasVerifierAccess) {
    // Verifier/Reviewer 역할이 있으면 항상 탭 표시
    tabs.push({
      key: 'staff',
      label: (
        <span>
          <AuditOutlined />
          검토자 대시보드
        </span>
      ),
      children: <StaffDashboardContent />
    })
  }

  // If user has only one role, don't show tabs - just show the dashboard directly
  if (tabs.length === 1) {
    return tabs[0].children
  }

  // If no tabs (shouldn't happen for authenticated users), show error
  if (tabs.length === 0) {
    return (
      <div className="p-8 text-center">
        <Title level={3}>접근 권한이 없습니다</Title>
        <Text>대시보드에 접근할 수 있는 역할이 할당되지 않았습니다.</Text>
      </div>
    )
  }

  return (
    <div className="px-8 pt-4">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        className="application-tabs"
        items={tabs}
        size="large"
      />
    </div>
  )
}
