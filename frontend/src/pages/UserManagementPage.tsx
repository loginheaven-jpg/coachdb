import { useState, useEffect } from 'react'
import { Typography, Card, Table, Tag, Button, Space, Input, Select, Modal, Checkbox, message, InputNumber, Divider, Badge, Tabs, Transfer } from 'antd'
import { SearchOutlined, SaveOutlined, SettingOutlined, CheckOutlined, CloseOutlined, UserAddOutlined, FolderOutlined } from '@ant-design/icons'
import adminService, {
  UserListItem,
  SystemConfig,
  RoleRequest,
  USER_ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  CONFIG_KEYS
} from '../services/adminService'
import projectService, { ProjectListItem } from '../services/projectService'

const { Title, Text } = Typography

export default function UserManagementPage() {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserListItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined)

  // System config state
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [requiredVerifierCount, setRequiredVerifierCount] = useState<number>(2)
  const [configLoading, setConfigLoading] = useState(false)

  // Role edit modal
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [editingRoles, setEditingRoles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Role requests state
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([])
  const [roleRequestsLoading, setRoleRequestsLoading] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectingRequest, setRejectingRequest] = useState<RoleRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Project assignment state (for REVIEWER role)
  const [projectAssignModalVisible, setProjectAssignModalVisible] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [assigningUser, setAssigningUser] = useState<UserListItem | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([])
  const [projectAssigning, setProjectAssigning] = useState(false)

  useEffect(() => {
    loadUsers()
    loadConfigs()
    loadRoleRequests()
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const data = await projectService.listProjects()
      setProjects(data)
    } catch (error: any) {
      console.error('과제 목록 로드 실패:', error)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await adminService.getUsers({
        role: roleFilter,
        search: searchText || undefined
      })
      setUsers(data)
    } catch (error: any) {
      console.error('사용자 목록 로드 실패:', error)
      message.error('사용자 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadConfigs = async () => {
    setConfigLoading(true)
    try {
      const data = await adminService.getConfigs()
      setConfigs(data)

      // Set individual config values
      const verifierCount = data.find(c => c.key === CONFIG_KEYS.REQUIRED_VERIFIER_COUNT)
      if (verifierCount) {
        setRequiredVerifierCount(parseInt(verifierCount.value) || 2)
      }
    } catch (error: any) {
      console.error('설정 로드 실패:', error)
    } finally {
      setConfigLoading(false)
    }
  }

  const loadRoleRequests = async () => {
    setRoleRequestsLoading(true)
    try {
      const [requests, countData] = await Promise.all([
        adminService.getRoleRequests('PENDING'),
        adminService.getPendingRoleRequestsCount()
      ])
      setRoleRequests(requests)
      setPendingCount(countData.pending_count)
    } catch (error: any) {
      console.error('역할 요청 로드 실패:', error)
    } finally {
      setRoleRequestsLoading(false)
    }
  }

  const handleApproveRequest = async (request: RoleRequest) => {
    Modal.confirm({
      title: '역할 승인',
      content: (
        <div>
          <p><strong>{request.user_name}</strong>님의 <Tag color={ROLE_COLORS[request.requested_role]}>{ROLE_LABELS[request.requested_role] || request.requested_role}</Tag> 역할 요청을 승인하시겠습니까?</p>
        </div>
      ),
      okText: '승인',
      cancelText: '취소',
      onOk: async () => {
        try {
          await adminService.approveRoleRequest(request.request_id)
          message.success(`${request.user_name}님의 역할 요청이 승인되었습니다.`)
          loadRoleRequests()
          loadUsers()
        } catch (error: any) {
          message.error('역할 승인에 실패했습니다.')
        }
      }
    })
  }

  const handleOpenRejectModal = (request: RoleRequest) => {
    setRejectingRequest(request)
    setRejectReason('')
    setRejectModalVisible(true)
  }

  const handleRejectRequest = async () => {
    if (!rejectingRequest) return
    if (!rejectReason.trim()) {
      message.error('거절 사유를 입력해주세요.')
      return
    }

    try {
      await adminService.rejectRoleRequest(rejectingRequest.request_id, rejectReason)
      message.success('역할 요청이 거절되었습니다.')
      setRejectModalVisible(false)
      loadRoleRequests()
    } catch (error: any) {
      message.error('역할 거절에 실패했습니다.')
    }
  }

  const handleSearch = () => {
    loadUsers()
  }

  const handleEditRoles = (user: UserListItem) => {
    setEditingUser(user)
    setEditingRoles([...user.roles])
    setEditModalVisible(true)
  }

  const handleRoleChange = (role: string, checked: boolean) => {
    if (checked) {
      setEditingRoles([...editingRoles, role])
    } else {
      setEditingRoles(editingRoles.filter(r => r !== role))
    }
  }

  const handleSaveRoles = async () => {
    if (!editingUser) return

    // Check if REVIEWER role is being newly added
    const isAddingReviewer = editingRoles.includes('REVIEWER') && !editingUser.roles.includes('REVIEWER')

    setSaving(true)
    try {
      await adminService.updateUserRoles(editingUser.user_id, editingRoles)
      message.success('역할이 업데이트되었습니다.')
      setEditModalVisible(false)
      loadUsers()

      // If REVIEWER role was added, show project assignment modal
      if (isAddingReviewer) {
        setAssigningUser(editingUser)
        setSelectedProjectIds([])
        setProjectAssignModalVisible(true)
      }
    } catch (error: any) {
      console.error('역할 업데이트 실패:', error)
      message.error(error.response?.data?.detail || '역할 업데이트에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleAssignProjects = async () => {
    if (!assigningUser) return

    setProjectAssigning(true)
    try {
      // Add staff to each selected project
      let successCount = 0
      for (const projectId of selectedProjectIds) {
        try {
          await projectService.addProjectStaff(projectId, assigningUser.user_id)
          successCount++
        } catch (error: any) {
          // Already assigned or other error - continue
          console.error(`과제 ${projectId} 할당 실패:`, error)
        }
      }

      if (successCount > 0) {
        message.success(`${successCount}개 과제에 심사위원으로 할당되었습니다.`)
      }
      setProjectAssignModalVisible(false)
    } catch (error: any) {
      console.error('과제 할당 실패:', error)
      message.error('과제 할당에 실패했습니다.')
    } finally {
      setProjectAssigning(false)
    }
  }

  const handleSaveConfig = async () => {
    setConfigLoading(true)
    try {
      await adminService.updateConfig(
        CONFIG_KEYS.REQUIRED_VERIFIER_COUNT,
        requiredVerifierCount.toString()
      )
      message.success('설정이 저장되었습니다.')
      loadConfigs()
    } catch (error: any) {
      console.error('설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setConfigLoading(false)
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 80
    },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: '역할',
      key: 'roles',
      render: (_: any, record: UserListItem) => (
        <Space wrap>
          {record.roles.map(role => (
            <Tag key={role} color={ROLE_COLORS[role] || 'default'}>
              {ROLE_LABELS[role] || role}
            </Tag>
          ))}
          {record.roles.length === 0 && (
            <Text type="secondary">역할 없음</Text>
          )}
        </Space>
      )
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '활성' : '비활성'}
        </Tag>
      )
    },
    {
      title: '액션',
      key: 'action',
      render: (_: any, record: UserListItem) => (
        <Button
          type="link"
          onClick={() => handleEditRoles(record)}
        >
          역할 편집
        </Button>
      )
    }
  ]

  // Role request columns
  const roleRequestColumns = [
    {
      title: '이름',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120
    },
    {
      title: '이메일',
      dataIndex: 'user_email',
      key: 'user_email',
      width: 200
    },
    {
      title: '전화번호',
      dataIndex: 'user_phone',
      key: 'user_phone',
      width: 130,
      render: (phone: string | null) => phone || '-'
    },
    {
      title: '신청 역할',
      dataIndex: 'requested_role',
      key: 'requested_role',
      width: 150,
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role] || 'default'}>
          {ROLE_LABELS[role] || role}
        </Tag>
      )
    },
    {
      title: '신청일시',
      dataIndex: 'requested_at',
      key: 'requested_at',
      width: 150,
      render: (date: string | null) => date ? new Date(date).toLocaleString('ko-KR') : '-'
    },
    {
      title: '액션',
      key: 'action',
      width: 150,
      render: (_: any, record: RoleRequest) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApproveRequest(record)}
          >
            승인
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleOpenRejectModal(record)}
          >
            거절
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div className="p-8">
      <Title level={2}>사용자 및 시스템 관리</Title>

        {/* System Config Section */}
        <Card title={<><SettingOutlined /> 시스템 설정</>} className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Text>증빙 확정 필요 검토자 수:</Text>
              <InputNumber
                min={1}
                max={10}
                value={requiredVerifierCount}
                onChange={(value) => setRequiredVerifierCount(value || 2)}
                disabled={configLoading}
              />
              <Text type="secondary">명</Text>
            </div>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveConfig}
              loading={configLoading}
            >
              저장
            </Button>
          </div>
          <Text type="secondary" className="mt-2 block">
            * 지정된 수 이상의 검토자가 컨펌하면 증빙이 확정됩니다.
          </Text>
        </Card>

        {/* Role Requests Section */}
        {pendingCount > 0 && (
          <Card
            title={
              <Space>
                <UserAddOutlined />
                <span>역할 승인 대기</span>
                <Badge count={pendingCount} style={{ backgroundColor: '#f5222d' }} />
              </Space>
            }
            className="mb-6"
          >
            <Table
              columns={roleRequestColumns}
              dataSource={roleRequests}
              rowKey="request_id"
              loading={roleRequestsLoading}
              pagination={false}
              size="middle"
            />
          </Card>
        )}

        <Divider />

        {/* User Management Section */}
        <Card title="사용자 역할 관리">
          {/* Search and Filter */}
          <div className="mb-4 flex gap-4">
            <Input
              placeholder="이름 또는 이메일로 검색"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 300 }}
            />
            <Select
              placeholder="역할 필터"
              allowClear
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: 200 }}
              options={Object.entries(ROLE_LABELS).map(([value, label]) => ({
                value,
                label
              }))}
            />
            <Button type="primary" onClick={handleSearch}>
              검색
            </Button>
          </div>

          {/* Users Table */}
          <Table
            columns={columns}
            dataSource={users}
            rowKey="user_id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}명`
            }}
          />
        </Card>

        {/* Role Edit Modal */}
        <Modal
          title={`역할 편집 - ${editingUser?.name}`}
          open={editModalVisible}
          onCancel={() => setEditModalVisible(false)}
          onOk={handleSaveRoles}
          confirmLoading={saving}
          okText="저장"
          cancelText="취소"
        >
          <div className="py-4">
            <Text className="block mb-4">
              이메일: {editingUser?.email}
            </Text>
            <div className="space-y-3">
              {Object.entries(USER_ROLES).map(([key, value]) => (
                <div key={key} className="flex items-center">
                  <Checkbox
                    checked={editingRoles.includes(value)}
                    onChange={(e) => handleRoleChange(value, e.target.checked)}
                  >
                    <Tag color={ROLE_COLORS[value]}>{ROLE_LABELS[value]}</Tag>
                  </Checkbox>
                  {value === 'PROJECT_MANAGER' && (
                    <Text type="secondary" className="ml-2">
                      (검토자 권한 자동 포함)
                    </Text>
                  )}
                  {value === 'SUPER_ADMIN' && (
                    <Text type="secondary" className="ml-2">
                      (모든 권한)
                    </Text>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* Role Request Reject Modal */}
        <Modal
          title="역할 요청 거절"
          open={rejectModalVisible}
          onCancel={() => setRejectModalVisible(false)}
          onOk={handleRejectRequest}
          okText="거절"
          okButtonProps={{ danger: true }}
          cancelText="취소"
        >
          <div className="py-4">
            <Text className="block mb-2">
              <strong>{rejectingRequest?.user_name}</strong>님의{' '}
              <Tag color={ROLE_COLORS[rejectingRequest?.requested_role || '']}>
                {ROLE_LABELS[rejectingRequest?.requested_role || ''] || rejectingRequest?.requested_role}
              </Tag>{' '}
              역할 요청을 거절합니다.
            </Text>
            <Text className="block mb-4" type="secondary">
              거절 사유를 입력해주세요.
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="거절 사유를 입력해주세요"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
        </Modal>

        {/* Project Assignment Modal for REVIEWER */}
        <Modal
          title={
            <Space>
              <FolderOutlined />
              <span>과제 할당 - {assigningUser?.name}</span>
            </Space>
          }
          open={projectAssignModalVisible}
          onCancel={() => setProjectAssignModalVisible(false)}
          onOk={handleAssignProjects}
          confirmLoading={projectAssigning}
          okText="할당"
          cancelText="나중에"
          width={600}
        >
          <div className="py-4">
            <Text className="block mb-4">
              <strong>{assigningUser?.name}</strong>님에게 REVIEWER 역할이 부여되었습니다.
              <br />
              심사할 과제를 선택해주세요.
            </Text>
            <Table
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedProjectIds,
                onChange: (selectedRowKeys) => setSelectedProjectIds(selectedRowKeys as number[])
              }}
              columns={[
                {
                  title: '과제명',
                  dataIndex: 'project_name',
                  key: 'project_name',
                  ellipsis: true
                },
                {
                  title: '모집기간',
                  key: 'recruitment_period',
                  width: 180,
                  render: (_: any, record: ProjectListItem) =>
                    `${record.recruitment_start_date} ~ ${record.recruitment_end_date}`
                },
                {
                  title: '상태',
                  dataIndex: 'display_status',
                  key: 'status',
                  width: 100,
                  render: (status: string) => {
                    const statusLabels: Record<string, string> = {
                      draft: '초안',
                      pending: '모집대기',
                      recruiting: '모집중',
                      recruiting_ended: '모집종료',
                      reviewing: '심사중',
                      in_progress: '진행중',
                      closed: '종료'
                    }
                    return statusLabels[status] || status
                  }
                }
              ]}
              dataSource={projects}
              rowKey="project_id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
            <Text type="secondary" className="mt-2 block">
              * 선택하지 않으면 심사위원은 어떤 과제의 응모자도 열람할 수 없습니다.
            </Text>
          </div>
        </Modal>
    </div>
  )
}
