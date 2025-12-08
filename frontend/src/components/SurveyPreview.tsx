import React, { useState, useEffect } from 'react'
import {
  Modal,
  Card,
  Typography,
  Space,
  Input,
  InputNumber,
  Select,
  Button,
  Tag,
  Divider,
  Descriptions,
  Collapse,
  Upload,
  Checkbox,
  Spin,
  Alert,
  Radio
} from 'antd'
import {
  UploadOutlined,
  PlusOutlined,
  CalendarOutlined,
  TeamOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  PaperClipOutlined
} from '@ant-design/icons'
import projectService, {
  ProjectDetail,
  ProjectItem,
  CustomQuestion,
  CompetencyItem,
  ProofRequiredLevel
} from '../services/projectService'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse
const { TextArea } = Input

interface SurveyPreviewProps {
  projectId: number
  visible: boolean
  onClose: () => void
  // Pass current selections from SurveyBuilder
  selections: Map<number, {
    item: CompetencyItem
    included: boolean
    is_required: boolean  // 입력 필수 여부
    score: number | null
    proof_required_level: ProofRequiredLevel
  }>
  customQuestions: CustomQuestion[]
}

// 인적사항 항목 코드 목록
const PERSONAL_INFO_CODES = [
  'BASIC_NAME', 'BASIC_PHONE', 'BASIC_EMAIL', 'BASIC_ADDRESS',
  'BASIC_GENDER', 'BASIC_BIRTHDATE',
  'DETAIL_COACHING_AREA', 'DETAIL_CERT_NUMBER',
  'ADDON_INTRO', 'ADDON_SPECIALTY'
]

// 자격증 항목 코드 목록
const CERT_CODES = [
  'ADDON_CERT_COACH', 'ADDON_CERT_COUNSELING', 'ADDON_CERT_OTHER'
]

// 학력 항목 코드 목록 (학위 관련만)
const EDUCATION_CODES = ['EDU_DEGREE', 'COACH_DEGREE']

// 역량 이력 항목 코드 목록 (코칭 경력, 연수 등)
const COMPETENCY_HISTORY_CODES = [
  'ADDON_COACHING_HOURS', 'ADDON_COACHING_HISTORY',
  'ADDON_WORK_EXPERIENCE', 'ADDON_COACH_TRAINING'
]

// State for repeatable item rows
interface RepeatableRow {
  id: number
  value: string
  fileAttached: boolean
}

