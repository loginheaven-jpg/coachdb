import { useState, useEffect, useCallback } from 'react'
import { Modal, Table, Button, Space, message, Select, Empty, Typography, Card, InputNumber, Divider } from 'antd'
import { UserAddOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import projectService, { ProjectStaffResponse, ProjectStaffListResponse } from '../services/projectService'
import adminService, { UserListItem } from '../services/adminService'
import scoringService from '../services/scoringService'

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
  const [allUsers, setAllUsers] = useState<UserListItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>()
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  // 가중치 상태
  const [quantWeight, setQuantWeight] = useState<number>(70)
  const [qualWeight, setQualWeight] = useState<number>(30)
  const [savingWeights, setSavingWeights] = useState(false)

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

  const loadAllUsers = useCallback(async () => {
    try {
      // 전체 사용자 목록 조회 (REVIEWER 필터 제거)
      const data = await adminService.getUsers({})
      setAllUsers(data)
    } catch (error: any) {
      console.error('사용자 목록 로드 실패:', error)
    }
  }, [])

  const loadWeights = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await scoringService.getProjectWeights(projectId)
      setQuantWeight(data.quantitative_weight || 70)
      setQualWeight(data.qualitative_weight || 30)
    } catch (error: any) {
      console.error('가중치 로드 실패:', error)
    }
  }, [projectId])

  useEffect(() => {
    if (visible && projectId) {
      loadStaff()
      loadAllUsers()
      loadWeights()
    }
  }, [visible, projectId, loadStaff, loadAllUsers, loadWeights])

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

  const handleSaveWeights = async () => {
    if (quantWeight + qualWeight !== 100) {
      message.error('정량 + 정성 가중치의 합이 100이어야 합니다.')
      return
    }

    setSavingWeights(true)
    try {
      await scoringService.updateProjectWeights(projectId, {
        quantitative_weight: quantWeight,
        qualitative_weight: qualWeight
      })
      message.success('가중치가 저장되었습니다.')
    } catch (error: any) {
      console.error('가중치 저장 실패:', error)
      message.error(error.response?.data?.detail || '가중치 저장에 실패했습니다.')
    } finally {
      setSavingWeights(false)
    }
  }

  const handleQuantWeightChange = (value: number | null) => {
    const newQuant = value || 0
    setQuantWeight(newQuant)
    setQualWeight(100 - newQuant)
  }

  // Filter out already assigned users
  const availableUsers = allUsers.filter(
    user => !staffList.some(staff => staff.staff_user_id === user.user_id)
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
      maskClosable={false}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>
      ]}
      width={650}
    >
      {/* 가중치 설정 */}
      <Card
        size="small"
        title={
          <Space>
            <SettingOutlined />
            <span>평가 가중치 설정</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Space align="center" wrap>
          <Text>정량평가:</Text>
          <InputNumber
            value={quantWeight}
            min={0}
            max={100}
            onChange={handleQuantWeightChange}
            addonAfter="%"
            style={{ width: 100 }}
          />
          <Text>정성평가:</Text>
          <InputNumber
            value={qualWeight}
            min={0}
            max={100}
            disabled
            addonAfter="%"
            style={{ width: 100 }}
          />
          <Button
            type="primary"
            size="small"
            onClick={handleSaveWeights}
            loading={savingWeights}
          >
            저장
          </Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            정량(자동계산) + 정성(심사위원 평가) = 100%. 기본값: 70:30
          </Text>
        </div>
      </Card>

      <Divider style={{ margin: '16px 0' }} />

      {/* Add reviewer section */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>심사위원 추가</Text>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Select
            style={{ flex: 1 }}
            placeholder="심사위원으로 지정할 사용자를 선택하세요"
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={availableUsers.map(user => ({
              value: user.user_id,
              label: (
                <Space>
                  <span>{user.name}</span>
                  <Text type="secondary">({user.email})</Text>
                </Space>
              )
            }))}
            showSearch
            filterOption={(input, option) => {
              const user = allUsers.find(u => u.user_id === option?.value)
              if (!user) return false
              const searchText = input.toLowerCase()
              return (
                user.name.toLowerCase().includes(searchText) ||
                user.email.toLowerCase().includes(searchText)
              )
            }}
            notFoundContent={
              availableUsers.length === 0 ? (
                <Empty
                  description={
                    allUsers.length === 0
                      ? "사용자가 없습니다"
                      : "모든 사용자가 이미 심사위원으로 할당되었습니다"
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
