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
import adminService, { UserListItem, ROLE_LABELS, ROLE_COLORS } from '../services/adminService'
import dayjs from 'dayjs'

const { Text } = Typography

interface UserCleanupModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function UserCleanupModal({
  open,
  onClose,
  onSuccess
}: UserCleanupModalProps) {
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [users, setUsers] = useState<UserListItem[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  useEffect(() => {
    if (open) {
      loadUsers()
    }
  }, [open])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const allUsers = await adminService.getUsers()
      // SUPER_ADMIN은 삭제 불가능하므로 목록에서 제외
      const deletableUsers = allUsers.filter(u => !u.roles.includes('SUPER_ADMIN'))
      setUsers(deletableUsers)
      setSelectedIds([])
    } catch (error: any) {
      console.error('Failed to load users:', error)
      message.error('사용자 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      message.warning('삭제할 사용자를 선택해주세요.')
      return
    }

    try {
      setDeleting(true)
      const result = await adminService.bulkDeleteUsers(selectedIds)

      if (result.skipped_users && result.skipped_users.length > 0) {
        message.warning(`${result.deleted_count}명 삭제, ${result.skipped_users.length}명 건너뜀`)
      } else {
        message.success(`${result.deleted_count}명의 사용자가 삭제되었습니다.`)
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Failed to delete users:', error)
      message.error(error.response?.data?.detail || '사용자 삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelection = (userId: number) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAll = () => {
    setSelectedIds(users.map(u => u.user_id))
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const columns: ColumnsType<UserListItem> = [
    {
      title: '',
      key: 'checkbox',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedIds.includes(record.user_id)}
          onChange={() => toggleSelection(record.user_id)}
        />
      )
    },
    {
      title: 'ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 60
    },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      ellipsis: true
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true
    },
    {
      title: '역할',
      key: 'roles',
      width: 150,
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          {record.roles.map(role => (
            <Tag key={role} color={ROLE_COLORS[role] || 'default'} style={{ margin: 0 }}>
              {ROLE_LABELS[role] || role}
            </Tag>
          ))}
          {record.roles.length === 0 && <Text type="secondary">-</Text>}
        </Space>
      )
    },
    {
      title: '가입일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (date: string | null) => date ? dayjs(date).format('MM-DD HH:mm') : '-'
    }
  ]

  const selectedCount = selectedIds.length

  return (
    <Modal
      title={
        <Space>
          <DeleteOutlined />
          <span>회원 일괄삭제</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={800}
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
          삭제 ({selectedCount}명)
        </Button>
      ]}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8">
          <Text type="secondary">삭제할 수 있는 사용자가 없습니다.</Text>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Text>총 {users.length}명 (SUPER_ADMIN 제외)</Text>
            <Space>
              <Button size="small" onClick={selectAll}>전체 선택</Button>
              <Button size="small" onClick={clearSelection}>선택 해제</Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={users}
            rowKey="user_id"
            pagination={false}
            scroll={{ y: 400 }}
            size="small"
            rowClassName={(record) =>
              selectedIds.includes(record.user_id) ? 'bg-red-50' : ''
            }
          />

          {selectedCount > 0 && (
            <Alert
              type="warning"
              message={
                <Space>
                  <ExclamationCircleOutlined />
                  <span>
                    선택한 {selectedCount}명의 사용자와 관련된 모든 데이터(응모, 자격증, 학력, 평가 등)가 삭제됩니다.
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
