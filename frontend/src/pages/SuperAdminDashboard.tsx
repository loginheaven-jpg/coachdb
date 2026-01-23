import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  List,
  Space,
  Tag
} from 'antd'
import {
  UserOutlined,
  TeamOutlined,
  AppstoreOutlined,
  SettingOutlined,
  RightOutlined
} from '@ant-design/icons'
import api from '../services/api'

const { Title, Text } = Typography

interface Stats {
  total_users: number
  active_users: number
  pending_approvals: number
  competency_items: number
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    total_users: 0,
    active_users: 0,
    pending_approvals: 0,
    competency_items: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 사용자 수 조회
        const usersResponse = await api.get('/users/')
        const users = usersResponse.data || []
        const activeUsers = users.filter((u: any) => u.status === 'active')

        // 승인대기 과제 수 조회
        const projectsResponse = await api.get('/projects/')
        const projects = projectsResponse.data || []
        const pendingProjects = projects.filter((p: any) => p.status === 'pending')

        // 역량항목 수 조회
        const competencyResponse = await api.get('/competencies/items')
        const competencyItems = competencyResponse.data || []

        setStats({
          total_users: users.length,
          active_users: activeUsers.length,
          pending_approvals: pendingProjects.length,
          competency_items: competencyItems.length
        })
      } catch (error) {
        console.error('통계 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  // SUPER_ADMIN 전용 메뉴 목록
  const adminMenus = [
    {
      title: '사용자 관리',
      description: '사용자 목록 조회, 역할 변경, 계정 관리',
      icon: <UserOutlined style={{ fontSize: 24 }} />,
      path: '/admin/users',
      color: '#1890ff'
    },
    {
      title: '역량항목 관리',
      description: '코칭 역량 항목 추가, 수정, 삭제',
      icon: <AppstoreOutlined style={{ fontSize: 24 }} />,
      path: '/admin/competency-items',
      color: '#52c41a'
    },
    {
      title: '시스템 설정',
      description: '증빙검토 Verifier 인원수 등 시스템 설정',
      icon: <SettingOutlined style={{ fontSize: 24 }} />,
      path: '/admin/settings',
      color: '#722ed1'
    }
  ]

  return (
    <div className="p-6">
      <Title level={3} className="mb-6">수퍼어드민</Title>

      {/* 통계 카드 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="전체 사용자"
              value={stats.total_users}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="활성 사용자"
              value={stats.active_users}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="과제 승인대기"
              value={stats.pending_approvals}
              valueStyle={{ color: stats.pending_approvals > 0 ? '#fa8c16' : undefined }}
            />
            {stats.pending_approvals > 0 && (
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/dashboard')}
                style={{ padding: 0, marginTop: 8 }}
              >
                과제관리에서 승인하기
              </Button>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="역량항목"
              value={stats.competency_items}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 관리 메뉴 */}
      <Card title="관리 기능">
        <List
          itemLayout="horizontal"
          dataSource={adminMenus}
          renderItem={(item) => (
            <List.Item
              actions={[
                item.disabled ? (
                  <Tag>준비중</Tag>
                ) : (
                  <Button
                    type="link"
                    icon={<RightOutlined />}
                    onClick={() => navigate(item.path)}
                  >
                    이동
                  </Button>
                )
              ]}
              style={{
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1
              }}
              onClick={() => !item.disabled && navigate(item.path)}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      backgroundColor: `${item.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.color
                    }}
                  >
                    {item.icon}
                  </div>
                }
                title={<Text strong>{item.title}</Text>}
                description={item.description}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
