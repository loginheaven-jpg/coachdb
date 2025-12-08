import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Tag, Button, Space, Modal, Typography, message, Tooltip, Progress, Input, Badge, Descriptions, Spin } from 'antd'
import { CheckCircleOutlined, FileOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import verificationService, { PendingVerificationItem, CompetencyVerificationStatus } from '../services/verificationService'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

export default function VerificationPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [pendingItems, setPendingItems] = useState<PendingVerificationItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyVerificationStatus | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState<number | null>(null)
  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [resetReason, setResetReason] = useState('')
  const [resetCompetencyId, setResetCompetencyId] = useState<number | null>(null)

  const fetchPendingVerifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await verificationService.getPendingVerifications()
      setPendingItems(data)
    } catch (error) {
      console.error('Failed to fetch pending verifications:', error)
      message.error('대기 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingVerifications()
  }, [fetchPendingVerifications])

  const handleViewDetail = async (competencyId: number) => {
    setDetailLoading(true)
    setDetailModalVisible(true)
    try {
      const status = await verificationService.getVerificationStatus(competencyId)
      setSelectedCompetency(status)
    } catch (error) {
      console.error('Failed to fetch verification status:', error)
      message.error('상세 정보를 불러오는데 실패했습니다')
      setDetailModalVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleConfirm = async (competencyId: number) => {
    setConfirmLoading(competencyId)
    try {
      await verificationService.confirmVerification(competencyId)
      message.success('컨펌이 완료되었습니다')
      fetchPendingVerifications()
      // If detail modal is open, refresh it
      if (selectedCompetency && selectedCompetency.competency_id === competencyId) {
        const updated = await verificationService.getVerificationStatus(competencyId)
        setSelectedCompetency(updated)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || '컨펌에 실패했습니다')
    } finally {
      setConfirmLoading(null)
    }
  }

  const handleCancelVerification = async (recordId: number) => {
    try {
      await verificationService.cancelVerification(recordId)
      message.success('컨펌이 취소되었습니다')
      fetchPendingVerifications()
      if (selectedCompetency) {
        const updated = await verificationService.getVerificationStatus(selectedCompetency.competency_id)
        setSelectedCompetency(updated)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || '컨펌 취소에 실패했습니다')
    }
  }

  const handleOpenResetModal = (competencyId: number) => {
    setResetCompetencyId(competencyId)
    setResetReason('')
    setResetModalVisible(true)
  }

  const handleReset = async () => {
    if (!resetCompetencyId) return

    try {
      await verificationService.resetVerification(resetCompetencyId, resetReason)
      message.success('검증이 리셋되었습니다')
      setResetModalVisible(false)
      fetchPendingVerifications()
      if (selectedCompetency && selectedCompetency.competency_id === resetCompetencyId) {
        const updated = await verificationService.getVerificationStatus(resetCompetencyId)
        setSelectedCompetency(updated)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || '리셋에 실패했습니다')
    }
  }

  // Check if current user is admin/PM
  const isAdmin = user?.roles && (
    user.roles.includes('SUPER_ADMIN') ||
    user.roles.includes('PROJECT_MANAGER')
  )

  // Filter items based on search
  const filteredItems = pendingItems.filter(item =>
    item.user_name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.user_email.toLowerCase().includes(searchText.toLowerCase()) ||
    item.item_name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns: ColumnsType<PendingVerificationItem> = [
    {
      title: '코치',
      key: 'coach',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.user_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.user_email}</Text>
        </div>
      )
    },
    {
      title: '역량항목',
      key: 'item',
      render: (_, record) => (
        <div>
          <Tag color="blue">{record.item_code}</Tag>
          <span style={{ marginLeft: 8 }}>{record.item_name}</span>
        </div>
      )
    },
    {
      title: '증빙',
      key: 'evidence',
      render: (_, record) => (
        <Space>
          {record.value && (
            <Tooltip title={record.value}>
              <Tag>텍스트</Tag>
            </Tooltip>
          )}
          {record.file_id && (
            <Tag icon={<FileOutlined />} color="processing">파일</Tag>
          )}
          {!record.value && !record.file_id && (
            <Tag>없음</Tag>
          )}
        </Space>
      )
    },
    {
      title: '검증 현황',
      key: 'verification',
      width: 180,
      render: (_, record) => {
        const percent = (record.verification_count / record.required_count) * 100
        return (
          <div>
            <Progress
              percent={percent}
              size="small"
              format={() => `${record.verification_count}/${record.required_count}`}
              status={percent >= 100 ? 'success' : 'active'}
            />
            {record.my_verification && (
              <Tag color="green" style={{ marginTop: 4 }}>
                <CheckCircleOutlined /> 내가 컨펌함
              </Tag>
            )}
          </div>
        )
      }
    },
    {
      title: '작업',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.competency_id)}
          >
            상세
          </Button>
          {!record.my_verification ? (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={confirmLoading === record.competency_id}
              onClick={() => handleConfirm(record.competency_id)}
            >
              컨펌
            </Button>
          ) : (
            <Button
              danger
              onClick={() => handleCancelVerification(record.my_verification!.record_id)}
            >
              취소
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Title level={2} style={{ margin: 0 }}>증빙 확인</Title>
              <Text type="secondary">코치들이 제출한 증빙서류를 확인하고 컨펌합니다</Text>
            </div>
            <Space>
              <Badge count={pendingItems.length} showZero>
                <Tag color="blue">대기 중</Tag>
              </Badge>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchPendingVerifications}
                loading={loading}
              >
                새로고침
              </Button>
            </Space>
          </div>

          <Card>
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="코치명, 이메일, 항목명 검색..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
            </div>

            <Table
              columns={columns}
              dataSource={filteredItems}
              rowKey="competency_id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `총 ${total}건`
              }}
            />
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        title="증빙 상세 정보"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={700}
        footer={[
          isAdmin && selectedCompetency && (
            <Button
              key="reset"
              danger
              icon={<UndoOutlined />}
              onClick={() => handleOpenResetModal(selectedCompetency.competency_id)}
            >
              검증 리셋
            </Button>
          ),
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            닫기
          </Button>
        ]}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : selectedCompetency ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="코치">
                {selectedCompetency.user_name} (ID: {selectedCompetency.user_id})
              </Descriptions.Item>
              <Descriptions.Item label="역량항목">
                {selectedCompetency.item_name} (ID: {selectedCompetency.item_id})
              </Descriptions.Item>
              <Descriptions.Item label="증빙 값">
                {selectedCompetency.value || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="첨부파일">
                {selectedCompetency.file_id ? (
                  <a
                    href={`/api/files/${selectedCompetency.file_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    파일 보기 (ID: {selectedCompetency.file_id})
                  </a>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="전역 검증 상태">
                {selectedCompetency.is_globally_verified ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    검증 완료 ({selectedCompetency.globally_verified_at ? new Date(selectedCompetency.globally_verified_at).toLocaleString() : ''})
                  </Tag>
                ) : (
                  <Tag color="warning">검증 대기</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="검증 현황">
                <Progress
                  percent={(selectedCompetency.verification_count / selectedCompetency.required_count) * 100}
                  format={() => `${selectedCompetency.verification_count}/${selectedCompetency.required_count}`}
                  status={selectedCompetency.verification_count >= selectedCompetency.required_count ? 'success' : 'active'}
                  style={{ width: 200 }}
                />
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Title level={5}>컨펌 기록</Title>
              {selectedCompetency.records.length > 0 ? (
                <Table
                  size="small"
                  dataSource={selectedCompetency.records}
                  rowKey="record_id"
                  pagination={false}
                  columns={[
                    {
                      title: '확인자',
                      dataIndex: 'verifier_name',
                      key: 'verifier_name'
                    },
                    {
                      title: '확인 시각',
                      dataIndex: 'verified_at',
                      key: 'verified_at',
                      render: (val) => new Date(val).toLocaleString()
                    },
                    {
                      title: '상태',
                      dataIndex: 'is_valid',
                      key: 'is_valid',
                      render: (val) => val ? (
                        <Tag color="green">유효</Tag>
                      ) : (
                        <Tag color="red">무효화됨</Tag>
                      )
                    }
                  ]}
                />
              ) : (
                <Text type="secondary">아직 컨펌 기록이 없습니다</Text>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        title="검증 리셋"
        open={resetModalVisible}
        onOk={handleReset}
        onCancel={() => setResetModalVisible(false)}
        okText="리셋"
        okButtonProps={{ danger: true }}
        cancelText="취소"
      >
        <p>이 증빙의 모든 컨펌 기록을 무효화하고 검증 상태를 초기화합니다.</p>
        <p style={{ marginBottom: 16 }}>
          <Text type="warning">이 작업은 되돌릴 수 없습니다.</Text>
        </p>
        <Input.TextArea
          placeholder="리셋 사유 (선택사항)"
          value={resetReason}
          onChange={e => setResetReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </>
  )
}
