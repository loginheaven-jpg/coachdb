import { useState, useEffect } from 'react'
import {
  Modal,
  Table,
  Typography,
  Space,
  Tag,
  Button,
  Spin,
  message,
  Alert,
  Checkbox
} from 'antd'
import {
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import projectService, { ProjectListItem, ProjectStatus } from '../services/projectService'
import dayjs from 'dayjs'

const { Text } = Typography

interface TestProjectCleanupModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const getStatusTag = (displayStatus: string | undefined, status: ProjectStatus) => {
  const statusMap: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '초안' },
    pending: { color: 'gold', text: '승인대기' },
    ready: { color: 'gold', text: '모집대기' },
    recruiting: { color: 'blue', text: '모집중' },
    recruiting_ended: { color: 'purple', text: '모집종료' },
    reviewing: { color: 'orange', text: '심사중' },
    in_progress: { color: 'cyan', text: '과제진행중' },
    evaluating: { color: 'geekblue', text: '과제평가중' },
    completed: { color: 'green', text: '완료' },
    closed: { color: 'default', text: '종료' }
  }
  const key = displayStatus || status
  const config = statusMap[key] || { color: 'default', text: key }
  return <Tag color={config.color}>{config.text}</Tag>
}

export default function TestProjectCleanupModal({
  open,
  onClose,
  onSuccess
}: TestProjectCleanupModalProps) {
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  useEffect(() => {
    if (open) {
      loadTestProjects()
    }
  }, [open])

  const loadTestProjects = async () => {
    try {
      setLoading(true)
      // 기존 과제 목록 API 사용 후 프론트엔드에서 테스트 과제만 필터링
      const allProjects = await projectService.listProjects({ mode: 'manage' })
      const testProjects = allProjects.filter(p => p.project_name.startsWith('[테스트]'))
      setProjects(testProjects)
      setSelectedIds([])
    } catch (error: any) {
      console.error('Failed to load test projects:', error)
      message.error('테스트 과제 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      message.warning('삭제할 과제를 선택해주세요.')
      return
    }

    try {
      setDeleting(true)
      const result = await projectService.bulkDeleteProjects(selectedIds)
      message.success(`${result.deleted_count}개 과제가 삭제되었습니다.`)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Failed to delete projects:', error)
      message.error(error.response?.data?.detail || '과제 삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelection = (projectId: number) => {
    setSelectedIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const selectAll = () => {
    setSelectedIds(projects.map(p => p.project_id))
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const columns: ColumnsType<ProjectListItem> = [
    {
      title: '',
      key: 'checkbox',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedIds.includes(record.project_id)}
          onChange={() => toggleSelection(record.project_id)}
        />
      )
    },
    {
      title: '과제명',
      dataIndex: 'project_name',
      key: 'project_name',
      ellipsis: true
    },
    {
      title: '상태',
      key: 'status',
      width: 100,
      render: (_, record) => getStatusTag(record.display_status, record.status)
    },
    {
      title: '응모자',
      dataIndex: 'application_count',
      key: 'application_count',
      width: 80,
      align: 'center',
      render: (count: number | null) => count || 0
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm')
    }
  ]

  const selectedCount = selectedIds.length

  return (
    <Modal
      title={
        <Space>
          <DeleteOutlined />
          <span>테스트과제 정리</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          취소
        </Button>,
        <Button
          key="delete"
          type="primary"
          danger
          onClick={handleDelete}
          loading={deleting}
          disabled={selectedIds.length === 0}
          icon={<DeleteOutlined />}
        >
          삭제 ({selectedCount}개)
        </Button>
      ]}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8">
          <Text type="secondary">삭제할 테스트 과제가 없습니다.</Text>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Text>총 {projects.length}개의 테스트 과제</Text>
            <Space>
              <Button size="small" onClick={selectAll}>전체 선택</Button>
              <Button size="small" onClick={clearSelection}>선택 해제</Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={projects}
            rowKey="project_id"
            pagination={false}
            scroll={{ y: 300 }}
            size="small"
            rowClassName={(record) =>
              selectedIds.includes(record.project_id) ? 'bg-red-50' : ''
            }
          />

          {selectedCount > 0 && (
            <Alert
              type="warning"
              message={
                <Space>
                  <ExclamationCircleOutlined />
                  <span>
                    선택한 {selectedCount}개 과제와 관련된 모든 데이터(응모자, 평가 등)가 삭제됩니다.
                    이 작업은 되돌릴 수 없습니다.
                  </span>
                </Space>
              }
            />
          )}
        </div>
      )}
    </Modal>
  )
}