export default function SurveyPreview({
  projectId,
  visible,
  onClose,
  selections,
  customQuestions
}: SurveyPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  // Track rows for each repeatable item: Map<item_id, RepeatableRow[]>
  const [repeatableRows, setRepeatableRows] = useState<Map<number, RepeatableRow[]>>(new Map())

  useEffect(() => {
    if (visible && projectId) {
      loadProjectDetail()
    }
  }, [visible, projectId])

  const loadProjectDetail = async () => {
    setLoading(true)
    try {
      const data = await projectService.getProject(projectId)
      setProject(data)
    } catch (error) {
      console.error('프로젝트 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group items by category (SurveyBuilder.tsx와 동일한 로직)
  const groupItemsByCategory = () => {
    const grouped = {
      '인적사항': [] as typeof includedItems,
      '자격증': [] as typeof includedItems,
      '학력': [] as typeof includedItems,
      '역량 이력': [] as typeof includedItems,
      '기타': [] as typeof includedItems,
      '커스텀 질문': [] as typeof includedItems
    }

    const includedItems = Array.from(selections.values()).filter(s => s.included)

    includedItems.forEach(selection => {
      const code = selection.item.item_code

      if (PERSONAL_INFO_CODES.includes(code)) {
        grouped['인적사항'].push(selection)
      } else if (CERT_CODES.includes(code)) {
        grouped['자격증'].push(selection)
      } else if (EDUCATION_CODES.includes(code)) {
        grouped['학력'].push(selection)
      } else if (COMPETENCY_HISTORY_CODES.includes(code)) {
        grouped['역량 이력'].push(selection)
      } else if (selection.item.is_custom) {
        grouped['기타'].push(selection)  // 커스텀 항목은 '기타'로
      } else {
        grouped['역량 이력'].push(selection)  // 나머지 표준 항목도 '역량 이력'으로
      }
    })

    return grouped
  }

  const includedItems = Array.from(selections.values()).filter(s => s.included)
  const grouped = groupItemsByCategory()

  // Helper functions for repeatable items
  const getRowsForItem = (itemId: number): RepeatableRow[] => {
    const rows = repeatableRows.get(itemId)
    if (!rows || rows.length === 0) {
      // Initialize with one empty row
      return [{ id: 1, value: '', fileAttached: false }]
    }
    return rows
  }

  const addRow = (itemId: number) => {
    const currentRows = getRowsForItem(itemId)
    const newId = Math.max(...currentRows.map(r => r.id)) + 1
    const newRows = [...currentRows, { id: newId, value: '', fileAttached: false }]
    setRepeatableRows(new Map(repeatableRows).set(itemId, newRows))
  }

  const removeRow = (itemId: number, rowId: number) => {
    const currentRows = getRowsForItem(itemId)
    if (currentRows.length <= 1) return // Keep at least one row
    const newRows = currentRows.filter(r => r.id !== rowId)
    setRepeatableRows(new Map(repeatableRows).set(itemId, newRows))
  }

  const updateRowValue = (itemId: number, rowId: number, value: string) => {
    const currentRows = getRowsForItem(itemId)
    const newRows = currentRows.map(r => r.id === rowId ? { ...r, value } : r)
    setRepeatableRows(new Map(repeatableRows).set(itemId, newRows))
  }

  const toggleFileAttached = (itemId: number, rowId: number) => {
    const currentRows = getRowsForItem(itemId)
    const newRows = currentRows.map(r => r.id === rowId ? { ...r, fileAttached: !r.fileAttached } : r)
    setRepeatableRows(new Map(repeatableRows).set(itemId, newRows))
  }

  const getInputLabel = (isRequired: boolean): { text: string; color: string } => {
    return isRequired
      ? { text: '입력필수', color: 'blue' }
      : { text: '입력선택', color: 'default' }
  }

  const getProofLabel = (level: ProofRequiredLevel): { text: string; color: string } => {
    switch (level) {
      case ProofRequiredLevel.REQUIRED:
        return { text: '증빙필수', color: 'red' }
      case ProofRequiredLevel.OPTIONAL:
        return { text: '증빙선택', color: 'orange' }
      default:
        return { text: '증빙불필요', color: 'default' }
    }
  }

  const renderFieldInput = (field: any, disabled = false) => {
    switch (field.field_type) {
      case 'text':
        return <Input placeholder={field.placeholder || ''} disabled={disabled} />
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={field.placeholder || ''} disabled={disabled} />
      case 'select':
        return (
          <Select style={{ width: '100%' }} placeholder="선택하세요" disabled={disabled}>
            {field.field_options && JSON.parse(field.field_options).map((opt: string) => (
              <Select.Option key={opt} value={opt}>{opt}</Select.Option>
            ))}
          </Select>
        )
      case 'multiselect':
        return (
          <Checkbox.Group disabled={disabled}>
            <Space wrap>
              {field.field_options && JSON.parse(field.field_options).map((opt: string) => (
                <Checkbox key={opt} value={opt}>{opt}</Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        )
      case 'file':
        return (
          <Upload disabled>
            <Button icon={<UploadOutlined />} disabled>파일 첨부</Button>
          </Upload>
        )
      default:
        return <Input placeholder={field.placeholder || ''} disabled={disabled} />
    }
  }

  // Render repeatable item with row-based input
  const renderRepeatableItemCard = (selection: typeof includedItems[0], showProof: boolean) => {
    const { item, is_required, proof_required_level } = selection
    const inputInfo = getInputLabel(is_required)
    const proofInfo = getProofLabel(proof_required_level)
    const rows = getRowsForItem(item.item_id)

    return (
      <Card
        key={item.item_id}
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <Text strong>{item.item_name}</Text>
            <Tag color="cyan">복수 입력 가능</Tag>
            {showProof && <Tag color={inputInfo.color}>{inputInfo.text}</Tag>}
            {showProof && <Tag color={proofInfo.color}>{proofInfo.text}</Tag>}
          </Space>
        }
      >
        {/* Description */}
        {item.description && (
          <Alert
            message={item.description}
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Repeatable rows */}
        <div style={{ width: '100%' }}>
          {rows.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
                padding: '8px 12px',
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #f0f0f0'
              }}
            >
              {/* Row number */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#1890ff',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 'bold',
                  flexShrink: 0
                }}
              >
                {index + 1}
              </div>

              {/* Input field */}
              <Input
                placeholder={`${item.item_name}을(를) 입력하세요`}
                value={row.value}
                onChange={(e) => updateRowValue(item.item_id, row.id, e.target.value)}
                style={{ flex: 1 }}
              />

              {/* File attachment button/status */}
              {showProof && proof_required_level !== ProofRequiredLevel.NOT_REQUIRED && (
                row.fileAttached ? (
                  <Button
                    type="text"
                    icon={<CheckCircleFilled style={{ color: '#52c41a' }} />}
                    onClick={() => toggleFileAttached(item.item_id, row.id)}
                    style={{ color: '#52c41a' }}
                  >
                    첨부됨
                  </Button>
                ) : (
                  <Button
                    icon={<PaperClipOutlined />}
                    onClick={() => toggleFileAttached(item.item_id, row.id)}
                  >
                    첨부
                  </Button>
                )
              )}

              {/* Delete button (only show if more than 1 row) */}
              {rows.length > 1 && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRow(item.item_id, row.id)}
                />
              )}
            </div>
          ))}

          {/* Add row button */}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => addRow(item.item_id)}
            block
            style={{ marginTop: 8 }}
          >
            {item.item_name} 추가
          </Button>
        </div>
      </Card>
    )
  }

  const renderItemCard = (selection: typeof includedItems[0], showProof: boolean) => {
    const { item, is_required, proof_required_level } = selection
    const inputInfo = getInputLabel(is_required)
    const proofInfo = getProofLabel(proof_required_level)

    // Use repeatable card for repeatable items
    if (item.is_repeatable) {
      return renderRepeatableItemCard(selection, showProof)
    }

    return (
      <Card
        key={item.item_id}
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <Text strong>{item.item_name}</Text>
            {showProof && <Tag color={inputInfo.color}>{inputInfo.text}</Tag>}
            {showProof && <Tag color={proofInfo.color}>{proofInfo.text}</Tag>}
          </Space>
        }
      >
        {/* Description */}
        {item.description && (
          <Alert
            message={item.description}
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Fields */}
        <Space direction="vertical" style={{ width: '100%' }}>
          {item.fields.length > 0 ? (
            item.fields.map(field => (
              <div key={field.field_id} style={{ marginBottom: 12 }}>
                <Text strong>{field.field_label}</Text>
                {field.is_required && <Text type="danger"> *</Text>}
                <div style={{ marginTop: 8 }}>
                  {renderFieldInput(field)}
                </div>
              </div>
            ))
          ) : item.template ? (
            // Render based on template type
            <div>
              {(() => {
                const options = item.template_config ? (() => {
                  try {
                    return JSON.parse(item.template_config).options || []
                  } catch {
                    return []
                  }
                })() : []

                if (item.template === 'select') {
                  // 옵션이 4개 이하면 라디오 버튼으로 표시
                  if (options.length <= 4) {
                    return (
                      <Radio.Group>
                        <Space>
                          {options.map((opt: string) => (
                            <Radio key={opt} value={opt}>{opt}</Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    )
                  }
                  return (
                    <Select style={{ width: '100%' }} placeholder="선택하세요">
                      {options.map((opt: string) => (
                        <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                      ))}
                    </Select>
                  )
                } else if (item.template === 'multiselect') {
                  return (
                    <Checkbox.Group>
                      <Space wrap>
                        {options.map((opt: string) => (
                          <Checkbox key={opt} value={opt}>{opt}</Checkbox>
                        ))}
                      </Space>
                    </Checkbox.Group>
                  )
                } else if (item.template === 'number') {
                  return <InputNumber style={{ width: '100%' }} placeholder="숫자를 입력하세요" />
                } else {
                  return <Input placeholder="내용을 입력하세요" />
                }
              })()}
            </div>
          ) : (
            <div>
              <TextArea rows={2} placeholder="내용을 입력하세요" />
            </div>
          )}

          {/* Proof upload for items requiring proof */}
          {showProof && proof_required_level !== ProofRequiredLevel.NOT_REQUIRED && (
            <div style={{ marginTop: 8, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <Text type="secondary">증빙 자료 첨부</Text>
              <div style={{ marginTop: 8 }}>
                <Upload disabled>
                  <Button icon={<UploadOutlined />} disabled>파일 선택</Button>
                </Upload>
              </div>
            </div>
          )}
        </Space>
      </Card>
    )
  }

  return (
    <Modal
      title="테스트입력"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          닫기
        </Button>
      ]}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <Spin spinning={loading}>
        {/* Project Information */}
        {project && (
          <Card style={{ marginBottom: 24 }}>
            <Title level={3}>{project.project_name}</Title>

            {project.description && (
              <Paragraph style={{ fontSize: 16, color: '#666' }}>
                {project.description}
              </Paragraph>
            )}

            <Divider />

            <Descriptions column={2} size="small">
              {project.support_program_name && (
                <Descriptions.Item label="지원 프로그램">
                  {project.support_program_name}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="모집 기간">
                <CalendarOutlined style={{ marginRight: 8 }} />
                {dayjs(project.recruitment_start_date).format('YYYY.MM.DD')} ~ {dayjs(project.recruitment_end_date).format('YYYY.MM.DD')}
              </Descriptions.Item>
              {project.project_start_date && project.project_end_date && (
                <Descriptions.Item label="코칭 기간">
                  <CalendarOutlined style={{ marginRight: 8 }} />
                  {dayjs(project.project_start_date).format('YYYY.MM.DD')} ~ {dayjs(project.project_end_date).format('YYYY.MM.DD')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="모집 인원">
                <TeamOutlined style={{ marginRight: 8 }} />
                {project.max_participants}명
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* Survey Items */}
        <Collapse
          defaultActiveKey={['인적사항', '자격증', '학력', '역량 이력', '기타', '커스텀 질문']}
          style={{ marginBottom: 16 }}
        >
          {/* Personal Info - no proof */}
          {grouped['인적사항'].length > 0 && (
            <Panel header={<Text strong>인적사항</Text>} key="인적사항">
              {grouped['인적사항'].map(selection => renderItemCard(selection, false))}
            </Panel>
          )}

          {/* Certificates - with proof */}
          {grouped['자격증'].length > 0 && (
            <Panel header={<Text strong>자격증</Text>} key="자격증">
              {grouped['자격증'].map(selection => renderItemCard(selection, true))}
            </Panel>
          )}

          {/* 학력 - with proof */}
          {grouped['학력'].length > 0 && (
            <Panel header={<Text strong>학력</Text>} key="학력">
              {grouped['학력'].map(selection => renderItemCard(selection, true))}
            </Panel>
          )}

          {/* 역량 이력 - with proof */}
          {grouped['역량 이력'].length > 0 && (
            <Panel header={<Text strong>역량 이력</Text>} key="역량 이력">
              {grouped['역량 이력'].map(selection => renderItemCard(selection, true))}
            </Panel>
          )}

          {/* Others - with proof */}
          {grouped['기타'].length > 0 && (
            <Panel header={<Text strong>기타</Text>} key="기타">
              {grouped['기타'].map(selection => renderItemCard(selection, true))}
            </Panel>
          )}

          {/* Custom Questions (competency items with is_custom=true) */}
          {grouped['커스텀 질문'].length > 0 && (
            <Panel header={<Text strong>커스텀 질문</Text>} key="커스텀 질문">
              {grouped['커스텀 질문'].map(selection => renderItemCard(selection, true))}
            </Panel>
          )}

          {/* Legacy Custom Questions (old system - for backwards compatibility) */}
          {customQuestions.length > 0 && (
            <Panel header={<Text strong>추가 질문 (레거시)</Text>} key="레거시 질문">
              {customQuestions.map(q => (
                <Card key={q.question_id} size="small" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>{q.question_text}</Text>
                    {q.max_score && <Tag>배점: {Math.floor(Number(q.max_score))}점</Tag>}
                    <div style={{ marginTop: 8 }}>
                      {q.question_type === 'select' ? (
                        <Select style={{ width: '100%' }} placeholder="선택하세요">
                          {q.options && JSON.parse(q.options).map((opt: string) => (
                            <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                          ))}
                        </Select>
                      ) : (
                        <TextArea rows={3} placeholder="답변을 입력하세요" />
                      )}
                    </div>
                  </Space>
                </Card>
              ))}
            </Panel>
          )}
        </Collapse>

        {/* Submit Button (disabled - test mode) */}
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Alert
            message="테스트 화면입니다"
            description="입력 내용은 저장되지 않습니다. 실제 응모는 코치 계정으로 로그인 후 진행하세요."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" size="large" disabled>
            응모하기
          </Button>
        </div>
      </Spin>
    </Modal>
  )
}
