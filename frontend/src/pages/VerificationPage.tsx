import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Tag, Button, Space, Modal, Typography, message, Progress, Input, Badge, Descriptions, Spin, Select, Timeline } from 'antd'
import { CheckCircleOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, UndoOutlined, ExclamationCircleOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import verificationService, { PendingVerificationItem, CompetencyVerificationStatus, ActivityRecord } from '../services/verificationService'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import FilePreviewModal, { useFilePreview } from '../components/FilePreviewModal'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

// JSON 값을 읽기 좋은 형태로 변환하는 함수
const renderCompetencyValue = (value: string | null, itemCode: string) => {
  if (!value) return '-'

  try {
    const parsed = JSON.parse(value)

    // 학위 정보 (DEGREE)
    if (itemCode.includes('DEGREE')) {
      const degreeTypes: Record<string, string> = {
        'bachelor': '학사', 'master': '석사', 'doctor': '박사',
        'associate': '전문학사', 'high_school': '고졸'
      }
      return (
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="학위">{degreeTypes[parsed.degree_type] || parsed.degree_type}</Descriptions.Item>
          <Descriptions.Item label="전공">{parsed.major}</Descriptions.Item>
          <Descriptions.Item label="학교">{parsed.school}</Descriptions.Item>
          <Descriptions.Item label="졸업년도">{parsed.graduation_year}</Descriptions.Item>
        </Descriptions>
      )
    }

    // 자격증 정보 (CERT)
    if (itemCode.includes('CERT')) {
      if (Array.isArray(parsed)) {
        return (
          <Space wrap>
            {parsed.map((cert, i) => (
              <Tag key={i} color="blue">{cert.cert_name || cert}</Tag>
            ))}
          </Space>
        )
      }
      return <Tag color="blue">{parsed.cert_name || value}</Tag>
    }

    // 경력 정보 (EXP)
    if (itemCode.includes('EXP')) {
      if (Array.isArray(parsed)) {
        return (
          <div>
            {parsed.map((exp, i) => (
              <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                <div><strong>{exp.company}</strong> - {exp.position}</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {exp.start_date} ~ {exp.end_date || '현재'} ({exp.duration || '-'})
                </div>
              </div>
            ))}
          </div>
        )
      }
    }

    // 코칭 실적 (COACHING)
    if (itemCode.includes('COACHING')) {
      return (
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="코칭 유형">{parsed.coaching_type}</Descriptions.Item>
          <Descriptions.Item label="시간">{parsed.hours}시간</Descriptions.Item>
          <Descriptions.Item label="기관">{parsed.organization}</Descriptions.Item>
        </Descriptions>
      )
    }

    // 기타: JSON 보기 좋게 표시
    if (typeof parsed === 'object') {
      return (
        <pre style={{ margin: 0, fontSize: 12, background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    }

    return value
  } catch {
    // JSON이 아니면 원본 표시
    return <Text>{value}</Text>
  }
}

export default function VerificationPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [pendingItems, setPendingItems] = useState<PendingVerificationItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyVerificationStatus | null>(null)
  const [selectedItemCode, setSelectedItemCode] = useState<string>('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState<number | null>(null)
  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [resetReason, setResetReason] = useState('')
  const [resetCompetencyId, setResetCompetencyId] = useState<number | null>(null)
  // 보완요청 관련 상태
  const [supplementModalVisible, setSupplementModalVisible] = useState(false)
  const [supplementReason, setSupplementReason] = useState('')
  const [supplementCompetencyId, setSupplementCompetencyId] = useState<number | null>(null)
  const [supplementLoading, setSupplementLoading] = useState(false)
  // 상태 필터
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // 파일 미리보기
  const { previewState, openPreview, closePreview } = useFilePreview()

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

  // 파일 다운로드 (Presigned URL 사용 - R2에서 직접 다운로드)
  const handleDownloadFile = async (fileId: number, filename: string) => {
    const hideLoading = message.loading('다운로드 준비 중...', 0)
    try {
      // 1. Presigned URL 요청 (빠름)
      const response = await api.get(`/files/${fileId}/download-url`)
      const { download_url, is_local } = response.data

      hideLoading()

      if (is_local) {
        // 로컬 스토리지: 기존 방식 사용
        const blobResponse = await api.get(`/files/${fileId}`, {
          responseType: 'blob',
          timeout: 120000
        })
        const url = window.URL.createObjectURL(new Blob([blobResponse.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } else {
        // R2/MinIO: Presigned URL로 직접 다운로드
        const link = document.createElement('a')
        link.href = download_url
        link.setAttribute('download', filename)
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        link.remove()
      }

      message.success('파일 다운로드 시작')
    } catch (error) {
      hideLoading()
      console.error('File download failed:', error)
      message.error('파일 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const handleViewDetail = async (competencyId: number, itemCode: string) => {
    setDetailLoading(true)
    setDetailModalVisible(true)
    setSelectedItemCode(itemCode)
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

  // 보완요청 모달 열기
  const openSupplementModal = (competencyId: number) => {
    setSupplementCompetencyId(competencyId)
    setSupplementReason('')
    setSupplementModalVisible(true)
  }

  // 보완요청 처리
  const handleSupplement = async () => {
    if (!supplementCompetencyId) return
    if (!supplementReason.trim()) {
      message.warning('보완 요청 사유를 입력해주세요')
      return
    }

    setSupplementLoading(true)
    try {
      await verificationService.requestSupplement(supplementCompetencyId, supplementReason)
      message.success('보완 요청이 완료되었습니다')
      setSupplementModalVisible(false)
      fetchPendingVerifications()
      if (selectedCompetency && selectedCompetency.competency_id === supplementCompetencyId) {
        setDetailModalVisible(false)
        setSelectedCompetency(null)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      message.error(err.response?.data?.detail || '보완 요청에 실패했습니다')
    } finally {
      setSupplementLoading(false)
    }
  }

  // Check if current user is admin/PM
  const isAdmin = user?.roles && (
    user.roles.includes('SUPER_ADMIN') ||
    user.roles.includes('PROJECT_MANAGER')
  )

  // Filter items based on search and status
  const filteredItems = pendingItems.filter(item => {
    // Text search filter
    const matchesSearch =
      item.user_name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.user_email.toLowerCase().includes(searchText.toLowerCase()) ||
      item.item_name.toLowerCase().includes(searchText.toLowerCase())

    // Status filter
    let matchesStatus = true
    if (statusFilter !== 'all') {
      if (statusFilter === 'rejected') {
        matchesStatus = item.verification_status === 'rejected'
      } else if (statusFilter === 'pending') {
        matchesStatus = item.verification_status !== 'rejected'
      }
    }

    return matchesSearch && matchesStatus
  })

  // Count by status for badges
  const rejectedCount = pendingItems.filter(item => item.verification_status === 'rejected').length
  const pendingCount = pendingItems.filter(item => item.verification_status !== 'rejected').length

  // 내 컨펌 여부 확인을 위한 헬퍼 함수
  const getMyVerification = (competencyId: number) => {
    const item = pendingItems.find(i => i.competency_id === competencyId)
    return item?.my_verification
  }

  const columns: ColumnsType<PendingVerificationItem> = [
    {
      title: '응모자',
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
      render: (_, record) => record.item_name
    },
    {
      title: '검증 현황',
      key: 'verification',
      width: 200,
      render: (_, record) => {
        const percent = (record.verification_count / record.required_count) * 100
        const isRejected = record.verification_status === 'rejected'
        return (
          <div>
            {isRejected ? (
              <Tag color="red" icon={<ExclamationCircleOutlined />}>보완필요</Tag>
            ) : (
              <>
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
              </>
            )}
          </div>
        )
      }
    },
    {
      title: '작업',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.competency_id, record.item_code)}
        >
          상세
        </Button>
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
              <Text type="secondary">응모자들이 제출한 증빙서류를 확인하고 컨펌합니다</Text>
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
            <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <Input
                placeholder="응모자명, 이메일, 항목명 검색..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 180 }}
              >
                <Option value="all">
                  전체 ({pendingItems.length})
                </Option>
                <Option value="pending">
                  <Badge color="gold" text={`검토중 (${pendingCount})`} />
                </Option>
                <Option value="rejected">
                  <Badge color="red" text={`보완필요 (${rejectedCount})`} />
                </Option>
              </Select>
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
          // 컨펌/취소 버튼
          selectedCompetency && !getMyVerification(selectedCompetency.competency_id) ? (
            <Button
              key="confirm"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={confirmLoading === selectedCompetency.competency_id}
              onClick={() => handleConfirm(selectedCompetency.competency_id)}
            >
              컨펌
            </Button>
          ) : selectedCompetency && getMyVerification(selectedCompetency.competency_id) ? (
            <Button
              key="cancel"
              onClick={() => handleCancelVerification(getMyVerification(selectedCompetency.competency_id)!.record_id)}
            >
              컨펌 취소
            </Button>
          ) : null,

          // 보완요청 버튼
          selectedCompetency && (
            <Button
              key="supplement"
              danger
              icon={<ExclamationCircleOutlined />}
              onClick={() => openSupplementModal(selectedCompetency.competency_id)}
            >
              보완요청
            </Button>
          ),

          // 검증 리셋 버튼 (Admin만)
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
        ].filter(Boolean)}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : selectedCompetency ? (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="응모자">
                {selectedCompetency.user_name}
              </Descriptions.Item>
              <Descriptions.Item label="역량항목">
                {selectedCompetency.item_name}
              </Descriptions.Item>
              <Descriptions.Item label="입력 내용">
                {renderCompetencyValue(selectedCompetency.value, selectedItemCode)}
              </Descriptions.Item>
              <Descriptions.Item label="첨부파일">
                {selectedCompetency.file_id ? (
                  <Space>
                    <Button
                      type="link"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownloadFile(
                        selectedCompetency.file_id!,
                        selectedCompetency.file_info?.original_filename || 'file'
                      )}
                      style={{ padding: 0 }}
                    >
                      {selectedCompetency.file_info?.original_filename || `파일 다운로드`}
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => openPreview(
                        selectedCompetency.file_id!,
                        selectedCompetency.file_info?.original_filename || 'file'
                      )}
                      title="미리보기"
                    />
                  </Space>
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
              <Title level={5}>최근 활동</Title>
              {selectedCompetency.activities && selectedCompetency.activities.length > 0 ? (
                <Timeline
                  items={selectedCompetency.activities.map((activity: ActivityRecord, index: number) => ({
                    key: index,
                    color: activity.activity_type === 'confirm'
                      ? (activity.is_valid ? 'green' : 'gray')
                      : activity.activity_type === 'reset'
                      ? 'orange'
                      : 'red',
                    dot: activity.activity_type === 'confirm'
                      ? <CheckCircleOutlined />
                      : activity.activity_type === 'reset'
                      ? <UndoOutlined />
                      : <ExclamationCircleOutlined />,
                    children: (
                      <div>
                        <Text strong>
                          {activity.activity_type === 'confirm' ? '컨펌' :
                           activity.activity_type === 'reset' ? '검증 리셋' : '보완요청'}
                        </Text>
                        {!activity.is_valid && activity.activity_type === 'confirm' && (
                          <Tag color="gray" style={{ marginLeft: 8 }}>무효</Tag>
                        )}
                        <Text type="secondary"> - {activity.actor_name}</Text>
                        {activity.message && (
                          <div style={{ marginTop: 4, color: '#666', fontStyle: 'italic' }}>
                            "{activity.message}"
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {new Date(activity.created_at).toLocaleString()}
                        </div>
                      </div>
                    )
                  }))}
                />
              ) : (
                <Text type="secondary">아직 활동 내역이 없습니다</Text>
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

      {/* Supplement Request Modal */}
      <Modal
        title="보완 요청"
        open={supplementModalVisible}
        onOk={handleSupplement}
        onCancel={() => setSupplementModalVisible(false)}
        okText="보완 요청 보내기"
        okButtonProps={{ danger: true, loading: supplementLoading }}
        cancelText="취소"
      >
        <p>이 증빙이 불충분한 이유를 입력해주세요.</p>
        <p style={{ marginBottom: 16 }}>
          <Text type="secondary">응모자에게 알림이 발송되며, 기존 컨펌 기록이 모두 무효화됩니다.</Text>
        </p>
        <TextArea
          placeholder="보완 요청 사유를 입력해주세요 (필수)"
          value={supplementReason}
          onChange={e => setSupplementReason(e.target.value)}
          rows={4}
          maxLength={1000}
          showCount
          style={{ marginBottom: 8 }}
        />
      </Modal>

      {/* File Preview Modal */}
      <FilePreviewModal
        visible={previewState.visible}
        fileId={previewState.fileId}
        filename={previewState.filename}
        onClose={closePreview}
      />
    </>
  )
}
