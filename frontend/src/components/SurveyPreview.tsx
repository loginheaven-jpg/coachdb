import { useState, useEffect } from 'react'
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

// 그룹 표시 순서 (프로필 세부정보와 일치)
const GROUP_ORDER = ['자격증', '학력', '코칭연수', '코칭경력', '기타']

// 카테고리를 그룹명으로 변환하는 헬퍼 함수
const getCategoryGroup = (item: CompetencyItem): string => {
  const itemCode = item.item_code || ''
  const template = item.template || ''
  const category = item.category || ''

  // EXP_COACHING_TRAINING 또는 coaching_time 템플릿은 '코칭연수' 그룹
  if (itemCode === 'EXP_COACHING_TRAINING' || template === 'coaching_time') {
    return '코칭연수'
  }

  // 카테고리별 그룹 매핑
  const categoryGroupMap: Record<string, string> = {
    'CERTIFICATION': '자격증',
    'EDUCATION': '학력',
    'EXPERIENCE': '코칭경력',
    'OTHER': '기타',
    // Legacy categories
    'BASIC': '기본정보',
    'DETAIL': '코칭경력',
    'ADDON': '코칭경력',
    'COACHING': '코칭경력',
    'EVALUATION': '코칭경력'
  }

  return categoryGroupMap[category] || '코칭경력'
}

// State for repeatable item rows
interface RepeatableRow {
  id: number
  value: string      // 연수명/내용 또는 기관명
  year?: string      // 이수연도
  hours?: string     // 이수시간
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

