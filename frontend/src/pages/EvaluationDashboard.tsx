import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Table,
  Button,
  Tag,
  Space,
  Empty,
  message
} from 'antd'
import {
  TrophyOutlined,
  FormOutlined
} from '@ant-design/icons'
import projectService, { ProjectListItem } from '../services/projectService'

const { Title, Text } = Typography

// 상태별 태그 색상
const getStatusTag = (status: string, displayStatus?: string) => {
  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '초안' },
    pending: { color: 'orange', text: '승인대기' },
    rejected: { color: 'red', text: '반려됨' },
    ready: { color: 'blue', text: '승인됨' },
    recruiting: { color: 'green', text: '모집중' },
    recruiting_ended: { color: 'purple', text: '모집마감' },
    reviewing: { color: 'purple', text: '심사중' },
    in_progress: { color: 'cyan', text: '진행중' },
    closed: { color: 'default', text: '종료' },
  }

  // display_status 우선 사용
  if (displayStatus) {
    const info = statusMap[displayStatus] || { color: 'default', text: displayStatus }
    return <Tag color={info.color}>{info.text}</Tag>
  }

  const info = statusMap[status] || { color: 'default', text: status }
  return <Tag color={info.color}>{info.text}</Tag>
}

export default function EvaluationDashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)

  // 심사자로 할당된 과제 목록 조회
  const fetchProjects = async () => {
    setLoading(true)
    try {
      const data = await projectService.listProjects({ mode: 'review' })
      setProjects(data)
    } catch (error) {
      console.error('과제 목록 조회 실패:', error)
      message.error('과제 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // 테이블 컬럼
  const columns = [
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: ProjectListItem) => getStatusTag(status, record.display_status)
    },
    {
      title: '모집기간',
      key: 'recruitment_period',
      width: 200,
      render: (_: any, record: ProjectListItem) => (
        <Text type="secondary">
          {record.recruitment_start_date} ~ {record.recruitment_end_date}
        </Text>
      )
    },
    {
      title: '응모자',
      dataIndex: 'application_count',
      key: 'application_count',
      width: 80,
      align: 'center' as const,
      render: (count: number) => count || 0
    },
    {
      title: '작업',
      key: 'actions',
      width: 120,
      render: (_: any, record: ProjectListItem) => {
        // 심사중 상태인 경우에만 버튼 활성화
        const isReviewing = record.display_status === 'reviewing' || record.status === 'reviewing'
        return (
          <Button
            type="primary"
            icon={<FormOutlined />}
            onClick={() => navigate(`/projects/manage/${record.project_id}/review`)}
            disabled={!isReviewing}
            title={!isReviewing ? '심사중 상태의 과제만 심사할 수 있습니다' : undefined}
          >
            심사하기
          </Button>
        )
      }
    }
  ]

  return (
    <div className="p-6">
      <Card>
        <div className="mb-4">
          <Title level={4}>
            <TrophyOutlined className="mr-2" />
            심사 대상 과제
          </Title>
          <Text type="secondary">
            내가 심사위원으로 지정된 과제 목록입니다.
          </Text>
        </div>

        {projects.length === 0 && !loading ? (
          <Empty
            description="심사위원으로 지정된 과제가 없습니다."
            className="py-8"
          />
        ) : (
          <Table
            columns={columns}
            dataSource={projects}
            rowKey="project_id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개 과제`
            }}
          />
        )}
      </Card>
    </div>
  )
}
