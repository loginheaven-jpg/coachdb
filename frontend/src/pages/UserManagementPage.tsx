import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Card, Table, Tag, Button, Space, Input, Select, Modal, Checkbox, message, InputNumber, Divider, Badge, Descriptions, Spin, Empty, Popconfirm } from 'antd'
import { SearchOutlined, SaveOutlined, SettingOutlined, CheckOutlined, CloseOutlined, UserAddOutlined, DeleteOutlined, KeyOutlined, AppstoreOutlined, EyeOutlined } from '@ant-design/icons'
import UserCleanupModal from '../components/UserCleanupModal'
import adminService, {
  UserListItem,
  UserFullProfile,
  RoleRequest,
  USER_ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  CONFIG_KEYS
} from '../services/adminService'

const { Title, Text } = Typography

export default function UserManagementPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserListItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined)

  // System config state
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

  // Bulk delete modal
  const [cleanupModalVisible, setCleanupModalVisible] = useState(false)

  // Password reset modal
  const [passwordResetModalVisible, setPasswordResetModalVisible] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserListItem | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false)

  // User detail modal
  const [userDetailModalVisible, setUserDetailModalVisible] = useState(false)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserFullProfile | null>(null)

  useEffect(() => {
    loadUsers()
    loadConfigs()
    loadRoleRequests()
  }, [])

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

    setSaving(true)
    try {
      await adminService.updateUserRoles(editingUser.user_id, editingRoles)
      message.success('역할이 업데이트되었습니다.')
      setEditModalVisible(false)
      loadUsers()
    } catch (error: any) {
      console.error('역할 업데이트 실패:', error)
      message.error(error.response?.data?.detail || '역할 업데이트에 실패했습니다.')
    } finally {
      setSaving(false)
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

  const handleOpenPasswordReset = (user: UserListItem) => {
    setResetPasswordUser(user)
    setNewPassword('')
    setPasswordResetModalVisible(true)
  }

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return
    if (newPassword.length < 8) {
      message.error('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    setResetPasswordLoading(true)
    try {
      await adminService.resetUserPassword(resetPasswordUser.user_id, newPassword)
      message.success(`${resetPasswordUser.name}님의 비밀번호가 변경되었습니다.`)
      setPasswordResetModalVisible(false)
    } catch (error: any) {
      console.error('비밀번호 리셋 실패:', error)
      message.error(error.response?.data?.detail || '비밀번호 리셋에 실패했습니다.')
    } finally {
      setResetPasswordLoading(false)
    }
  }

  const handleViewUserDetail = async (user: UserListItem) => {
    setUserDetailModalVisible(true)
    setUserDetailLoading(true)
    try {
      const profile = await adminService.getUserFullProfile(user.user_id)
      setSelectedUserProfile(profile)
    } catch (error: any) {
      console.error('사용자 정보 로드 실패:', error)
      message.error('사용자 정보를 불러오는데 실패했습니다.')
      setUserDetailModalVisible(false)
    } finally {
      setUserDetailLoading(false)
    }
  }

  const handleDeleteUser = async (user: UserListItem) => {
    try {
      await adminService.deleteUser(user.user_id)
      message.success(`${user.name}님이 삭제되었습니다.`)
      loadUsers()
    } catch (error: any) {
      console.error('사용자 삭제 실패:', error)
      message.error(error.response?.data?.detail || '사용자 삭제에 실패했습니다.')
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
      key: 'name',
      render: (name: string, record: UserListItem) => (
        <a onClick={() => handleViewUserDetail(record)} className="text-kca-primary hover:underline">
          {name}
        </a>
      )
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
      width: 220,
      render: (_: any, record: UserListItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleEditRoles(record)}
          >
            역할 편집
          </Button>
          {!record.roles.includes('SUPER_ADMIN') && (
            <>
              <Button
                type="link"
                size="small"
                icon={<KeyOutlined />}
                onClick={() => handleOpenPasswordReset(record)}
              >
                비밀번호
              </Button>
              <Popconfirm
                title="사용자 삭제"
                description={`${record.name}님을 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.`}
                onConfirm={() => handleDeleteUser(record)}
                okText="삭제"
                cancelText="취소"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </>
          )}
        </Space>
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
      <div className="flex justify-between items-center mb-4">
        <Title level={2} className="mb-0">사용자 및 시스템 관리</Title>
        <Button
          icon={<AppstoreOutlined />}
          onClick={() => navigate('/admin/competency-items')}
        >
          역량항목 관리
        </Button>
      </div>

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
        <Card
          title="사용자 역할 관리"
          extra={
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => setCleanupModalVisible(true)}
            >
              회원 일괄삭제
            </Button>
          }
        >
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
          maskClosable={false}
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
              {Object.entries(USER_ROLES)
                .filter(([key, value]) => value !== 'REVIEWER')
                .map(([key, value]) => (
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
          maskClosable={false}
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

        {/* User Cleanup Modal */}
        <UserCleanupModal
          open={cleanupModalVisible}
          onClose={() => setCleanupModalVisible(false)}
          onSuccess={loadUsers}
        />

        {/* Password Reset Modal */}
        <Modal
          title={`비밀번호 리셋 - ${resetPasswordUser?.name}`}
          open={passwordResetModalVisible}
          maskClosable={false}
          onCancel={() => setPasswordResetModalVisible(false)}
          onOk={handleResetPassword}
          confirmLoading={resetPasswordLoading}
          okText="변경"
          cancelText="취소"
        >
          <div className="py-4">
            <Text className="block mb-2">
              이메일: {resetPasswordUser?.email}
            </Text>
            <Text className="block mb-4" type="secondary">
              새 비밀번호를 입력해주세요. (최소 8자)
            </Text>
            <Input.Password
              placeholder="새 비밀번호 (8자 이상)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
          </div>
        </Modal>

        {/* User Detail Modal */}
        <Modal
          title={`사용자 상세정보 - ${selectedUserProfile?.name || ''}`}
          open={userDetailModalVisible}
          onCancel={() => {
            setUserDetailModalVisible(false)
            setSelectedUserProfile(null)
          }}
          footer={null}
          width={800}
          destroyOnClose
        >
          {userDetailLoading ? (
            <div className="flex justify-center py-12">
              <Spin size="large" />
            </div>
          ) : !selectedUserProfile ? (
            <Empty description="사용자 정보가 없습니다" />
          ) : (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <Card title="기본 정보" size="small">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="이름">{selectedUserProfile.name}</Descriptions.Item>
                  <Descriptions.Item label="이메일">{selectedUserProfile.email}</Descriptions.Item>
                  <Descriptions.Item label="전화번호">{selectedUserProfile.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="생년">{selectedUserProfile.birth_year || '-'}</Descriptions.Item>
                  <Descriptions.Item label="성별">{selectedUserProfile.gender === 'male' ? '남성' : selectedUserProfile.gender === 'female' ? '여성' : '-'}</Descriptions.Item>
                  <Descriptions.Item label="주소">{selectedUserProfile.address || '-'}</Descriptions.Item>
                  <Descriptions.Item label="역할">
                    <Space wrap>
                      {selectedUserProfile.roles.map(role => (
                        <Tag key={role} color={ROLE_COLORS[role] || 'default'}>
                          {ROLE_LABELS[role] || role}
                        </Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="가입일">
                    {selectedUserProfile.created_at ? new Date(selectedUserProfile.created_at).toLocaleDateString('ko-KR') : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 역량 정보 */}
              <Card
                title={`역량 정보 (${selectedUserProfile.verified_count}/${selectedUserProfile.competency_count} 검증완료)`}
                size="small"
              >
                {selectedUserProfile.competencies.length === 0 ? (
                  <Empty description="등록된 역량이 없습니다" />
                ) : (
                  <Table
                    dataSource={selectedUserProfile.competencies}
                    rowKey="competency_id"
                    size="small"
                    pagination={false}
                    scroll={{ y: 300 }}
                    columns={[
                      {
                        title: '항목명',
                        dataIndex: 'item_name',
                        key: 'item_name',
                        width: 200
                      },
                      {
                        title: '카테고리',
                        dataIndex: 'category',
                        key: 'category',
                        width: 100,
                        render: (cat: string) => {
                          const catLabels: Record<string, string> = {
                            BASIC: '기본정보',
                            CERTIFICATION: '자격증',
                            EDUCATION: '교육',
                            EXPERIENCE: '경력',
                            COACHING: '코칭경력',
                            OTHER: '기타'
                          }
                          return catLabels[cat] || cat
                        }
                      },
                      {
                        title: '값',
                        dataIndex: 'value',
                        key: 'value',
                        ellipsis: true
                      },
                      {
                        title: '상태',
                        dataIndex: 'verification_status',
                        key: 'verification_status',
                        width: 100,
                        render: (status: string) => {
                          const statusMap: Record<string, { color: string; text: string }> = {
                            verified: { color: 'success', text: '검증완료' },
                            pending: { color: 'default', text: '대기중' },
                            rejected: { color: 'error', text: '반려' }
                          }
                          const config = statusMap[status] || { color: 'default', text: status }
                          return <Tag color={config.color}>{config.text}</Tag>
                        }
                      }
                    ]}
                  />
                )}
              </Card>
            </div>
          )}
        </Modal>
    </div>
  )
}
