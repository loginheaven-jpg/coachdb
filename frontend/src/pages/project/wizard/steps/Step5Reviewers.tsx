import { Input, List, Button, Tag, Space, Avatar, Alert } from 'antd'
import { UserOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'

const { Search } = Input

interface Step5Props {
  state: WizardState
  actions: WizardActions
}

interface User {
  user_id: number
  name: string
  email: string
  roles: string
}

export default function Step5Reviewers({ state, actions }: Step5Props) {
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadReviewers()
  }, [])

  useEffect(() => {
    // state.selectedReviewerIds 변경 시 선택된 사용자 정보 업데이트
    loadSelectedUsers()
  }, [state.selectedReviewerIds])

  const loadReviewers = async () => {
    setLoading(true)
    try {
      // TODO: API - 심사위원 목록 불러오기
      // GET /api/admin/users?role=VERIFIER,REVIEWER
      setSearchResults([])
    } catch (error) {
      console.error('Failed to load reviewers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSelectedUsers = async () => {
    // TODO: API - 선택된 사용자 정보 불러오기
    setSelectedUsers([])
  }

  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      loadReviewers()
      return
    }

    setLoading(true)
    try {
      // TODO: API - 사용자 검색
      // GET /api/admin/users?role=VERIFIER,REVIEWER&search={value}
      setSearchResults([])
    } catch (error) {
      console.error('Failed to search users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddReviewer = (userId: number) => {
    if (!state.selectedReviewerIds.includes(userId)) {
      actions.addReviewer(userId)
    }
  }

  const handleRemoveReviewer = (userId: number) => {
    actions.removeReviewer(userId)
  }

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        누가 서류를 검토하나요?
      </h2>

      <div className="wizard-question-hint">
        💡 최소 2명 이상의 심사위원이 필요합니다
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 선택된 심사위원 */}
        {selectedUsers.length > 0 && (
          <div>
            <h4>선택된 심사위원 ({selectedUsers.length}명)</h4>
            <List
              dataSource={selectedUsers}
              renderItem={user => (
                <List.Item
                  actions={[
                    <Button
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => handleRemoveReviewer(user.user_id)}
                    >
                      제거
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={user.name}
                    description={user.email}
                  />
                  <Tag>{user.roles}</Tag>
                </List.Item>
              )}
              bordered
            />
          </div>
        )}

        {selectedUsers.length < 2 && (
          <Alert
            type="warning"
            message="최소 2명의 심사위원을 선택해주세요"
            showIcon
          />
        )}

        {/* 검색 */}
        <div>
          <h4>심사위원 추가</h4>
          <Search
            placeholder="이름 또는 이메일로 검색"
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            onSearch={handleSearch}
            loading={loading}
          />
        </div>

        {/* 검색 결과 */}
        <List
          dataSource={searchResults.filter(
            user => !state.selectedReviewerIds.includes(user.user_id)
          )}
          renderItem={user => (
            <List.Item
              actions={[
                <Button
                  type="primary"
                  onClick={() => handleAddReviewer(user.user_id)}
                >
                  추가
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={user.name}
                description={user.email}
              />
              <Tag>{user.roles}</Tag>
            </List.Item>
          )}
          loading={loading}
          locale={{ emptyText: '검색 결과가 없습니다' }}
        />
      </Space>
    </div>
  )
}