  // Group items by category (프로필 세부정보와 일치하는 5개 그룹)
  const groupItemsByCategory = () => {
    const grouped: Record<string, typeof includedItems> = {
      '자격증': [],
      '학력': [],
      '코칭연수': [],
      '코칭경력': [],
      '기타': []
    }

    const includedItems = Array.from(selections.values()).filter(s => s.included)

    includedItems.forEach(selection => {
      const groupName = getCategoryGroup(selection.item)
      // '기본정보'는 사용자 정보에서 직접 표시하므로 제외
      if (groupName === '기본정보') return

      if (grouped[groupName]) {
        grouped[groupName].push(selection)
      } else {
        grouped['코칭경력'].push(selection)
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

  const updateRowYear = (itemId: number, rowId: number, year: string) => {
    const currentRows = getRowsForItem(itemId)
    const newRows = currentRows.map(r => r.id === rowId ? { ...r, year } : r)
    setRepeatableRows(new Map(repeatableRows).set(itemId, newRows))
  }

  const updateRowHours = (itemId: number, rowId: number, hours: string) => {
    const currentRows = getRowsForItem(itemId)
    const newRows = currentRows.map(r => r.id === rowId ? { ...r, hours } : r)
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

  // coaching_time, coaching_experience 템플릿 여부 확인
  const isStructuredTemplate = (template: string | null | undefined) => {
    return template === 'coaching_time' || template === 'coaching_experience'
  }

  // 템플릿별 필드 라벨 가져오기
  const getTemplateFieldLabels = (template: string | null | undefined) => {
    if (template === 'coaching_time') {
      return { main: '연수명/내용', year: '이수연도', hours: '이수시간' }
    } else if (template === 'coaching_experience') {
      return { main: '기관명', year: '연도', hours: '시간' }
    }
    return { main: '내용', year: '연도', hours: '시간' }
  }

  // Render repeatable item with row-based input
  const renderRepeatableItemCard = (selection: typeof includedItems[0], showProof: boolean) => {
    const { item, is_required, proof_required_level } = selection
    const inputInfo = getInputLabel(is_required)
    const proofInfo = getProofLabel(proof_required_level)
    const rows = getRowsForItem(item.item_id)
    const isStructured = isStructuredTemplate(item.template)
    const fieldLabels = getTemplateFieldLabels(item.template)

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
                marginBottom: 12,
                padding: '12px 16px',
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #f0f0f0'
              }}
            >
              {/* Header with row number and delete button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isStructured ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  {!isStructured && (
                    <Input
                      placeholder={`${item.item_name}을(를) 입력하세요`}
                      value={row.value}
                      onChange={(e) => updateRowValue(item.item_id, row.id, e.target.value)}
                      style={{ flex: 1, width: 300 }}
                    />
                  )}
                </div>
                <Space>
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
                </Space>
              </div>

              {/* Structured fields for coaching_time/coaching_experience */}
              {isStructured && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{fieldLabels.main}</Text>
                    <Input
                      placeholder={fieldLabels.main}
                      value={row.value}
                      onChange={(e) => updateRowValue(item.item_id, row.id, e.target.value)}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{fieldLabels.year}</Text>
                    <Input
                      placeholder={fieldLabels.year}
                      value={row.year || ''}
                      onChange={(e) => updateRowYear(item.item_id, row.id, e.target.value)}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{fieldLabels.hours}</Text>
                    <Input
                      placeholder={fieldLabels.hours}
                      value={row.hours || ''}
                      onChange={(e) => updateRowHours(item.item_id, row.id, e.target.value)}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                </div>
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
                } else if (item.template === 'file') {
                  // 파일 업로드만
                  return (
                    <Upload disabled>
                      <Button icon={<UploadOutlined />} disabled>파일 선택</Button>
                    </Upload>
                  )
                } else if (item.template === 'text_file') {
                  // 텍스트 + 파일
                  return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input placeholder="내용을 입력하세요" />
                      <Upload disabled>
                        <Button icon={<UploadOutlined />} disabled>증빙 파일 첨부</Button>
                      </Upload>
                    </Space>
                  )
                } else if (item.template === 'degree') {
                  // 학위: 선택 + 전공 + 파일
                  return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>학위</Text>
                        <Select style={{ width: '100%', marginTop: 4 }} placeholder="학위 선택">
                          <Select.Option value="bachelor">학사</Select.Option>
                          <Select.Option value="master">석사</Select.Option>
                          <Select.Option value="doctorate">박사</Select.Option>
                        </Select>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>전공</Text>
                        <Input placeholder="전공을 입력하세요" style={{ marginTop: 4 }} />
                      </div>
                      <Upload disabled>
                        <Button icon={<UploadOutlined />} disabled>졸업증명서 첨부</Button>
                      </Upload>
                    </Space>
                  )
                } else if (item.template === 'coaching_time') {
                  // 코칭연수: 내용 + 연도 + 시간
                  return (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 2, minWidth: 200 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>연수명/내용</Text>
                        <Input placeholder="연수명/내용" style={{ marginTop: 4 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>이수연도</Text>
                        <Input placeholder="이수연도" style={{ marginTop: 4 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>이수시간</Text>
                        <Input placeholder="이수시간" style={{ marginTop: 4 }} />
                      </div>
                    </div>
                  )
                } else if (item.template === 'coaching_experience') {
                  // 코칭경력: 기관명 + 연도 + 시간
                  return (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 2, minWidth: 200 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>기관명</Text>
                        <Input placeholder="기관명" style={{ marginTop: 4 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>연도</Text>
                        <Input placeholder="연도" style={{ marginTop: 4 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>시간</Text>
                        <Input placeholder="시간" style={{ marginTop: 4 }} />
                      </div>
                    </div>
                  )
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
          defaultActiveKey={GROUP_ORDER}
          style={{ marginBottom: 16 }}
        >
          {/* 그룹별 항목 렌더링 (프로필 세부정보와 동일한 순서) */}
          {GROUP_ORDER.map(groupName => {
            const items = grouped[groupName]
            if (!items || items.length === 0) return null
            return (
              <Panel header={<Text strong>{groupName} ({items.length})</Text>} key={groupName}>
                {items.map(selection => renderItemCard(selection, true))}
              </Panel>
            )
          })}

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
