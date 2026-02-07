import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from 'antd'
import {
  UserOutlined,
  SettingOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import UserManagementPage from './UserManagementPage'
import SystemSettingsPage from './SystemSettingsPage'
import AdminCompetencyItemsPage from './AdminCompetencyItemsPage'

const TAB_CONFIG = [
  { key: 'users', label: '사용자관리', icon: <UserOutlined /> },
  { key: 'settings', label: '시스템설정', icon: <SettingOutlined /> },
  { key: 'templates', label: '역량템플릿', icon: <AppstoreOutlined /> }
]

export default function SystemAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'users'

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true })
  }

  const tabItems = useMemo(() => TAB_CONFIG.map(tab => {
    let children: React.ReactNode = null

    switch (tab.key) {
      case 'users':
        children = <UserManagementPage embedded />
        break
      case 'settings':
        children = <SystemSettingsPage embedded />
        break
      case 'templates':
        children = <AdminCompetencyItemsPage embedded />
        break
    }

    return {
      key: tab.key,
      label: (
        <span>
          {tab.icon}
          <span className="ml-1">{tab.label}</span>
        </span>
      ),
      children
    }
  }), [])

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow">
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems}
            className="p-4"
            tabBarStyle={{ marginBottom: 0 }}
            tabBarGutter={16}
            size="large"
          />
        </div>
      </div>
    </div>
  )
}
