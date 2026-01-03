import { useState, useEffect } from 'react'
import { Typography, Tabs } from 'antd'
import {
  UserOutlined,
  FolderOutlined,
  AuditOutlined,
  TrophyOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'

// Import dashboard content components
import CoachDashboardContent from './CoachDashboard'
import ProjectManagementDashboard from './ProjectManagementDashboard'
import StaffDashboardContent from './StaffDashboard'
import EvaluationDashboard from './EvaluationDashboard'
import SuperAdminDashboard from './SuperAdminDashboard'

const { Title, Text } = Typography

// Role groups
const VERIFIER_ROLES = ['VERIFIER', 'REVIEWER', 'staff']
const SUPER_ADMIN_ROLES = ['SUPER_ADMIN']

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
  const hasVerifierAccess = userRoles.some(r => VERIFIER_ROLES.includes(r))
  const hasSuperAdminAccess = userRoles.some(r => SUPER_ADMIN_ROLES.includes(r))

  // Set default tab on mount
  useEffect(() => {
    if (!activeTab) {
      // 기본값: 과제참여 탭
      setActiveTab('participation')
    }
  }, [activeTab])

  // Build tabs array based on user roles
  // 탭 구조: 과제참여 | 과제관리 | 증빙검토 | 과제심사(다음phase) | 수퍼어드민
  const tabs = []

  // 1. 과제참여 (모든 코치)
  tabs.push({
    key: 'participation',
    label: (
      <span>
        <UserOutlined />
        과제참여
      </span>
    ),
    children: <CoachDashboardContent />
  })

  // 2. 과제관리 (모든 코치 - 본인 과제만 / SUPER_ADMIN - 전체)
  tabs.push({
    key: 'project-management',
    label: (
      <span>
        <FolderOutlined />
        과제관리
      </span>
    ),
    children: <ProjectManagementDashboard />
  })

  // 3. 증빙검토 (VERIFIER)
  if (hasVerifierAccess || hasSuperAdminAccess) {
    tabs.push({
      key: 'verification',
      label: (
        <span>
          <AuditOutlined />
          증빙검토
        </span>
      ),
      children: <StaffDashboardContent />
    })
  }

  // 4. 과제심사 (심사위원으로 할당된 사용자 또는 SUPER_ADMIN)
  if (hasVerifierAccess || hasSuperAdminAccess) {
    tabs.push({
      key: 'evaluation',
      label: (
        <span>
          <TrophyOutlined />
          과제심사
        </span>
      ),
      children: <EvaluationDashboard />
    })
  }

  // 5. 수퍼어드민 (SUPER_ADMIN only)
  if (hasSuperAdminAccess) {
    tabs.push({
      key: 'super-admin',
      label: (
        <span>
          <SettingOutlined />
          수퍼어드민
        </span>
      ),
      children: <SuperAdminDashboard />
    })
  }

  // If only one tab, don't show tabs - just show the dashboard directly
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
