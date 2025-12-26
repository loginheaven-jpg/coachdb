import { useState, useEffect, useCallback } from 'react'
import { Modal, Table, Button, Space, message, Select, Empty, Tag, Typography } from 'antd'
import { UserAddOutlined, DeleteOutlined } from '@ant-design/icons'
import projectService, { ProjectStaffResponse, ProjectStaffListResponse } from '../services/projectService'
import adminService, { UserListItem, ROLE_LABELS } from '../services/adminService'

const { Text } = Typography

interface ProjectStaffModalProps {
  visible: boolean
  projectId: number
  projectName: string
  onClose: () => void
}

export default function ProjectStaffModal({
  visible,
  projectId,
  projectName,
  onClose
}: ProjectStaffModalProps) {
  const [loading, setLoading] = useState(false)
  const [staffList, setStaffList] = useState<ProjectStaffResponse[]>([])
  const [reviewers, setReviewers] = useState<UserListItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>()
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const loadStaff = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data: ProjectStaffListResponse = await projectService.getProjectStaff(projectId)
      setStaffList(data.staff_list)
    } catch (error: any) {
      console.error('심사위원 목록 로드 실패:', error)
      message.error('심사위원 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const loadReviewers = useCallback(async () => {
    try {
      const data = await adminService.getUsers({ role: 'REVIEWER' })
      setReviewers(data)
    } catch (error: any) {
      console.error('심사자 목록 로드 실패:', error)
    }
  }, [])

  useEffect(() => {
    if (visible && projectId) {
      loadStaff()
      loadReviewers()
    }
  }, [visible, projectId, loadStaff, loadReviewers])

  const handleAddStaff = async () => {
    if (!selectedUserId) {
      message.warning('추가할 심사위원을 선택해주세요.')
      return
    }

    setAdding(true)
    try {
      await projectService.addProjectStaff(projectId, selectedUserId)
      message.success('심사위원이 추가되었습니다.')
      setSelectedUserId(undefined)
      loadStaff()
    } catch (error: any) {
      console.error('심사위원 추가 실패:', error)
      message.error(error.response?.data?.detail || '심사위원 추가에 실패했습니다.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveStaff = async (staffUserId: number) => {
    setRemovingId(staffUserId)
    try {
      await projectService.removeProjectStaff(projectId, staffUserId)
      message.success('심사위원이 제거되었습니다.')
      loadStaff()
    } catch (error: any) {
      console.error('심사위원 제거 실패:', error)
      message.error(error.response?.data?.detail || '심사위원 제거에 실패했습니다.')
    } finally {
      setRemovingId(null)
    }
  }

  // Filter out already assigned reviewers
  const availableReviewers = reviewers.filter(
    reviewer => !staffList.some(staff => staff.staff_user_id === reviewer.user_id)
  )

  const columns = [
    {
      title: '이름',
      dataIndex: ['staff_user', 'full_name'],
      key: 'name',
      render: (_: any, record: ProjectStaffResponse) =>
        record.staff_user?.full_name || record.staff_user?.username || '-'
    },
    {
      title: '사용자ID',
      dataIndex: ['staff_user', 'username'],
      key: 'username'
    },
    {
      title: '할당일시',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: (date: string) => new Date(date).toLocaleString('ko-KR')
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_: any, record: ProjectStaffResponse) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          loading={removingId === record.staff_user_id}
          onClick={() => handleRemoveStaff(record.staff_user_id)}
        />
      )
    }
  ]

  return (
    <Modal
      title={`심사위원 관리 - ${projectName}`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>
      ]}
      width={600}
    >
      {/* Add reviewer section */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>심사위원 추가</Text>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Select
            style={{ flex: 1 }}
            placeholder="심사위원을 선택하세요"
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={availableReviewers.map(reviewer => ({
              value: reviewer.user_id,
              label: (
                <Space>
                  <span>{reviewer.name}</span>
                  <Text type="secondary">({reviewer.email})</Text>
                </Space>
              )
            }))}
            showSearch
            filterOption={(input, option) => {
              const reviewer = reviewers.find(r => r.user_id === option?.value)
              if (!reviewer) return false
              const searchText = input.toLowerCase()
              return (
                reviewer.name.toLowerCase().includes(searchText) ||
                reviewer.email.toLowerCase().includes(searchText)
              )
            }}
            notFoundContent={
              availableReviewers.length === 0 ? (
                <Empty
                  description={
                    reviewers.length === 0
                      ? "REVIEWER 역할을 가진 사용자가 없습니다"
                      : "모든 심사위원이 이미 할당되었습니다"
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : undefined
            }
          />
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={handleAddStaff}
            loading={adding}
            disabled={!selectedUserId}
          >
            추가
          </Button>
        </div>
      </div>

      {/* Current staff list */}
      <div>
        <Text strong>현재 심사위원 ({staffList.length}명)</Text>
        <Table
          style={{ marginTop: 8 }}
          columns={columns}
          dataSource={staffList}
          rowKey="staff_user_id"
          loading={loading}
          pagination={false}
          size="small"
          locale={{
            emptyText: <Empty description="할당된 심사위원이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
        />
      </div>
    </Modal>
  )
}
