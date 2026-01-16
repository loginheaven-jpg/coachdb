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
  Statistic,
  Row,
  Col,
  Divider,
  Checkbox
} from 'antd'
import {
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  StarOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import scoringService, {
  SelectionRecommendation,
  SelectionResult
} from '../services/scoringService'

const { Title, Text } = Typography

interface SelectionModalProps {
  open: boolean
  projectId: number
  maxParticipants: number
  onClose: () => void
  onSuccess: () => void
}

const getRecommendedTag = (recommended: boolean) => {
  return recommended ? (
    <Tag icon={<StarOutlined />} color="gold">추천</Tag>
  ) : null
}

const getSelectionTag = (result: string) => {
  switch (result) {
    case 'pending':
      return <Tag color="default">대기</Tag>
    case 'selected':
      return <Tag icon={<CheckCircleOutlined />} color="success">선발</Tag>
    case 'rejected':
      return <Tag icon={<CloseCircleOutlined />} color="error">탈락</Tag>
    default:
      return <Tag>{result}</Tag>
  }
}

export default function SelectionModal({
  open,
  projectId,
  maxParticipants,
  onClose,
  onSuccess
}: SelectionModalProps) {
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [recommendations, setRecommendations] = useState<SelectionRecommendation[]>([])
  const [cutoffScore, setCutoffScore] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  useEffect(() => {
    if (open && projectId) {
      loadRecommendations()
    }
  }, [open, projectId])

  const loadRecommendations = async () => {
    try {
      setLoading(true)
      const result = await scoringService.getSelectionRecommendations(projectId)
      setRecommendations(result.recommendations)
      setCutoffScore(result.cutoff_score)

      // Pre-select recommended applications
      const recommended = result.recommendations
        .filter(r => r.is_recommended)
        .map(r => r.application_id)
      setSelectedIds(recommended)
    } catch (error: any) {
      console.error('Failed to load recommendations:', error)
      message.error(error.response?.data?.detail || '추천 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (selectedIds.length === 0) {
      message.warning('선발할 응모자를 선택해주세요.')
      return
    }

    if (selectedIds.length > maxParticipants) {
      message.warning(`최대 모집인원(${maxParticipants}명)을 초과했습니다.`)
      return
    }

    try {
      setConfirming(true)
      const result = await scoringService.confirmBulkSelection(projectId, {
        application_ids: selectedIds,
        selection_result: SelectionResult.SELECTED
      })
      message.success(`${result.selected_count}명이 선발되었습니다.`)
      onSuccess()
    } catch (error: any) {
      console.error('Failed to confirm selection:', error)
      message.error(error.response?.data?.detail || '선발 확정에 실패했습니다.')
    } finally {
      setConfirming(false)
    }
  }

  const toggleSelection = (applicationId: number) => {
    setSelectedIds(prev =>
      prev.includes(applicationId)
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    )
  }

  const selectRecommended = () => {
    const recommended = recommendations
      .filter(r => r.is_recommended)
      .map(r => r.application_id)
    setSelectedIds(recommended)
  }

  const selectAll = () => {
    setSelectedIds(recommendations.map(r => r.application_id))
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const columns: ColumnsType<SelectionRecommendation> = [
    {
      title: '',
      key: 'checkbox',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedIds.includes(record.application_id)}
          onChange={() => toggleSelection(record.application_id)}
        />
      )
    },
    {
      title: '순위',
      key: 'rank',
      width: 60,
      align: 'center',
      render: (_, __, index) => (
        <span className={index < maxParticipants ? 'font-bold text-blue-600' : ''}>
          {index + 1}
        </span>
      )
    },
    {
      title: '응모자',
      key: 'applicant',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.applicant_name}</Text>
          <Text type="secondary" className="text-xs">{record.applicant_email}</Text>
        </Space>
      )
    },
    {
      title: '역할',
      dataIndex: 'applied_role',
      key: 'applied_role',
      width: 100,
      render: (role: string | null) => role ? (
        <Tag>{role === 'leader' ? '리더코치' : role === 'participant' ? '참여코치' : '수퍼바이저'}</Tag>
      ) : '-'
    },
    {
      title: '정량점수',
      dataIndex: 'auto_score',
      key: 'auto_score',
      width: 80,
      align: 'center',
      render: (score: number | null) => score !== null ? score.toFixed(1) : '-'
    },
    {
      title: '정성점수',
      dataIndex: 'qualitative_score',
      key: 'qualitative_score',
      width: 80,
      align: 'center',
      render: (score: number | null) => score !== null ? score.toFixed(1) : '-'
    },
    {
      title: '최종점수',
      dataIndex: 'final_score',
      key: 'final_score',
      width: 90,
      align: 'center',
      render: (score: number | null) => score !== null ? (
        <Text strong className="text-blue-600">{score.toFixed(1)}</Text>
      ) : '-'
    },
    {
      title: '평가수',
      dataIndex: 'evaluation_count',
      key: 'evaluation_count',
      width: 70,
      align: 'center',
      render: (count: number) => count > 0 ? `${count}명` : <Text type="secondary">0</Text>
    },
    {
      title: '추천',
      key: 'recommended',
      width: 80,
      align: 'center',
      render: (_, record) => getRecommendedTag(record.is_recommended)
    },
    {
      title: '현재상태',
      dataIndex: 'current_selection_result',
      key: 'current_selection_result',
      width: 90,
      render: (result: string) => getSelectionTag(result)
    }
  ]

  const selectedCount = selectedIds.length
  const remainingSlots = maxParticipants - selectedCount

  return (
    <Modal
      title={
        <Space>
          <TrophyOutlined />
          <span>선발 추천 및 확정</span>
        </Space>
      }
      open={open}
      maskClosable={false}
      onCancel={onClose}
      width={1100}
      footer={[
        <Button key="cancel" onClick={onClose}>
          취소
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          loading={confirming}
          disabled={selectedIds.length === 0}
        >
          선발 확정 ({selectedCount}명)
        </Button>
      ]}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="모집인원"
                value={maxParticipants}
                suffix="명"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="전체 응모"
                value={recommendations.length}
                suffix="명"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="선택됨"
                value={selectedCount}
                suffix="명"
                valueStyle={{
                  color: selectedCount > maxParticipants ? '#ff4d4f' : '#52c41a'
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="커트라인"
                value={cutoffScore !== null ? cutoffScore.toFixed(1) : '-'}
                suffix="점"
              />
            </Col>
          </Row>

          {/* Warnings */}
          {selectedCount > maxParticipants && (
            <Alert
              type="warning"
              message={`선택 인원(${selectedCount}명)이 모집 인원(${maxParticipants}명)을 초과합니다.`}
              showIcon
              icon={<ExclamationCircleOutlined />}
            />
          )}

          {remainingSlots > 0 && selectedCount > 0 && (
            <Alert
              type="info"
              message={`${remainingSlots}명 더 선발 가능합니다.`}
              showIcon
            />
          )}

          <Divider />

          {/* Selection Controls */}
          <Space>
            <Button onClick={selectRecommended}>추천자 선택</Button>
            <Button onClick={selectAll}>전체 선택</Button>
            <Button onClick={clearSelection}>선택 해제</Button>
          </Space>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={recommendations}
            rowKey="application_id"
            pagination={false}
            scroll={{ y: 400 }}
            size="small"
            rowClassName={(record) =>
              selectedIds.includes(record.application_id) ? 'bg-blue-50' : ''
            }
          />

          <Alert
            type="warning"
            message="주의"
            description="선발 확정 시 선택되지 않은 응모자는 자동으로 탈락 처리됩니다."
            showIcon
          />
        </div>
      )}
    </Modal>
  )
}
