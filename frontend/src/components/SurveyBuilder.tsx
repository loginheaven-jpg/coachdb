/**
 * 설문 구성 컴포넌트
 *
 * 역량 항목과 커스텀 질문을 통합하여 관리하는 UI
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Modal,
  Card,
  Switch,
  InputNumber,
  Button,
  Space,
  Typography,
  Tag,
  message,
  Alert,
  Collapse,
  Input,
  Select,
  Radio
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import projectService, {
  CompetencyItem,
  ProjectItem,
  CustomQuestion,
  ItemTemplate,
  ProofRequiredLevel,
  CompetencyItemCreate
} from '../services/projectService'
import SurveyPreview from './SurveyPreview'
import { Form } from 'antd'

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), wait)
  }
}

const { Title, Text } = Typography
const { Panel } = Collapse

interface SurveyBuilderProps {
  projectId: number
  visible: boolean
  onClose: () => void
  onSave: () => void
}

interface ItemSelection {
  item: CompetencyItem
  included: boolean
  is_required: boolean  // 입력 필수 여부
  score: number | null
  proof_required_level: ProofRequiredLevel
}

interface GroupedItems {
  [category: string]: ItemSelection[]
}

export default function SurveyBuilder({ projectId, visible, onClose, onSave }: SurveyBuilderProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allItems, setAllItems] = useState<CompetencyItem[]>([])
  const [selections, setSelections] = useState<Map<number, ItemSelection>>(new Map())
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const initialSelectionsRef = useRef<string>('')

  // 커스텀 질문 생성 모달
  const [showCustomQuestionModal, setShowCustomQuestionModal] = useState(false)
  const [customQuestionForm] = Form.useForm()
  const [creatingCustom, setCreatingCustom] = useState(false)

  useEffect(() => {
    if (visible) {
      loadData()
      setHasChanges(false)
    }
  }, [visible, projectId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all competency items and filter out user profile items (personal info is from registration)
      const USER_PROFILE_ITEM_CODES = [
        'BASIC_NAME', 'BASIC_PHONE', 'BASIC_EMAIL', 'BASIC_ADDRESS',
        'BASIC_GENDER', 'BASIC_BIRTHDATE', 'DETAIL_COACHING_AREA', 'DETAIL_CERT_NUMBER'
      ]
      const allItemsFromApi = await projectService.getCompetencyItems()
      const items = allItemsFromApi.filter(item => !USER_PROFILE_ITEM_CODES.includes(item.item_code))
      setAllItems(items)

      // Load existing project items
      const existingItems = await projectService.getProjectItems(projectId)

      // Initialize selections
      // - DB에 저장된 항목: 저장된 상태 유지
      // - 새 항목: 기타(OTHER) 카테고리, 커스텀은 불포함, 나머지는 포함
      const newSelections = new Map<number, ItemSelection>()
      items.forEach(item => {
        const existing = existingItems.find(pi => pi.item_id === item.item_id)
        // 기타(OTHER) 카테고리, ADDON(legacy), 커스텀은 기본 불포함
        const isOtherGroup = item.category === 'OTHER' || item.category === 'ADDON' || item.is_custom
        const defaultIncluded = existing ? true : !isOtherGroup
        newSelections.set(item.item_id, {
          item,
          included: existing ? true : defaultIncluded,
          is_required: existing?.is_required ?? true,  // 기본값: 필수
          score: existing?.max_score ?? null,
          proof_required_level: existing?.proof_required_level || ProofRequiredLevel.NOT_REQUIRED
        })
      })
      setSelections(newSelections)

      // 초기 상태 저장 (변경 감지용)
      initialSelectionsRef.current = JSON.stringify(Array.from(newSelections.entries()))

      // Load custom questions
      const questions = await projectService.getProjectQuestions(projectId)
      setCustomQuestions(questions)
    } catch (error: any) {
      console.error('데이터 로드 실패:', error)
      message.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 카테고리별 그룹명 매핑 (백엔드 CompetencyCategory enum과 일치)
  const CATEGORY_GROUP_MAP: Record<string, string> = {
    'BASIC': '기본정보',
    'CERTIFICATION': '자격증',
    'EDUCATION': '학력',
    'EXPERIENCE': '역량이력',
    'OTHER': '기타',
    // Legacy 카테고리 호환
    'DETAIL': '역량이력',     // DETAIL → 역량이력으로 매핑
    'ADDON': '기타',          // ADDON → 기타로 매핑
    'COACHING': '역량이력',   // COACHING → 역량이력으로 매핑
    'EVALUATION': '역량이력', // EVALUATION → 역량이력으로 매핑
    'INFO': '기본정보'        // INFO → 기본정보로 매핑
  }

  // 그룹 우선순위 (저장 시 display_order 결정에 사용)
  const GROUP_PRIORITY: Record<string, number> = {
    '기본정보': 1,
    '자격증': 2,
    '학력': 3,
    '역량이력': 4,
    '기타': 5
  }

  // 그룹 우선순위 반환 (카테고리 기반)
  const getGroupPriority = (category: string, isCustom: boolean): number => {
    if (isCustom) return 5  // 커스텀 항목은 기타 그룹
    const groupName = CATEGORY_GROUP_MAP[category] || '역량이력'
    return GROUP_PRIORITY[groupName] || 4
  }

  const groupItemsByCategory = (): GroupedItems => {
    const grouped: GroupedItems = {
      '자격증': [],
      '학력': [],
      '역량이력': [],
      '기타': []
    }

    selections.forEach(selection => {
      const category = selection.item.category || 'EXPERIENCE'

      // 커스텀 항목은 기타 그룹
      if (selection.item.is_custom) {
        grouped['기타'].push(selection)
        return
      }

      // 카테고리에 따라 그룹 결정
      const groupName = CATEGORY_GROUP_MAP[category] || '역량이력'

      // 기본정보(BASIC)는 User 테이블에서 직접 표시하므로 설문에서 제외
      if (groupName === '기본정보') {
        return
      }

      if (grouped[groupName]) {
        grouped[groupName].push(selection)
      } else {
        grouped['역량이력'].push(selection)  // 매핑되지 않은 카테고리는 역량이력으로
      }
    })

    return grouped
  }

  // 기본정보 카테고리인지 확인 (배점 및 증빙 설정 제외 대상)
  const isBasicCategory = (category: string): boolean => {
    return CATEGORY_GROUP_MAP[category] === '기본정보'
  }

  // 자동 저장 함수 (debounce)
  const autoSaveDebounced = useCallback(
    debounce(async (selectionsToSave: Map<number, ItemSelection>) => {
      try {
        setSaving(true)
        const existingItems = await projectService.getProjectItems(projectId)

        // Delete removed items
        const toDelete = existingItems.filter(
          existing => !Array.from(selectionsToSave.values()).find(
            s => s.included && s.item.item_id === existing.item_id
          )
        )
        for (const item of toDelete) {
          await projectService.deleteProjectItem(projectId, item.project_item_id)
        }

        // Add/Update included items (그룹 순서대로 정렬)
        const sortedSelections = Array.from(selectionsToSave.values())
          .filter(s => s.included)
          .sort((a, b) => {
            const priorityA = getGroupPriority(a.item.category || 'EXPERIENCE', a.item.is_custom)
            const priorityB = getGroupPriority(b.item.category || 'EXPERIENCE', b.item.is_custom)
            return priorityA - priorityB
          })

        let displayOrder = 1
        for (const selection of sortedSelections) {
          const existing = existingItems.find(e => e.item_id === selection.item.item_id)
          // 기본정보 카테고리는 증빙 불필요로 강제 설정
          const isBasic = isBasicCategory(selection.item.category || '')
          const itemData = {
            item_id: selection.item.item_id,
            is_required: selection.is_required,
            proof_required_level: isBasic ? ProofRequiredLevel.NOT_REQUIRED : selection.proof_required_level,
            max_score: isBasic ? null : selection.score,  // 기본정보는 배점도 없음
            display_order: displayOrder++,
            scoring_criteria: []
          }

          if (existing) {
            await projectService.updateProjectItem(projectId, existing.project_item_id, itemData)
          } else {
            await projectService.addProjectItem(projectId, itemData)
          }
        }

        message.success('자동 저장됨', 1)
        setHasChanges(false)
      } catch (error) {
        console.error('자동 저장 실패:', error)
      } finally {
        setSaving(false)
      }
    }, 2000),
    [projectId]
  )

  const updateSelection = (itemId: number, updates: Partial<ItemSelection>) => {
    const newSelections = new Map(selections)
    const current = newSelections.get(itemId)
    if (current) {
      newSelections.set(itemId, { ...current, ...updates })
      setSelections(newSelections)
      setHasChanges(true)

      // 자동 저장 트리거
      autoSaveDebounced(newSelections)
    }
  }

  const calculateTotalScore = (): number => {
    let total = 0
    selections.forEach(selection => {
      // 기본정보 카테고리는 배점에서 제외
      if (selection.included && selection.score && !isBasicCategory(selection.item.category || '')) {
        total += Math.floor(Number(selection.score))
      }
    })
    customQuestions.forEach(q => {
      if (q.max_score) {
        total += Math.floor(Number(q.max_score))
      }
    })
    return total
  }

  const handleSave = async () => {
    const totalScore = calculateTotalScore()
    if (totalScore !== 100) {
      message.error(`총 배점이 100점이 아닙니다. 현재: ${totalScore}점`)
      return
    }

    setLoading(true)
    try {
      // Get existing items
      const existingItems = await projectService.getProjectItems(projectId)

      // Delete removed items
      const toDelete = existingItems.filter(
        existing => !Array.from(selections.values()).find(
          s => s.included && s.item.item_id === existing.item_id
        )
      )
      for (const item of toDelete) {
        await projectService.deleteProjectItem(projectId, item.project_item_id)
      }

      // Add/Update included items (그룹 순서대로 정렬)
      const sortedSelections = Array.from(selections.values())
        .filter(s => s.included)
        .sort((a, b) => {
          const priorityA = getGroupPriority(a.item.category || 'EXPERIENCE', a.item.is_custom)
          const priorityB = getGroupPriority(b.item.category || 'EXPERIENCE', b.item.is_custom)
          return priorityA - priorityB
        })

      let displayOrder = 1
      for (const selection of sortedSelections) {
        const existing = existingItems.find(e => e.item_id === selection.item.item_id)
        // 기본정보 카테고리는 증빙 불필요로 강제 설정
        const isBasic = isBasicCategory(selection.item.category || '')
        const itemData = {
          item_id: selection.item.item_id,
          is_required: selection.is_required,
          proof_required_level: isBasic ? ProofRequiredLevel.NOT_REQUIRED : selection.proof_required_level,
          max_score: isBasic ? null : selection.score,  // 기본정보는 배점도 없음
          display_order: displayOrder++,
          scoring_criteria: []
        }

        if (existing) {
          await projectService.updateProjectItem(projectId, existing.project_item_id, itemData)
        } else {
          await projectService.addProjectItem(projectId, itemData)
        }
      }

      message.success('설문 구성이 저장되었습니다.')
      setHasChanges(false)
      onSave()
      onClose()
    } catch (error: any) {
      console.error('저장 실패:', error)
      message.error('저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 닫기 전 확인 핸들러
  const handleClose = () => {
    if (hasChanges) {
      Modal.confirm({
        title: '변경사항이 있습니다',
        icon: <ExclamationCircleOutlined />,
        content: '저장하지 않은 변경사항이 있습니다. 정말 닫으시겠습니까?',
        okText: '닫기',
        cancelText: '취소',
        onOk: () => {
          setHasChanges(false)
          onClose()
        }
      })
    } else {
      onClose()
    }
  }

  // 커스텀 질문 생성 핸들러
  const handleCreateCustomQuestion = async (values: any) => {
    setCreatingCustom(true)
    try {
      const createData: CompetencyItemCreate = {
        item_name: values.item_name,
        category: 'ADDON',  // Default category (대문자 필수)
        input_type: 'text',  // Deprecated but required
        template: values.template || ItemTemplate.TEXT,
        template_config: values.field_options ? JSON.stringify({ options: values.field_options.split('\n').filter((o: string) => o.trim()) }) : null,
        is_repeatable: values.is_repeatable || false,
        max_entries: values.max_entries || null,
        description: values.description || null,
        is_custom: true,
        fields: [{
          field_name: 'value',
          field_label: values.item_name,
          field_type: values.template || 'text',
          field_options: values.field_options ? JSON.stringify(values.field_options.split('\n').filter((o: string) => o.trim())) : null,
          is_required: true,
          display_order: 0,
          placeholder: values.placeholder || null
        }]
      }

      const newItem = await projectService.createCustomCompetencyItem(createData)

      // 새 항목을 selections에 추가
      const newSelections = new Map(selections)
      newSelections.set(newItem.item_id, {
        item: newItem,
        included: true,
        is_required: true,  // 커스텀 질문은 기본적으로 필수
        score: null,
        proof_required_level: ProofRequiredLevel.REQUIRED
      })
      setSelections(newSelections)
      setAllItems([...allItems, newItem])

      message.success('커스텀 질문이 생성되었습니다.')
      setShowCustomQuestionModal(false)
      customQuestionForm.resetFields()
      setHasChanges(true)
      autoSaveDebounced(newSelections)
    } catch (error: any) {
      console.error('커스텀 질문 생성 실패:', error)
      message.error(error.response?.data?.detail || '커스텀 질문 생성에 실패했습니다.')
    } finally {
      setCreatingCustom(false)
    }
  }

  const grouped = groupItemsByCategory()
  const totalScore = calculateTotalScore()
  const isValid = totalScore === 100

  return (
    <Modal
      title={
        <Space>
          <span>설문 구성</span>
          {saving && <Tag color="processing">저장 중...</Tag>}
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      maskClosable={false}
      keyboard={false}
      width={1200}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 250px)',
          overflowY: 'auto',
          paddingTop: 0
        }
      }}
      footer={[
        <Button key="preview" icon={<EyeOutlined />} onClick={() => setShowPreview(true)}>
          테스트입력
        </Button>,
        <Button key="cancel" onClick={handleClose}>
          취소
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
          disabled={!isValid}
        >
          저장
        </Button>
      ]}
    >
      {/* Sticky Score Display */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#fff',
        paddingTop: 16,
        paddingBottom: 16,
        marginBottom: 16,
        borderBottom: '1px solid #f0f0f0'
      }}>
        <Alert
          message={
            <Space>
              <Text strong style={{ fontSize: 16 }}>총 배점: {totalScore}/100점</Text>
              {isValid ? (
                <Tag icon={<CheckCircleOutlined />} color="success">유효</Tag>
              ) : (
                <Tag icon={<WarningOutlined />} color="warning">
                  {totalScore < 100 ? `${100 - totalScore}점 부족` : `${totalScore - 100}점 초과`}
                </Tag>
              )}
            </Space>
          }
          type={isValid ? 'success' : 'warning'}
        />
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Item Groups */}
        <Collapse defaultActiveKey={['자격증', '학력', '역량이력', '기타']}>
          {Object.entries(grouped).map(([category, items]) => {
            // 커스텀 질문 그룹은 항목이 없어도 표시 (+ 버튼이 있으므로)
            if (items.length === 0 && category !== '커스텀 질문') return null

            return (
              <Panel
                key={category}
                header={
                  <Space>
                    <Text strong>{category}</Text>
                    {category === '커스텀 질문' && (
                      <Tag color="purple">{items.length}개</Tag>
                    )}
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {items.map(selection => (
                    <Card key={selection.item.item_id} size="small">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            <Switch
                              checked={selection.included}
                              onChange={(checked) => updateSelection(selection.item.item_id, { included: checked })}
                              checkedChildren="포함"
                              unCheckedChildren="불포함"
                            />
                            <Text strong>{selection.item.item_name}</Text>
                            {selection.item.is_repeatable && (
                              <Tag color="blue">복수 가능</Tag>
                            )}
                            {selection.item.template && (
                              <Tag>{selection.item.template}</Tag>
                            )}
                            {selection.item.is_custom && (
                              <Tag color="purple">커스텀</Tag>
                            )}
                          </Space>

                          {/* 포함된 항목에 배점 표시 (기본정보는 설문에서 제외됨) */}
                          {selection.included && (
                            <Space>
                              <Text>배점:</Text>
                              <InputNumber
                                min={0}
                                max={100}
                                value={selection.score || undefined}
                                onChange={(value) => updateSelection(selection.item.item_id, { score: value })}
                                style={{ width: 80 }}
                                placeholder="점수"
                              />
                            </Space>
                          )}
                        </Space>

                        {/* 포함된 항목에 입력/증빙 옵션 표시 (기본정보는 설문에서 제외됨) */}
                        {selection.included && (
                          <Space wrap>
                            {/* 입력 필수 여부 */}
                            <Space>
                              <Text type="secondary">입력:</Text>
                              <Radio.Group
                                value={selection.is_required}
                                onChange={(e) => updateSelection(selection.item.item_id, {
                                  is_required: e.target.value
                                })}
                                size="small"
                              >
                                <Radio.Button value={true}>필수</Radio.Button>
                                <Radio.Button value={false}>선택</Radio.Button>
                              </Radio.Group>
                            </Space>

                            {/* 증빙 필수 여부 */}
                            <Space>
                              <Text type="secondary">증빙:</Text>
                              <Radio.Group
                                value={selection.proof_required_level}
                                onChange={(e) => updateSelection(selection.item.item_id, {
                                  proof_required_level: e.target.value
                                })}
                                size="small"
                              >
                                <Radio.Button value="required">필수</Radio.Button>
                                <Radio.Button value="optional">선택</Radio.Button>
                                <Radio.Button value="not_required">불필요</Radio.Button>
                              </Radio.Group>
                            </Space>
                          </Space>
                        )}
                      </Space>
                    </Card>
                  ))}

                  {/* 커스텀 질문 그룹에만 추가 버튼 표시 */}
                  {category === '커스텀 질문' && (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      block
                      onClick={() => setShowCustomQuestionModal(true)}
                    >
                      커스텀 질문 추가
                    </Button>
                  )}
                </Space>
              </Panel>
            )
          })}
        </Collapse>
      </Space>

      {/* Preview Modal - 실제 응모 화면 */}
      <SurveyPreview
        projectId={projectId}
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        selections={selections}
        customQuestions={customQuestions}
      />

      {/* Custom Question Creation Modal */}
      <Modal
        title="커스텀 질문 추가"
        open={showCustomQuestionModal}
        onCancel={() => {
          setShowCustomQuestionModal(false)
          customQuestionForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={customQuestionForm}
          layout="vertical"
          onFinish={handleCreateCustomQuestion}
          initialValues={{
            template: ItemTemplate.TEXT,
            is_repeatable: false
          }}
        >
          <Form.Item
            name="item_name"
            label="질문 제목"
            rules={[{ required: true, message: '질문 제목을 입력해주세요' }]}
          >
            <Input placeholder="예: 희망 근무 지역" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명 (선택)"
          >
            <Input.TextArea
              placeholder="코치에게 보여줄 안내 문구를 입력하세요"
              rows={2}
            />
          </Form.Item>

          <Form.Item
            name="template"
            label="입력 유형"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={ItemTemplate.TEXT}>텍스트 (짧은 답변)</Select.Option>
              <Select.Option value={ItemTemplate.NUMBER}>숫자</Select.Option>
              <Select.Option value={ItemTemplate.SELECT}>선택형 (단일)</Select.Option>
              <Select.Option value={ItemTemplate.MULTISELECT}>선택형 (복수)</Select.Option>
              <Select.Option value={ItemTemplate.FILE}>파일 업로드</Select.Option>
              <Select.Option value={ItemTemplate.TEXT_FILE}>텍스트 + 파일</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.template !== curr.template}
          >
            {({ getFieldValue }) => {
              const template = getFieldValue('template')
              if (template === ItemTemplate.SELECT || template === ItemTemplate.MULTISELECT) {
                return (
                  <Form.Item
                    name="field_options"
                    label="선택 옵션 (줄바꿈으로 구분)"
                    rules={[{ required: true, message: '선택 옵션을 입력해주세요' }]}
                  >
                    <Input.TextArea
                      placeholder="옵션1&#10;옵션2&#10;옵션3"
                      rows={4}
                    />
                  </Form.Item>
                )
              }
              return null
            }}
          </Form.Item>

          <Form.Item
            name="placeholder"
            label="플레이스홀더 (선택)"
          >
            <Input placeholder="입력창에 표시할 안내 문구" />
          </Form.Item>

          <Form.Item
            name="is_repeatable"
            valuePropName="checked"
          >
            <Switch checkedChildren="복수 입력 가능" unCheckedChildren="단일 입력" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.is_repeatable !== curr.is_repeatable}
          >
            {({ getFieldValue }) => {
              if (getFieldValue('is_repeatable')) {
                return (
                  <Form.Item
                    name="max_entries"
                    label="최대 입력 개수"
                  >
                    <InputNumber min={2} max={20} placeholder="제한 없음" />
                  </Form.Item>
                )
              }
              return null
            }}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setShowCustomQuestionModal(false)
                customQuestionForm.resetFields()
              }}>
                취소
              </Button>
              <Button type="primary" htmlType="submit" loading={creatingCustom}>
                추가
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  )
}
