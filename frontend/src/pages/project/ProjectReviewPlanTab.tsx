import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Select,
  Typography,
  InputNumber,
  Divider,
  Alert,
  Empty
} from 'antd'
import { UserAddOutlined, DeleteOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useProjectEdit } from '../../contexts/ProjectEditContext'
import projectService, { ProjectStaffResponse } from '../../services/projectService'
import adminService, { UserListItem } from '../../services/adminService'
import scoringService from '../../services/scoringService'

const { Text, Title } = Typography

export default function ProjectReviewPlanTab() {
  const {
    projectId,
    isCreateMode,
    staffList,
    loadStaffList
  } = useProjectEdit()

  const [loading, setLoading] = useState(false)
  const [allUsers, setAllUsers] = useState<UserListItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>()
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  // 가중치 상태
  const [quantWeight, setQuantWeight] = useState<number>(70)
  const [qualWeight, setQualWeight] = useState<number>(30)
  const [savingWeights, setSavingWeights] = useState(false)

  // 사용자 목록 로드
  const loadAllUsers = useCallback(async () => {
    try {
      const data = await adminService.getUsers({})
      setAllUsers(data)
    } catch (error: any) {
      console.error('사용자 목록 로드 실패:', error)
    }
  }, [])

  // 가중치 로드
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
    if (projectId) {
      loadAllUsers()
      loadWeights()
    }
  }, [projectId, loadAllUsers, loadWeights])

  // 생성 모드에서는 먼저 과제를 저장해야 함
  if (isCreateMode || !projectId) {
    return (
      <Alert
        type="info"
        message="먼저 과제 정보를 저장해주세요"
        description="심사계획을 설정하려면 먼저 '과제정보' 탭에서 기본 정보를 입력하고 임시저장해주세요."
        showIcon
      />
    )
  }

  // 심사위원 추가
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
      loadStaffList()
    } catch (error: any) {
      console.error('심사위원 추가 실패:', error)
      message.error(error.response?.data?.detail || '심사위원 추가에 실패했습니다.')
    } finally {
      setAdding(false)
    }
  }

  // 심사위원 제거
  const handleRemoveStaff = async (staffUserId: number) => {
    setRemovingId(staffUserId)
    try {
      await projectService.removeProjectStaff(projectId, staffUserId)
      message.success('심사위원이 제거되었습니다.')
      loadStaffList()
    } catch (error: any) {
      console.error('심사위원 제거 실패:', error)
      message.error(error.response?.data?.detail || '심사위원 제거에 실패했습니다.')
    } finally {
      setRemovingId(null)
    }
  }

  // 가중치 저장
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

  // 이미 지정된 사용자 제외
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
      title: '사용자명',
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
    <div className="space-y-6">
      {/* 심사위원 미지정 경고 */}
      {staffList.length === 0 && (
        <Alert
          type="warning"
          message="심사위원이 지정되지 않았습니다"
          description="생성완료를 하려면 최소 1명의 심사위원을 지정해야 합니다."
          showIcon
        />
      )}

      {/* 가중치 설정 카드 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>평가 가중치 설정</span>
          </Space>
        }
      >
        <div className="space-y-4">
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
          <Text type="secondary" className="block">
            <InfoCircleOutlined className="mr-1" />
            정량(설문항목 자동계산) + 정성(심사위원 평가) = 100%. 기본값: 70:30
          </Text>
        </div>
      </Card>

      {/* 심사위원 관리 카드 */}
      <Card
        title={
          <Space>
            <UserAddOutlined />
            <span>심사위원 관리</span>
            <Text type="secondary">({staffList.length}명)</Text>
          </Space>
        }
      >
        {/* 심사위원 추가 */}
        <div className="mb-4">
          <Text strong>심사위원 추가</Text>
          <div className="mt-2 flex gap-2">
            <Select
              style={{ flex: 1 }}
              placeholder="심사위원으로 지정할 사용자를 선택하세요"
              value={selectedUserId}
              onChange={setSelectedUserId}
              showSearch
              optionFilterProp="label"
              options={availableUsers.map(user => ({
                value: user.user_id,
                label: `${user.name} (${user.email})`
              }))}
            />
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={handleAddStaff}
              loading={adding}
            >
              추가
            </Button>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 심사위원 목록 */}
        {staffList.length > 0 ? (
          <Table
            columns={columns}
            dataSource={staffList}
            rowKey="staff_user_id"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty
            description="지정된 심사위원이 없습니다"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* 심사 기준 안내 */}
      <Card title="심사 기준 안내">
        <div className="space-y-2 text-gray-600">
          <p><strong>정량평가:</strong> 설문항목 배점에 따라 자동 계산됩니다.</p>
          <p><strong>정성평가:</strong> 심사위원이 각 응모자에 대해 개별 평가합니다.</p>
          <p><strong>최종점수:</strong> (정량점수 × 정량가중치) + (정성점수 × 정성가중치)</p>
        </div>
      </Card>
    </div>
  )
}
