import { useState, useEffect, useCallback } from 'react'
import { Typography, Card, Row, Col, Table, Tag, Button, Space, Modal, message, Statistic, Badge, Input, Descriptions, Timeline, Spin } from 'antd'
import { useAuthStore } from '../stores/authStore'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  UndoOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import verificationService, { PendingVerificationItem, CompetencyVerificationStatus, ActivityRecord } from '../services/verificationService'
import api from '../services/api'
import FilePreviewModal, { useFilePreview } from '../components/FilePreviewModal'

const { Title, Text } = Typography
const { TextArea } = Input

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

export default function StaffDashboard() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [pendingItems, setPendingItems] = useState<PendingVerificationItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyVerificationStatus | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState<number | null>(null)
  const [supplementModalVisible, setSupplementModalVisible] = useState(false)
  const [supplementReason, setSupplementReason] = useState('')
  const [supplementTargetId, setSupplementTargetId] = useState<number | null>(null)
  const [supplementLoading, setSupplementLoading] = useState(false)
  // 파일 미리보기
  const { previewState, openPreview, closePreview } = useFilePreview()

  // 통계 계산
  const stats = {
    pending: pendingItems.filter(item => !item.my_verification).length,
    myConfirms: pendingItems.filter(item => item.my_verification).length,
    total: pendingItems.length,
    needSupplement: pendingItems.filter(item => item.verification_status === 'rejected').length
  }

  // 검증 대기 목록 로드
  const loadPendingItems = useCallback(async () => {
    setLoading(true)
    try {
      const items = await verificationService.getPendingVerifications()
      setPendingItems(items)
    } catch (error) {
      console.error('Failed to load pending items:', error)
      message.error('검증 대기 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPendingItems()
  }, [loadPendingItems])

  // 상세 정보 조회
  const handleViewDetail = async (competencyId: number) => {
    setDetailLoading(true)
    setDetailModalVisible(true)
    try {
      const status = await verificationService.getVerificationStatus(competencyId)
      setSelectedCompetency(status)
    } catch (error) {
      console.error('Failed to load verification status:', error)
      message.error('상세 정보를 불러오는데 실패했습니다.')
      setDetailModalVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // 컨펌
  const handleConfirm = async (competencyId: number) => {
    setConfirmLoading(competencyId)
    try {
      await verificationService.confirmVerification(competencyId)
      message.success('컨펌되었습니다.')
      loadPendingItems()
      // 상세 모달이 열려있으면 새로고침
      if (detailModalVisible && selectedCompetency?.competency_id === competencyId) {
        const status = await verificationService.getVerificationStatus(competencyId)
        setSelectedCompetency(status)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      message.error(err?.response?.data?.detail || '컨펌에 실패했습니다.')
    } finally {
      setConfirmLoading(null)
    }
  }

  // 컨펌 취소
  const handleCancelVerification = async (recordId: number) => {
    try {
      await verificationService.cancelVerification(recordId)
      message.success('컨펌이 취소되었습니다.')
      loadPendingItems()
      setDetailModalVisible(false)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      message.error(err?.response?.data?.detail || '컨펌 취소에 실패했습니다.')
    }
  }

  // 보완요청 모달 열기
  const openSupplementModal = (competencyId: number | undefined) => {
    if (!competencyId) return
    setSupplementTargetId(competencyId)
    setSupplementReason('')
    setSupplementModalVisible(true)
  }

  // 보완요청 제출
  const handleSupplementRequest = async () => {
    if (!supplementTargetId || !supplementReason.trim()) {
      message.warning('보완요청 사유를 입력해주세요.')
      return
    }
    setSupplementLoading(true)
    try {
      await verificationService.requestSupplement(supplementTargetId, supplementReason)
      message.success('보완요청이 전송되었습니다.')
      setSupplementModalVisible(false)
      setDetailModalVisible(false)
      loadPendingItems()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      message.error(err?.response?.data?.detail || '보완요청에 실패했습니다.')
    } finally {
      setSupplementLoading(false)
    }
  }

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
      console.error('File download error:', error)
      message.error('파일 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  // 테이블 컬럼 정의
  const columns: ColumnsType<PendingVerificationItem> = [
    {
      title: '코치',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
      render: (name: string, record) => (
        <div>
          <div>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.user_email}</Text>
        </div>
      ),
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) => {
        const search = String(value).toLowerCase()
        return record.user_name.toLowerCase().includes(search) ||
               record.user_email.toLowerCase().includes(search) ||
               record.item_name.toLowerCase().includes(search)
      }
    },
    {
      title: '역량항목',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 180
    },
    {
      title: '검증 진행',
      key: 'progress',
      width: 120,
      render: (_, record) => (
        <Space>
          <Badge
            count={`${record.verification_count}/${record.required_count}`}
            style={{
              backgroundColor: record.verification_count >= record.required_count ? '#52c41a' : '#1890ff'
            }}
          />
          {record.verification_status === 'rejected' && (
            <Tag color="red">보완필요</Tag>
          )}
        </Space>
      )
    },
    {
      title: '내 컨펌',
      key: 'my_verification',
      width: 100,
      render: (_, record) => (
        record.my_verification ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>완료</Tag>
        ) : (
          <Tag color="default">대기</Tag>
        )
      )
    },
    {
      title: '등록일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (date: string) => new Date(date).toLocaleDateString()
    },
    {
      title: '작업',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.competency_id)}
        >
          상세
        </Button>
      )
    }
  ]

  // 활동 라벨
  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'confirm': return '컨펌'
      case 'supplement_request': return '보완요청'
      case 'reset': return '검증 리셋'
      default: return type
    }
  }

  // 필터링된 데이터
  const filteredData = searchText
    ? pendingItems.filter(item =>
        item.user_name.toLowerCase().includes(searchText.toLowerCase()) ||
        item.user_email.toLowerCase().includes(searchText.toLowerCase()) ||
        item.item_name.toLowerCase().includes(searchText.toLowerCase())
      )
    : pendingItems

  return (
    <div className="p-8">
      <div className="mb-4">
        <Title level={2} className="mb-0">검토자 대시보드</Title>
        <Text className="block text-gray-600">
          환영합니다, {user?.name}님! 증빙 검증 현황을 확인하세요.
        </Text>
      </div>

      {/* 통계 카드 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="검증 대기"
              value={stats.pending}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              suffix="건"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="내 컨펌"
              value={stats.myConfirms}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix="건"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="전체 항목"
              value={stats.total}
              prefix={<FileSearchOutlined style={{ color: '#722ed1' }} />}
              suffix="건"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="보완 필요"
              value={stats.needSupplement}
              prefix={<ExclamationCircleOutlined style={{ color: '#fa8c16' }} />}
              suffix="건"
            />
          </Card>
        </Col>
      </Row>

      {/* 검증 대기 목록 */}
      <Card
        title="증빙 검증 대기 목록"
        extra={
          <Space>
            <Input
              placeholder="코치명, 이메일, 항목명 검색"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadPendingItems} loading={loading}>
              새로고침
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="competency_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`
          }}
          size="middle"
        />
      </Card>

      {/* 상세 모달 */}
      <Modal
        title="증빙 상세 정보"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={700}
        footer={[
          // 컨펌/취소 버튼
          selectedCompetency && !selectedCompetency.records?.find(r => r.verifier_id === user?.user_id && r.is_valid) ? (
            <Button
              key="confirm"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={confirmLoading === selectedCompetency.competency_id}
              onClick={() => handleConfirm(selectedCompetency.competency_id)}
            >
              컨펌
            </Button>
          ) : selectedCompetency?.records?.find(r => r.verifier_id === user?.user_id && r.is_valid) ? (
            <Button
              key="cancel"
              onClick={() => {
                const myRecord = selectedCompetency.records.find(r => r.verifier_id === user?.user_id && r.is_valid)
                if (myRecord) handleCancelVerification(myRecord.record_id)
              }}
            >
              컨펌 취소
            </Button>
          ) : null,
          // 보완요청 버튼
          <Button
            key="supplement"
            danger
            icon={<ExclamationCircleOutlined />}
            onClick={() => openSupplementModal(selectedCompetency?.competency_id)}
          >
            보완요청
          </Button>,
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
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="코치" span={2}>
                {selectedCompetency.user_name}
              </Descriptions.Item>
              <Descriptions.Item label="역량항목" span={2}>
                {selectedCompetency.item_name}
              </Descriptions.Item>
              <Descriptions.Item label="검증 진행" span={2}>
                <Badge
                  count={`${selectedCompetency.verification_count}/${selectedCompetency.required_count}`}
                  style={{
                    backgroundColor: selectedCompetency.verification_count >= selectedCompetency.required_count ? '#52c41a' : '#1890ff'
                  }}
                />
                {selectedCompetency.is_globally_verified && (
                  <Tag color="green" style={{ marginLeft: 8 }}>검증 완료</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 24 }}>증빙 내용</Title>
            <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
              {selectedCompetency.value ? (
                renderCompetencyValue(
                  selectedCompetency.value,
                  pendingItems.find(p => p.competency_id === selectedCompetency.competency_id)?.item_code || ''
                )
              ) : (
                <Text type="secondary">-</Text>
              )}
            </div>

            {selectedCompetency.file_id && (
              <>
                <Title level={5}>첨부파일</Title>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="link"
                    onClick={() => openPreview(
                      selectedCompetency.file_id!,
                      selectedCompetency.file_info?.original_filename || 'file'
                    )}
                  >
                    {selectedCompetency.file_info?.original_filename || `파일 ID: ${selectedCompetency.file_id}`}
                  </Button>
                </div>
              </>
            )}

            <Title level={5}>최근 활동</Title>
            {selectedCompetency.activities && selectedCompetency.activities.length > 0 ? (
              <Timeline
                items={selectedCompetency.activities.map((activity: ActivityRecord, index: number) => ({
                  key: index,
                  color: activity.activity_type === 'confirm'
                    ? (activity.is_valid ? 'green' : 'gray')
                    : activity.activity_type === 'reset' ? 'orange' : 'red',
                  dot: activity.activity_type === 'confirm'
                    ? <CheckCircleOutlined />
                    : activity.activity_type === 'reset' ? <UndoOutlined /> : <ExclamationCircleOutlined />,
                  children: (
                    <div>
                      <Text strong>{getActivityLabel(activity.activity_type)}</Text>
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
        ) : null}
      </Modal>

      {/* 보완요청 모달 */}
      <Modal
        title="보완요청"
        open={supplementModalVisible}
        onCancel={() => setSupplementModalVisible(false)}
        onOk={handleSupplementRequest}
        okText="보완요청 전송"
        cancelText="취소"
        confirmLoading={supplementLoading}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          코치에게 증빙 자료의 보완을 요청합니다. 사유를 상세히 작성해주세요.
        </Text>
        <TextArea
          rows={4}
          placeholder="보완이 필요한 사유를 입력해주세요..."
          value={supplementReason}
          onChange={e => setSupplementReason(e.target.value)}
          maxLength={1000}
          showCount
        />
      </Modal>

      {/* File Preview Modal */}
      <FilePreviewModal
        visible={previewState.visible}
        fileId={previewState.fileId}
        filename={previewState.filename}
        onClose={closePreview}
      />
    </div>
  )
}
