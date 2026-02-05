import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Table,
  Tag,
  message,
  Space,
  Select,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Popconfirm,
  Tabs,
  Descriptions,
  Alert
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  SyncOutlined
} from '@ant-design/icons'
import api from '../services/api'
import competencyService, {
  CompetencyItem,
  CompetencyItemCreate,
  CompetencyItemUpdate,
  CompetencyItemField,
  CompetencyItemFieldCreate
} from '../services/competencyService'
import scoringTemplateService, {
  ScoringTemplate,
  ScoringTemplateCreate,
  ScoringTemplateUpdate,
  GradeMapping
} from '../services/scoringTemplateService'
import inputTemplateService, {
  InputTemplate,
  InputTemplateCreate,
  InputTemplateUpdate,
  FieldSchema
} from '../services/inputTemplateService'

const { Title, Text } = Typography

const CATEGORY_OPTIONS = [
  { label: '자격증', value: 'CERTIFICATION' },
  { label: '학력', value: 'EDUCATION' },
  { label: '코칭경력', value: 'EXPERIENCE' },
  { label: '기타', value: 'OTHER' },
  // Legacy categories
  { label: '기본정보', value: 'BASIC' },
  { label: '세부정보', value: 'DETAIL' },
  { label: '추가역량', value: 'ADDON' },
  { label: '코칭이력', value: 'COACHING' }
]

const TEMPLATE_OPTIONS = [
  { label: '텍스트', value: 'text' },
  { label: '숫자', value: 'number' },
  { label: '단일선택', value: 'select' },
  { label: '다중선택', value: 'multiselect' },
  { label: '파일', value: 'file' },
  { label: '텍스트+파일', value: 'text_file' },
  { label: '학위', value: 'degree' },
  { label: '코칭이력', value: 'coaching_history' },
  { label: '코칭시간', value: 'coaching_time' },
  { label: '코칭경력', value: 'coaching_experience' }
]

// 등급 유형 옵션
const GRADE_TYPE_OPTIONS = [
  { label: '문자열', value: 'string' },
  { label: '숫자', value: 'numeric' },
  { label: '파일유무', value: 'file_exists' },
  { label: '복수선택', value: 'multi_select' }
]

// 매칭 유형 옵션
const MATCHING_TYPE_OPTIONS = [
  { label: '정확히 일치', value: 'exact' },
  { label: '포함', value: 'contains' },
  { label: '범위', value: 'range' },
  { label: '등급', value: 'grade' }
]

// 값 소스 옵션
const VALUE_SOURCE_OPTIONS = [
  { label: '제출값', value: 'SUBMITTED' },
  { label: '사용자 필드', value: 'USER_FIELD' },
  { label: 'JSON 필드', value: 'JSON_FIELD' }
]

// 집계 방식 옵션
const AGGREGATION_MODE_OPTIONS = [
  { label: '첫번째만', value: 'first' },
  { label: '합계', value: 'sum' },
  { label: '최대값', value: 'max' },
  { label: '개수', value: 'count' },
  { label: '하나라도 일치', value: 'any_match' },
  { label: '최고점수', value: 'best_match' }
]

// 증빙 필수 옵션
const PROOF_REQUIRED_OPTIONS = [
  { label: '불필요', value: 'NOT_REQUIRED' },
  { label: '선택', value: 'OPTIONAL' },
  { label: '필수', value: 'REQUIRED' }
]

const FIELD_TYPE_OPTIONS = [
  { label: '텍스트', value: 'text' },
  { label: '숫자', value: 'number' },
  { label: '선택', value: 'select' },
  { label: '다중선택', value: 'multiselect' },
  { label: '파일', value: 'file' }
]

export default function AdminCompetencyItemsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('items')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CompetencyItem[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [showInactive, setShowInactive] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)

  // 평가 템플릿 관련 상태
  const [templates, setTemplates] = useState<ScoringTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false)
  const [isTemplateCreateModalOpen, setIsTemplateCreateModalOpen] = useState(false)
  const [isTemplateEditModalOpen, setIsTemplateEditModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ScoringTemplate | null>(null)
  const [gradeMappings, setGradeMappings] = useState<GradeMapping[]>([])
  const [keywords, setKeywords] = useState<string[]>([])

  // 입력 템플릿 관련 상태
  const [inputTemplates, setInputTemplates] = useState<InputTemplate[]>([])
  const [inputTemplatesLoading, setInputTemplatesLoading] = useState(false)
  const [showInactiveInputTemplates, setShowInactiveInputTemplates] = useState(false)
  const [isInputTemplateCreateModalOpen, setIsInputTemplateCreateModalOpen] = useState(false)
  const [isInputTemplateEditModalOpen, setIsInputTemplateEditModalOpen] = useState(false)
  const [editingInputTemplate, setEditingInputTemplate] = useState<InputTemplate | null>(null)
  const [fieldsSchema, setFieldsSchema] = useState<FieldSchema[]>([])
  const [inputKeywords, setInputKeywords] = useState<string[]>([])

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CompetencyItem | null>(null)
  const [editingField, setEditingField] = useState<CompetencyItemField | null>(null)

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [fieldForm] = Form.useForm()
  const [templateCreateForm] = Form.useForm()
  const [templateEditForm] = Form.useForm()
  const [inputTemplateCreateForm] = Form.useForm()
  const [inputTemplateEditForm] = Form.useForm()

  useEffect(() => {
    loadItems()
    loadTemplates()
    loadInputTemplates()
  }, [showInactive, showInactiveTemplates, showInactiveInputTemplates])

  // Update editingItem when items change (for field modal updates)
  useEffect(() => {
    if (editingItem && isFieldModalOpen) {
      const updatedItem = items.find(item => item.item_id === editingItem.item_id)
      if (updatedItem) {
        setEditingItem(updatedItem)
      }
    }
  }, [items])

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await competencyService.getAllCompetencyItems(showInactive)
      setItems(data)
    } catch (error: any) {
      console.error('역량항목 로드 실패:', error)
      message.error('역량항목을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const data = await scoringTemplateService.getAll(!showInactiveTemplates)
      setTemplates(data)
    } catch (error: any) {
      console.error('평가 템플릿 로드 실패:', error)
      message.error('평가 템플릿을 불러오는데 실패했습니다.')
    } finally {
      setTemplatesLoading(false)
    }
  }

  const loadInputTemplates = async () => {
    setInputTemplatesLoading(true)
    try {
      const data = await inputTemplateService.getAll(!showInactiveInputTemplates)
      setInputTemplates(data)
    } catch (error: any) {
      console.error('입력 템플릿 로드 실패:', error)
      message.error('입력 템플릿을 불러오는데 실패했습니다.')
    } finally {
      setInputTemplatesLoading(false)
    }
  }

  const handleSeed = async () => {
    setSeedLoading(true)
    try {
      const response = await api.post('/admin/seed-competency-items?secret_key=coachdb2024!')
      const data = response.data
      message.success(`역량항목 초기화 완료: ${data.created}개 생성, ${data.skipped}개 스킵`)
      loadItems()
    } catch (error: any) {
      console.error('역량항목 초기화 실패:', error)
      message.error(error.response?.data?.detail || '역량항목 초기화에 실패했습니다.')
    } finally {
      setSeedLoading(false)
    }
  }

  const handleClear = async () => {
    setClearLoading(true)
    try {
      await api.post('/admin/clear-competency-items?secret_key=coachdb2024!')
      message.success('역량항목 전체 삭제 완료')
      loadItems()
    } catch (error: any) {
      console.error('역량항목 삭제 실패:', error)
      message.error(error.response?.data?.detail || '역량항목 삭제에 실패했습니다.')
    } finally {
      setClearLoading(false)
    }
  }

  const getCategoryTag = (category: string) => {
    const colorMap: Record<string, string> = {
      CERTIFICATION: 'gold',
      EDUCATION: 'orange',
      EXPERIENCE: 'green',
      OTHER: 'default',
      // Legacy
      BASIC: 'blue',
      DETAIL: 'green',
      ADDON: 'purple',
      COACHING: 'cyan'
    }
    const labelMap: Record<string, string> = {
      CERTIFICATION: '자격증',
      EDUCATION: '학력',
      EXPERIENCE: '코칭경력',
      OTHER: '기타',
      // Legacy
      BASIC: '기본정보',
      DETAIL: '세부정보',
      ADDON: '추가역량',
      COACHING: '코칭이력'
    }
    return <Tag color={colorMap[category]}>{labelMap[category] || category}</Tag>
  }

  const handleCreate = async (values: CompetencyItemCreate) => {
    try {
      await competencyService.createCompetencyItem({
        ...values,
        input_type: 'text' // Default deprecated field
      })
      message.success('역량항목이 생성되었습니다.')
      setIsCreateModalOpen(false)
      createForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('생성 실패:', error)
      message.error(error.response?.data?.detail || '생성에 실패했습니다.')
    }
  }

  const handleEdit = async (values: CompetencyItemUpdate) => {
    if (!editingItem) return
    try {
      await competencyService.updateCompetencyItem(editingItem.item_id, values)
      message.success('역량항목이 수정되었습니다.')
      setIsEditModalOpen(false)
      setEditingItem(null)
      editForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('수정 실패:', error)
      message.error(error.response?.data?.detail || '수정에 실패했습니다.')
    }
  }

  const handleDelete = async (itemId: number) => {
    try {
      await competencyService.deleteCompetencyItem(itemId)
      message.success('역량항목이 비활성화되었습니다.')
      loadItems()
    } catch (error: any) {
      console.error('삭제 실패:', error)
      message.error(error.response?.data?.detail || '삭제에 실패했습니다.')
    }
  }

  const handleAddField = async (values: CompetencyItemFieldCreate) => {
    if (!editingItem) return
    try {
      await competencyService.createCompetencyItemField(editingItem.item_id, values)
      message.success('필드가 추가되었습니다.')
      setIsFieldModalOpen(false)
      fieldForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('필드 추가 실패:', error)
      message.error(error.response?.data?.detail || '필드 추가에 실패했습니다.')
    }
  }

  const handleDeleteField = async (itemId: number, fieldId: number) => {
    try {
      await competencyService.deleteCompetencyItemField(itemId, fieldId)
      message.success('필드가 삭제되었습니다.')
      loadItems()
    } catch (error: any) {
      console.error('필드 삭제 실패:', error)
      message.error(error.response?.data?.detail || '필드 삭제에 실패했습니다.')
    }
  }

  const openEditModal = (item: CompetencyItem) => {
    setEditingItem(item)
    editForm.setFieldsValue({
      item_name: item.item_name,
      category: item.category,
      template: item.template,
      template_config: item.template_config,
      is_repeatable: item.is_repeatable,
      max_entries: item.max_entries,
      is_active: item.is_active,
      scoring_template_id: item.scoring_template_id
    })
    setIsEditModalOpen(true)
  }

  const openFieldModal = (item: CompetencyItem) => {
    setEditingItem(item)
    setEditingField(null)
    fieldForm.resetFields()
    setIsFieldModalOpen(true)
  }

  const handleEditField = (field: CompetencyItemField) => {
    setEditingField(field)
    fieldForm.setFieldsValue({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_options: field.field_options,
      is_required: field.is_required,
      display_order: field.display_order,
      placeholder: field.placeholder
    })
  }

  const handleUpdateField = async (values: CompetencyItemFieldCreate) => {
    if (!editingItem || !editingField) return
    try {
      await competencyService.updateCompetencyItemField(editingItem.item_id, editingField.field_id, values)
      message.success('필드가 수정되었습니다.')
      setEditingField(null)
      fieldForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('필드 수정 실패:', error)
      message.error(error.response?.data?.detail || '필드 수정에 실패했습니다.')
    }
  }

  const handleFieldSubmit = async (values: CompetencyItemFieldCreate) => {
    if (editingField) {
      await handleUpdateField(values)
    } else {
      await handleAddField(values)
    }
  }

  const cancelFieldEdit = () => {
    setEditingField(null)
    fieldForm.resetFields()
  }

  // 평가 템플릿 CRUD
  const handleCreateTemplate = async (values: any) => {
    try {
      const templateData: ScoringTemplateCreate = {
        ...values,
        default_mappings: scoringTemplateService.stringifyMappings(gradeMappings),
        keywords: scoringTemplateService.stringifyKeywords(keywords)
      }
      await scoringTemplateService.create(templateData)
      message.success('평가 템플릿이 생성되었습니다.')
      setIsTemplateCreateModalOpen(false)
      templateCreateForm.resetFields()
      setGradeMappings([])
      setKeywords([])
      loadTemplates()
    } catch (error: any) {
      console.error('템플릿 생성 실패:', error)
      message.error(error.response?.data?.detail || '생성에 실패했습니다.')
    }
  }

  const handleEditTemplate = async (values: any) => {
    if (!editingTemplate) return
    try {
      const templateData: ScoringTemplateUpdate = {
        ...values,
        default_mappings: scoringTemplateService.stringifyMappings(gradeMappings),
        keywords: scoringTemplateService.stringifyKeywords(keywords)
      }
      await scoringTemplateService.update(editingTemplate.template_id, templateData)
      message.success('평가 템플릿이 수정되었습니다.')
      setIsTemplateEditModalOpen(false)
      setEditingTemplate(null)
      templateEditForm.resetFields()
      setGradeMappings([])
      setKeywords([])
      loadTemplates()
    } catch (error: any) {
      console.error('템플릿 수정 실패:', error)
      message.error(error.response?.data?.detail || '수정에 실패했습니다.')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await scoringTemplateService.delete(templateId)
      message.success('평가 템플릿이 비활성화되었습니다.')
      loadTemplates()
    } catch (error: any) {
      console.error('템플릿 삭제 실패:', error)
      message.error(error.response?.data?.detail || '삭제에 실패했습니다.')
    }
  }

  const openTemplateEditModal = (template: ScoringTemplate) => {
    setEditingTemplate(template)
    setGradeMappings(scoringTemplateService.parseMappings(template.default_mappings))
    setKeywords(scoringTemplateService.parseKeywords(template.keywords))
    templateEditForm.setFieldsValue({
      template_name: template.template_name,
      description: template.description,
      grade_type: template.grade_type,
      matching_type: template.matching_type,
      value_source: template.value_source,
      source_field: template.source_field,
      aggregation_mode: template.aggregation_mode,
      fixed_grades: template.fixed_grades,
      allow_add_grades: template.allow_add_grades,
      proof_required: template.proof_required,
      verification_note: template.verification_note,
      is_required_default: template.is_required_default,
      allow_multiple: template.allow_multiple,
      auto_confirm_across_projects: template.auto_confirm_across_projects,
      is_active: template.is_active
    })
    setIsTemplateEditModalOpen(true)
  }

  const addGradeMapping = () => {
    setGradeMappings([...gradeMappings, { value: '', score: 0, label: '', fixed: false }])
  }

  const updateGradeMapping = (index: number, field: keyof GradeMapping, value: any) => {
    const updated = [...gradeMappings]
    updated[index] = { ...updated[index], [field]: value }
    setGradeMappings(updated)
  }

  const removeGradeMapping = (index: number) => {
    setGradeMappings(gradeMappings.filter((_, i) => i !== index))
  }

  const addKeyword = (keyword: string) => {
    if (keyword && !keywords.includes(keyword)) {
      setKeywords([...keywords, keyword])
    }
  }

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword))
  }

  // 템플릿 선택 시 미리보기 정보
  const getTemplatePreview = (templateId: string | undefined) => {
    if (!templateId) return null
    return templates.find(t => t.template_id === templateId)
  }

  // 입력 템플릿 CRUD
  const handleCreateInputTemplate = async (values: any) => {
    try {
      const templateData: InputTemplateCreate = {
        ...values,
        fields_schema: inputTemplateService.stringifyFieldsSchema(fieldsSchema),
        keywords: inputTemplateService.stringifyKeywords(inputKeywords)
      }
      await inputTemplateService.create(templateData)
      message.success('입력 템플릿이 생성되었습니다.')
      setIsInputTemplateCreateModalOpen(false)
      inputTemplateCreateForm.resetFields()
      setFieldsSchema([])
      setInputKeywords([])
      loadInputTemplates()
    } catch (error: any) {
      console.error('입력 템플릿 생성 실패:', error)
      message.error(error.response?.data?.detail || '생성에 실패했습니다.')
    }
  }

  const handleEditInputTemplate = async (values: any) => {
    if (!editingInputTemplate) return
    try {
      const templateData: InputTemplateUpdate = {
        ...values,
        fields_schema: inputTemplateService.stringifyFieldsSchema(fieldsSchema),
        keywords: inputTemplateService.stringifyKeywords(inputKeywords)
      }
      await inputTemplateService.update(editingInputTemplate.template_id, templateData)
      message.success('입력 템플릿이 수정되었습니다.')
      setIsInputTemplateEditModalOpen(false)
      setEditingInputTemplate(null)
      inputTemplateEditForm.resetFields()
      setFieldsSchema([])
      setInputKeywords([])
      loadInputTemplates()
    } catch (error: any) {
      console.error('입력 템플릿 수정 실패:', error)
      message.error(error.response?.data?.detail || '수정에 실패했습니다.')
    }
  }

  const handleDeleteInputTemplate = async (templateId: string) => {
    try {
      await inputTemplateService.delete(templateId)
      message.success('입력 템플릿이 비활성화되었습니다.')
      loadInputTemplates()
    } catch (error: any) {
      console.error('입력 템플릿 삭제 실패:', error)
      message.error(error.response?.data?.detail || '삭제에 실패했습니다.')
    }
  }

  const openInputTemplateEditModal = (template: InputTemplate) => {
    setEditingInputTemplate(template)
    setFieldsSchema(inputTemplateService.parseFieldsSchema(template.fields_schema))
    setInputKeywords(inputTemplateService.parseKeywords(template.keywords))
    inputTemplateEditForm.setFieldsValue({
      template_name: template.template_name,
      description: template.description,
      layout_type: template.layout_type,
      is_repeatable: template.is_repeatable,
      max_entries: template.max_entries,
      allow_file_upload: template.allow_file_upload,
      file_required: template.file_required,
      allowed_file_types: template.allowed_file_types,
      help_text: template.help_text,
      placeholder: template.placeholder,
      is_active: template.is_active
    })
    setIsInputTemplateEditModalOpen(true)
  }

  const addFieldSchema = () => {
    setFieldsSchema([...fieldsSchema, { name: '', type: 'text', label: '', required: false }])
  }

  const updateFieldSchema = (index: number, field: keyof FieldSchema, value: any) => {
    const updated = [...fieldsSchema]
    updated[index] = { ...updated[index], [field]: value }
    setFieldsSchema(updated)
  }

  const removeFieldSchema = (index: number) => {
    setFieldsSchema(fieldsSchema.filter((_, i) => i !== index))
  }

  const addInputKeyword = (keyword: string) => {
    if (keyword && !inputKeywords.includes(keyword)) {
      setInputKeywords([...inputKeywords, keyword])
    }
  }

  const removeInputKeyword = (keyword: string) => {
    setInputKeywords(inputKeywords.filter(k => k !== keyword))
  }

  const filteredItems = categoryFilter
    ? items.filter(item => item.category === categoryFilter)
    : items

  // 템플릿 테이블 컬럼
  const templateColumns = [
    {
      title: '템플릿 ID',
      dataIndex: 'template_id',
      key: 'template_id',
      width: '12%'
    },
    {
      title: '템플릿명',
      dataIndex: 'template_name',
      key: 'template_name',
      width: '15%'
    },
    {
      title: '등급유형',
      dataIndex: 'grade_type',
      key: 'grade_type',
      width: '10%',
      render: (v: string) => {
        const opt = GRADE_TYPE_OPTIONS.find(o => o.value === v)
        return <Tag>{opt?.label || v}</Tag>
      }
    },
    {
      title: '매칭방식',
      dataIndex: 'matching_type',
      key: 'matching_type',
      width: '10%',
      render: (v: string) => {
        const opt = MATCHING_TYPE_OPTIONS.find(o => o.value === v)
        return <Tag color="blue">{opt?.label || v}</Tag>
      }
    },
    {
      title: '등급 수',
      key: 'mappings_count',
      width: '8%',
      render: (_: any, record: ScoringTemplate) => {
        const mappings = scoringTemplateService.parseMappings(record.default_mappings)
        return mappings.length
      }
    },
    {
      title: '증빙',
      dataIndex: 'proof_required',
      key: 'proof_required',
      width: '8%',
      render: (v: string) => {
        const colors: Record<string, string> = {
          'NOT_REQUIRED': 'default',
          'OPTIONAL': 'blue',
          'REQUIRED': 'red'
        }
        const labels: Record<string, string> = {
          'NOT_REQUIRED': '불필요',
          'OPTIONAL': '선택',
          'REQUIRED': '필수'
        }
        return <Tag color={colors[v]}>{labels[v] || v}</Tag>
      }
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '8%',
      render: (active: boolean) => (
        active ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>
      )
    },
    {
      title: '작업',
      key: 'actions',
      width: '15%',
      render: (_: any, record: ScoringTemplate) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openTemplateEditModal(record)}
          >
            수정
          </Button>
          {record.is_active && (
            <Popconfirm
              title="이 템플릿을 비활성화하시겠습니까?"
              onConfirm={() => handleDeleteTemplate(record.template_id)}
              okText="예"
              cancelText="아니오"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                삭제
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  // 템플릿 상세 확장 행
  const templateExpandedRowRender = (record: ScoringTemplate) => {
    const mappings = scoringTemplateService.parseMappings(record.default_mappings)
    const kwds = scoringTemplateService.parseKeywords(record.keywords)

    return (
      <div className="p-4 bg-gray-50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Text strong>등급별 점수 매핑:</Text>
            <div className="mt-2">
              {mappings.length > 0 ? (
                <Table
                  size="small"
                  pagination={false}
                  dataSource={mappings.map((m, i) => ({ ...m, key: i }))}
                  columns={[
                    { title: '값', dataIndex: 'value', key: 'value' },
                    { title: '점수', dataIndex: 'score', key: 'score' },
                    { title: '레이블', dataIndex: 'label', key: 'label', render: (v: string) => v || '-' },
                    { title: '고정', dataIndex: 'fixed', key: 'fixed', render: (v: boolean) => v ? '예' : '아니오' }
                  ]}
                />
              ) : (
                <Text type="secondary">등급 매핑 없음</Text>
              )}
            </div>
          </div>
          <div>
            <Text strong>설정 정보:</Text>
            <Descriptions size="small" column={1} className="mt-2">
              <Descriptions.Item label="값 소스">
                {VALUE_SOURCE_OPTIONS.find(o => o.value === record.value_source)?.label || record.value_source}
              </Descriptions.Item>
              {record.source_field && (
                <Descriptions.Item label="소스 필드">{record.source_field}</Descriptions.Item>
              )}
              <Descriptions.Item label="집계방식">
                {AGGREGATION_MODE_OPTIONS.find(o => o.value === record.aggregation_mode)?.label || record.aggregation_mode}
              </Descriptions.Item>
              <Descriptions.Item label="등급 고정">{record.fixed_grades ? '예' : '아니오'}</Descriptions.Item>
              <Descriptions.Item label="등급 추가 허용">{record.allow_add_grades ? '예' : '아니오'}</Descriptions.Item>
              <Descriptions.Item label="자동컨펌(프로젝트간)">{record.auto_confirm_across_projects ? '예' : '아니오'}</Descriptions.Item>
            </Descriptions>
            {record.verification_note && (
              <Alert message={record.verification_note} type="info" className="mt-2" />
            )}
            {kwds.length > 0 && (
              <div className="mt-2">
                <Text strong>키워드: </Text>
                {kwds.map(k => <Tag key={k}>{k}</Tag>)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 입력 템플릿 테이블 컬럼
  const inputTemplateColumns = [
    {
      title: '템플릿 ID',
      dataIndex: 'template_id',
      key: 'template_id',
      width: '12%'
    },
    {
      title: '템플릿명',
      dataIndex: 'template_name',
      key: 'template_name',
      width: '15%'
    },
    {
      title: '레이아웃',
      dataIndex: 'layout_type',
      key: 'layout_type',
      width: '10%',
      render: (v: string) => inputTemplateService.getLayoutTypeLabel(v)
    },
    {
      title: '다중입력',
      dataIndex: 'is_repeatable',
      key: 'is_repeatable',
      width: '8%',
      render: (v: boolean, record: InputTemplate) => (
        v ? <Tag color="blue">Yes ({record.max_entries || '무제한'})</Tag> : <Tag>No</Tag>
      )
    },
    {
      title: '파일첨부',
      dataIndex: 'allow_file_upload',
      key: 'allow_file_upload',
      width: '8%',
      render: (v: boolean, record: InputTemplate) => {
        if (!v) return <Tag>불가</Tag>
        return record.file_required
          ? <Tag color="red">필수</Tag>
          : <Tag color="blue">허용</Tag>
      }
    },
    {
      title: '필드 수',
      key: 'fields_count',
      width: '8%',
      render: (_: any, record: InputTemplate) => {
        const fields = inputTemplateService.parseFieldsSchema(record.fields_schema)
        return fields.length
      }
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '8%',
      render: (active: boolean) => (
        active ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>
      )
    },
    {
      title: '작업',
      key: 'actions',
      width: '15%',
      render: (_: any, record: InputTemplate) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openInputTemplateEditModal(record)}
          >
            수정
          </Button>
          {record.is_active && (
            <Popconfirm
              title="이 템플릿을 비활성화하시겠습니까?"
              onConfirm={() => handleDeleteInputTemplate(record.template_id)}
              okText="예"
              cancelText="아니오"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                삭제
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  // 입력 템플릿 상세 확장 행
  const inputTemplateExpandedRowRender = (record: InputTemplate) => {
    const fields = inputTemplateService.parseFieldsSchema(record.fields_schema)
    const kwds = inputTemplateService.parseKeywords(record.keywords)

    return (
      <div className="p-4 bg-gray-50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Text strong>필드 스키마:</Text>
            <div className="mt-2">
              {fields.length > 0 ? (
                <Table
                  size="small"
                  pagination={false}
                  dataSource={fields.map((f, i) => ({ ...f, key: i }))}
                  columns={[
                    { title: '필드명', dataIndex: 'name', key: 'name' },
                    { title: '타입', dataIndex: 'type', key: 'type', render: (v: string) => inputTemplateService.getFieldTypeLabel(v) },
                    { title: '레이블', dataIndex: 'label', key: 'label' },
                    { title: '필수', dataIndex: 'required', key: 'required', render: (v: boolean) => v ? <Tag color="red">필수</Tag> : <Tag>선택</Tag> }
                  ]}
                />
              ) : (
                <Text type="secondary">필드 스키마 없음</Text>
              )}
            </div>
          </div>
          <div>
            <Text strong>설정 정보:</Text>
            <Descriptions size="small" column={1} className="mt-2">
              <Descriptions.Item label="설명">{record.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="도움말">{record.help_text || '-'}</Descriptions.Item>
              <Descriptions.Item label="플레이스홀더">{record.placeholder || '-'}</Descriptions.Item>
            </Descriptions>
            {kwds.length > 0 && (
              <div className="mt-2">
                <Text strong>키워드: </Text>
                {kwds.map(k => <Tag key={k}>{k}</Tag>)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const columns = [
    {
      title: '항목코드',
      dataIndex: 'item_code',
      key: 'item_code',
      width: '15%',
    },
    {
      title: '항목명',
      dataIndex: 'item_name',
      key: 'item_name',
      width: '20%',
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      width: '10%',
      render: (category: string) => getCategoryTag(category),
    },
    {
      title: '입력 템플릿',
      dataIndex: 'template',
      key: 'template',
      width: '8%',
      render: (template: string) => template || '-',
    },
    {
      title: '평가 템플릿',
      dataIndex: 'scoring_template_id',
      key: 'scoring_template_id',
      width: '10%',
      render: (templateId: string) => {
        if (!templateId) return <Text type="secondary">-</Text>
        const template = templates.find(t => t.template_id === templateId)
        return template ? (
          <Tag color="orange">{template.template_name}</Tag>
        ) : (
          <Text type="secondary">{templateId}</Text>
        )
      },
    },
    {
      title: '다중입력',
      dataIndex: 'is_repeatable',
      key: 'is_repeatable',
      width: '6%',
      render: (repeatable: boolean, record: CompetencyItem) => (
        repeatable ? <Tag color="blue">Yes ({record.max_entries || '무제한'})</Tag> : <Tag>No</Tag>
      ),
    },
    {
      title: '필드 수',
      key: 'fields_count',
      width: '8%',
      render: (_: any, record: CompetencyItem) => record.fields?.length || 0,
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '8%',
      render: (active: boolean) => (
        active ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: '21%',
      render: (_: any, record: CompetencyItem) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            수정
          </Button>
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => openFieldModal(record)}
          >
            필드
          </Button>
          {record.is_active && (
            <Popconfirm
              title="이 항목을 비활성화하시겠습니까?"
              onConfirm={() => handleDelete(record.item_id)}
              okText="예"
              cancelText="아니오"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                삭제
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const expandedRowRender = (record: CompetencyItem) => {
    if (!record.fields || record.fields.length === 0) {
      return <Text type="secondary">등록된 필드가 없습니다.</Text>
    }

    const fieldColumns = [
      { title: '필드명', dataIndex: 'field_name', key: 'field_name' },
      { title: '레이블', dataIndex: 'field_label', key: 'field_label' },
      { title: '타입', dataIndex: 'field_type', key: 'field_type' },
      { title: '필수', dataIndex: 'is_required', key: 'is_required', render: (v: boolean) => v ? '예' : '아니오' },
      { title: '순서', dataIndex: 'display_order', key: 'display_order' },
      {
        title: '작업',
        key: 'actions',
        render: (_: any, field: CompetencyItemField) => (
          <Popconfirm
            title="이 필드를 삭제하시겠습니까?"
            onConfirm={() => handleDeleteField(record.item_id, field.field_id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger size="small">삭제</Button>
          </Popconfirm>
        ),
      },
    ]

    return (
      <Table
        columns={fieldColumns}
        dataSource={record.fields}
        rowKey="field_id"
        pagination={false}
        size="small"
      />
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/dashboard')}
        >
          대시보드로 돌아가기
        </Button>
        <Title level={3} style={{ margin: 0 }}>시스템관리 &gt; 역량항목 설정</Title>
        <div style={{ width: 200 }} />
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* 역량항목 관리 탭 */}
          <Tabs.TabPane tab="역량항목 관리" key="items">
            <div className="flex justify-between items-center mb-4">
              <Space>
                <Popconfirm
                  title="⚠️ 역량항목 전체 삭제"
                  description="모든 역량항목, 필드, 코치역량 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다!"
                  onConfirm={handleClear}
                  okText="전체 삭제"
                  cancelText="취소"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={clearLoading}
                  >
                    전체 삭제
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="역량항목 초기화"
                  description="기본 역량항목(자격증, 학력, 코칭연수, 코칭경력)을 생성합니다. 이미 존재하는 항목은 스킵됩니다."
                  onConfirm={handleSeed}
                  okText="초기화"
                  cancelText="취소"
                >
                  <Button
                    icon={<SyncOutlined />}
                    loading={seedLoading}
                  >
                    역량항목 초기화
                  </Button>
                </Popconfirm>
              </Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                새 역량항목 추가
              </Button>
            </div>
            <div className="mb-4 flex justify-between">
              <Space>
                <Text>카테고리 필터:</Text>
                <Select
                  style={{ width: 150 }}
                  placeholder="전체"
                  allowClear
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={CATEGORY_OPTIONS}
                />
              </Space>
              <Space>
                <Text>비활성 항목 포함:</Text>
                <Switch checked={showInactive} onChange={setShowInactive} />
              </Space>
            </div>

            <Table
              columns={columns}
              dataSource={filteredItems}
              rowKey="item_id"
              loading={loading}
              expandable={{
                expandedRowRender,
                rowExpandable: (record) => (record.fields?.length || 0) > 0,
              }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `총 ${total}개`
              }}
              locale={{
                emptyText: '등록된 역량항목이 없습니다.'
              }}
            />
          </Tabs.TabPane>

          {/* 평가 템플릿 관리 탭 */}
          <Tabs.TabPane tab="평가 템플릿 관리" key="templates">
            <div className="flex justify-between items-center mb-4">
              <Text className="text-gray-600">
                역량항목 평가에 사용되는 등급/점수 템플릿을 관리합니다.
              </Text>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setGradeMappings([])
                  setKeywords([])
                  templateCreateForm.resetFields()
                  setIsTemplateCreateModalOpen(true)
                }}
              >
                새 평가 템플릿 추가
              </Button>
            </div>

            <div className="mb-4">
              <Space>
                <Text>비활성 템플릿 포함:</Text>
                <Switch checked={showInactiveTemplates} onChange={setShowInactiveTemplates} />
              </Space>
            </div>

            <Table
              columns={templateColumns}
              dataSource={templates}
              rowKey="template_id"
              loading={templatesLoading}
              expandable={{
                expandedRowRender: templateExpandedRowRender
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `총 ${total}개`
              }}
              locale={{
                emptyText: '등록된 평가 템플릿이 없습니다.'
              }}
            />
          </Tabs.TabPane>

          {/* 입력 템플릿 관리 탭 */}
          <Tabs.TabPane tab="입력 템플릿 관리" key="inputTemplates">
            <div className="flex justify-between items-center mb-4">
              <Text className="text-gray-600">
                역량항목 입력에 사용되는 폼 구조 템플릿을 관리합니다.
              </Text>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setFieldsSchema([])
                  setInputKeywords([])
                  inputTemplateCreateForm.resetFields()
                  setIsInputTemplateCreateModalOpen(true)
                }}
              >
                새 입력 템플릿 추가
              </Button>
            </div>

            <div className="mb-4">
              <Space>
                <Text>비활성 템플릿 포함:</Text>
                <Switch checked={showInactiveInputTemplates} onChange={setShowInactiveInputTemplates} />
              </Space>
            </div>

            <Table
              columns={inputTemplateColumns}
              dataSource={inputTemplates}
              rowKey="template_id"
              loading={inputTemplatesLoading}
              expandable={{
                expandedRowRender: inputTemplateExpandedRowRender
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `총 ${total}개`
              }}
              locale={{
                emptyText: '등록된 입력 템플릿이 없습니다.'
              }}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>

        {/* Create Modal */}
        <Modal
          title="새 역량항목 추가"
          open={isCreateModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsCreateModalOpen(false)
            createForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={handleCreate}
          >
            <Form.Item
              name="item_code"
              label="항목 코드"
              rules={[{ required: true, message: '항목 코드를 입력해주세요' }]}
            >
              <Input placeholder="예: ADDON_NEW_ITEM" />
            </Form.Item>

            <Form.Item
              name="item_name"
              label="항목명"
              rules={[{ required: true, message: '항목명을 입력해주세요' }]}
            >
              <Input placeholder="예: 새로운 역량항목" />
            </Form.Item>

            <Form.Item
              name="category"
              label="카테고리"
              rules={[{ required: true, message: '카테고리를 선택해주세요' }]}
            >
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="template"
              label="템플릿 유형"
            >
              <Select options={TEMPLATE_OPTIONS} allowClear />
            </Form.Item>

            <Form.Item
              name="template_config"
              label="템플릿 설정 (JSON)"
              tooltip={'예: {"options": ["옵션1", "옵션2"]}'}
            >
              <Input.TextArea rows={3} placeholder='{"options": ["옵션1", "옵션2"]}' />
            </Form.Item>

            <Form.Item
              name="is_repeatable"
              label="다중 입력 허용"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="max_entries"
              label="최대 입력 수"
              tooltip="다중 입력 허용 시 최대 개수"
            >
              <InputNumber min={1} max={100} />
            </Form.Item>

            {/* 평가방법 설정 섹션 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>평가방법 설정</Title>
              <Form.Item
                name="scoring_template_id"
                label="평가 템플릿"
                tooltip="이 항목의 점수 계산에 사용할 템플릿을 선택합니다"
              >
                <Select
                  placeholder="평가 템플릿 선택 (선택사항)"
                  allowClear
                  options={templates.map(t => ({
                    label: t.template_name,
                    value: t.template_id
                  }))}
                />
              </Form.Item>

              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.scoring_template_id !== curr.scoring_template_id}>
                {({ getFieldValue }) => {
                  const selectedTemplateId = getFieldValue('scoring_template_id')
                  const template = getTemplatePreview(selectedTemplateId)
                  if (!template) return null

                  const mappings = scoringTemplateService.parseMappings(template.default_mappings)

                  return (
                    <div className="bg-gray-50 p-4 rounded mb-4">
                      <Text strong>선택된 템플릿 미리보기:</Text>
                      <Descriptions size="small" column={2} className="mt-2">
                        <Descriptions.Item label="등급유형">
                          {GRADE_TYPE_OPTIONS.find(o => o.value === template.grade_type)?.label}
                        </Descriptions.Item>
                        <Descriptions.Item label="매칭방식">
                          {MATCHING_TYPE_OPTIONS.find(o => o.value === template.matching_type)?.label}
                        </Descriptions.Item>
                        <Descriptions.Item label="집계방식">
                          {AGGREGATION_MODE_OPTIONS.find(o => o.value === template.aggregation_mode)?.label}
                        </Descriptions.Item>
                        <Descriptions.Item label="증빙필수">
                          {PROOF_REQUIRED_OPTIONS.find(o => o.value === template.proof_required)?.label}
                        </Descriptions.Item>
                      </Descriptions>
                      <div className="mt-2">
                        <Text type="secondary">등급 매핑 ({mappings.length}개):</Text>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {mappings.slice(0, 5).map((m, i) => (
                            <Tag key={i}>{String(m.value)} → {m.score}점</Tag>
                          ))}
                          {mappings.length > 5 && <Tag>+{mappings.length - 5}개</Tag>}
                        </div>
                      </div>
                    </div>
                  )
                }}
              </Form.Item>
            </div>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">생성</Button>
                <Button onClick={() => {
                  setIsCreateModalOpen(false)
                  createForm.resetFields()
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          title="역량항목 수정"
          open={isEditModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsEditModalOpen(false)
            setEditingItem(null)
            editForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEdit}
          >
            <Form.Item
              name="item_name"
              label="항목명"
              rules={[{ required: true, message: '항목명을 입력해주세요' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="category"
              label="카테고리"
            >
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="template"
              label="템플릿 유형"
            >
              <Select options={TEMPLATE_OPTIONS} allowClear />
            </Form.Item>

            <Form.Item
              name="template_config"
              label="템플릿 설정 (JSON)"
            >
              <Input.TextArea rows={3} />
            </Form.Item>

            <Form.Item
              name="is_repeatable"
              label="다중 입력 허용"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="max_entries"
              label="최대 입력 수"
            >
              <InputNumber min={1} max={100} />
            </Form.Item>

            {/* 평가방법 설정 섹션 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>평가방법 설정</Title>
              <Form.Item
                name="scoring_template_id"
                label="평가 템플릿"
                tooltip="이 항목의 점수 계산에 사용할 템플릿을 선택합니다"
              >
                <Select
                  placeholder="평가 템플릿 선택 (선택사항)"
                  allowClear
                  options={templates.map(t => ({
                    label: t.template_name,
                    value: t.template_id
                  }))}
                />
              </Form.Item>

              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.scoring_template_id !== curr.scoring_template_id}>
                {({ getFieldValue }) => {
                  const selectedTemplateId = getFieldValue('scoring_template_id')
                  const template = getTemplatePreview(selectedTemplateId)
                  if (!template) return null

                  const mappings = scoringTemplateService.parseMappings(template.default_mappings)

                  return (
                    <div className="bg-gray-50 p-4 rounded mb-4">
                      <Text strong>선택된 템플릿 미리보기:</Text>
                      <Descriptions size="small" column={2} className="mt-2">
                        <Descriptions.Item label="등급유형">
                          {GRADE_TYPE_OPTIONS.find(o => o.value === template.grade_type)?.label}
                        </Descriptions.Item>
                        <Descriptions.Item label="매칭방식">
                          {MATCHING_TYPE_OPTIONS.find(o => o.value === template.matching_type)?.label}
                        </Descriptions.Item>
                        <Descriptions.Item label="집계방식">
                          {AGGREGATION_MODE_OPTIONS.find(o => o.value === template.aggregation_mode)?.label}
                        </Descriptions.Item>
                        <Descriptions.Item label="증빙필수">
                          {PROOF_REQUIRED_OPTIONS.find(o => o.value === template.proof_required)?.label}
                        </Descriptions.Item>
                      </Descriptions>
                      <div className="mt-2">
                        <Text type="secondary">등급 매핑 ({mappings.length}개):</Text>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {mappings.slice(0, 5).map((m, i) => (
                            <Tag key={i}>{String(m.value)} → {m.score}점</Tag>
                          ))}
                          {mappings.length > 5 && <Tag>+{mappings.length - 5}개</Tag>}
                        </div>
                      </div>
                    </div>
                  )
                }}
              </Form.Item>
            </div>

            <Form.Item
              name="is_active"
              label="활성 상태"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">저장</Button>
                <Button onClick={() => {
                  setIsEditModalOpen(false)
                  setEditingItem(null)
                  editForm.resetFields()
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Field Management Modal */}
        <Modal
          title={`필드 관리 - ${editingItem?.item_name}`}
          open={isFieldModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsFieldModalOpen(false)
            setEditingItem(null)
            setEditingField(null)
            fieldForm.resetFields()
          }}
          footer={null}
          width={800}
        >
          {/* Existing Fields List */}
          <div className="mb-6">
            <Title level={5}>등록된 필드 ({editingItem?.fields?.length || 0}개)</Title>
            {editingItem?.fields && editingItem.fields.length > 0 ? (
              <Table
                columns={[
                  { title: '순서', dataIndex: 'display_order', key: 'display_order', width: 60 },
                  { title: '필드명', dataIndex: 'field_name', key: 'field_name', width: 120 },
                  { title: '레이블', dataIndex: 'field_label', key: 'field_label' },
                  { title: '타입', dataIndex: 'field_type', key: 'field_type', width: 80 },
                  {
                    title: '필수',
                    dataIndex: 'is_required',
                    key: 'is_required',
                    width: 60,
                    render: (v: boolean) => v ? <Tag color="red">필수</Tag> : <Tag>선택</Tag>
                  },
                  {
                    title: '작업',
                    key: 'actions',
                    width: 120,
                    render: (_: any, field: CompetencyItemField) => (
                      <Space size="small">
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEditField(field)}
                        >
                          수정
                        </Button>
                        <Popconfirm
                          title="이 필드를 삭제하시겠습니까?"
                          onConfirm={() => {
                            handleDeleteField(editingItem!.item_id, field.field_id)
                          }}
                          okText="예"
                          cancelText="아니오"
                        >
                          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                            삭제
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
                dataSource={editingItem.fields.sort((a, b) => a.display_order - b.display_order)}
                rowKey="field_id"
                pagination={false}
                size="small"
              />
            ) : (
              <Text type="secondary">등록된 필드가 없습니다.</Text>
            )}
          </div>

          {/* Add/Edit Field Form */}
          <div className="border-t pt-4">
            <Title level={5}>
              {editingField ? `필드 수정: ${editingField.field_label}` : '새 필드 추가'}
            </Title>
            <Form
              form={fieldForm}
              layout="vertical"
              onFinish={handleFieldSubmit}
            >
              <div className="grid grid-cols-2 gap-4">
                <Form.Item
                  name="field_name"
                  label="필드명 (영문)"
                  rules={[{ required: true, message: '필드명을 입력해주세요' }]}
                >
                  <Input placeholder="예: cert_name" />
                </Form.Item>

                <Form.Item
                  name="field_label"
                  label="필드 레이블 (표시명)"
                  rules={[{ required: true, message: '레이블을 입력해주세요' }]}
                >
                  <Input placeholder="예: 자격증명" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Form.Item
                  name="field_type"
                  label="필드 타입"
                  rules={[{ required: true, message: '타입을 선택해주세요' }]}
                >
                  <Select options={FIELD_TYPE_OPTIONS} />
                </Form.Item>

                <Form.Item
                  name="is_required"
                  label="필수 여부"
                  valuePropName="checked"
                  initialValue={true}
                >
                  <Switch checkedChildren="필수" unCheckedChildren="선택" />
                </Form.Item>

                <Form.Item
                  name="display_order"
                  label="표시 순서"
                  initialValue={0}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </div>

              <Form.Item
                name="field_options"
                label="옵션 (JSON, select/multiselect용)"
              >
                <Input.TextArea rows={2} placeholder='["옵션1", "옵션2"]' />
              </Form.Item>

              <Form.Item
                name="placeholder"
                label="힌트 텍스트"
              >
                <Input placeholder="입력 힌트" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    {editingField ? '수정' : '추가'}
                  </Button>
                  {editingField && (
                    <Button onClick={cancelFieldEdit}>
                      수정 취소
                    </Button>
                  )}
                  <Button onClick={() => {
                    setIsFieldModalOpen(false)
                    setEditingItem(null)
                    setEditingField(null)
                    fieldForm.resetFields()
                  }}>닫기</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        </Modal>

        {/* Template Create Modal */}
        <Modal
          title="새 평가 템플릿 추가"
          open={isTemplateCreateModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsTemplateCreateModalOpen(false)
            templateCreateForm.resetFields()
            setGradeMappings([])
            setKeywords([])
          }}
          footer={null}
          width={800}
        >
          <Form
            form={templateCreateForm}
            layout="vertical"
            onFinish={handleCreateTemplate}
            initialValues={{
              grade_type: 'string',
              matching_type: 'grade',
              value_source: 'SUBMITTED',
              aggregation_mode: 'best_match',
              proof_required: 'OPTIONAL',
              fixed_grades: false,
              allow_add_grades: true,
              is_required_default: false,
              allow_multiple: false,
              auto_confirm_across_projects: false
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="template_id"
                label="템플릿 ID"
                rules={[{ required: true, message: '템플릿 ID를 입력해주세요' }]}
                tooltip="고유 식별자 (영문, 숫자, 언더스코어)"
              >
                <Input placeholder="예: kca_certification" />
              </Form.Item>

              <Form.Item
                name="template_name"
                label="템플릿명"
                rules={[{ required: true, message: '템플릿명을 입력해주세요' }]}
              >
                <Input placeholder="예: 코칭관련자격증 (KCA)" />
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label="설명"
            >
              <Input.TextArea rows={2} placeholder="템플릿에 대한 설명" />
            </Form.Item>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="grade_type"
                label="등급 유형"
                rules={[{ required: true }]}
              >
                <Select options={GRADE_TYPE_OPTIONS} />
              </Form.Item>

              <Form.Item
                name="matching_type"
                label="매칭 방식"
                rules={[{ required: true }]}
              >
                <Select options={MATCHING_TYPE_OPTIONS} />
              </Form.Item>

              <Form.Item
                name="aggregation_mode"
                label="집계 방식"
              >
                <Select options={AGGREGATION_MODE_OPTIONS} />
              </Form.Item>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="value_source"
                label="값 소스"
              >
                <Select options={VALUE_SOURCE_OPTIONS} />
              </Form.Item>

              <Form.Item
                name="source_field"
                label="소스 필드"
                tooltip="USER_FIELD 또는 JSON_FIELD 선택 시"
              >
                <Input placeholder="예: kca_certification_level" />
              </Form.Item>

              <Form.Item
                name="proof_required"
                label="증빙 필수"
              >
                <Select options={PROOF_REQUIRED_OPTIONS} />
              </Form.Item>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <Form.Item name="fixed_grades" label="등급 고정" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="allow_add_grades" label="등급 추가 허용" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="allow_multiple" label="복수입력" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="auto_confirm_across_projects" label="자동컨펌" valuePropName="checked" tooltip="프로젝트 간 자동 확인">
                <Switch />
              </Form.Item>
            </div>

            <Form.Item
              name="verification_note"
              label="검증 안내문"
            >
              <Input.TextArea rows={2} placeholder="검토자에게 표시될 안내 메시지" />
            </Form.Item>

            {/* 등급 매핑 */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <Title level={5}>등급별 점수 매핑 ({gradeMappings.length}개)</Title>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addGradeMapping}>
                  등급 추가
                </Button>
              </div>

              {gradeMappings.map((mapping, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <Input
                    placeholder="값"
                    value={String(mapping.value)}
                    onChange={e => updateGradeMapping(index, 'value', e.target.value)}
                    style={{ width: 120 }}
                  />
                  <span>→</span>
                  <InputNumber
                    placeholder="점수"
                    value={mapping.score}
                    onChange={v => updateGradeMapping(index, 'score', v || 0)}
                    style={{ width: 80 }}
                  />
                  <span>점</span>
                  <Input
                    placeholder="레이블 (선택)"
                    value={mapping.label}
                    onChange={e => updateGradeMapping(index, 'label', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Switch
                    checkedChildren="고정"
                    unCheckedChildren="가변"
                    checked={mapping.fixed}
                    onChange={v => updateGradeMapping(index, 'fixed', v)}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeGradeMapping(index)}
                  />
                </div>
              ))}
            </div>

            {/* 키워드 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>키워드 (자동 매칭용)</Title>
              <div className="mb-2">
                {keywords.map(kw => (
                  <Tag key={kw} closable onClose={() => removeKeyword(kw)}>
                    {kw}
                  </Tag>
                ))}
              </div>
              <Input
                placeholder="키워드 입력 후 Enter"
                onPressEnter={(e) => {
                  addKeyword(e.currentTarget.value)
                  e.currentTarget.value = ''
                }}
                style={{ width: 200 }}
              />
            </div>

            <Form.Item className="mt-6">
              <Space>
                <Button type="primary" htmlType="submit">생성</Button>
                <Button onClick={() => {
                  setIsTemplateCreateModalOpen(false)
                  templateCreateForm.resetFields()
                  setGradeMappings([])
                  setKeywords([])
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Template Edit Modal */}
        <Modal
          title={`평가 템플릿 수정 - ${editingTemplate?.template_name}`}
          open={isTemplateEditModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsTemplateEditModalOpen(false)
            setEditingTemplate(null)
            templateEditForm.resetFields()
            setGradeMappings([])
            setKeywords([])
          }}
          footer={null}
          width={800}
        >
          <Form
            form={templateEditForm}
            layout="vertical"
            onFinish={handleEditTemplate}
          >
            <Alert
              message={`템플릿 ID: ${editingTemplate?.template_id}`}
              type="info"
              className="mb-4"
            />

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="template_name"
                label="템플릿명"
                rules={[{ required: true, message: '템플릿명을 입력해주세요' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="proof_required"
                label="증빙 필수"
              >
                <Select options={PROOF_REQUIRED_OPTIONS} />
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label="설명"
            >
              <Input.TextArea rows={2} />
            </Form.Item>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="grade_type"
                label="등급 유형"
              >
                <Select options={GRADE_TYPE_OPTIONS} />
              </Form.Item>

              <Form.Item
                name="matching_type"
                label="매칭 방식"
              >
                <Select options={MATCHING_TYPE_OPTIONS} />
              </Form.Item>

              <Form.Item
                name="aggregation_mode"
                label="집계 방식"
              >
                <Select options={AGGREGATION_MODE_OPTIONS} />
              </Form.Item>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="value_source"
                label="값 소스"
              >
                <Select options={VALUE_SOURCE_OPTIONS} />
              </Form.Item>

              <Form.Item
                name="source_field"
                label="소스 필드"
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="is_active"
                label="활성 상태"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <Form.Item name="fixed_grades" label="등급 고정" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="allow_add_grades" label="등급 추가 허용" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="allow_multiple" label="복수입력" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="auto_confirm_across_projects" label="자동컨펌" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>

            <Form.Item
              name="verification_note"
              label="검증 안내문"
            >
              <Input.TextArea rows={2} />
            </Form.Item>

            {/* 등급 매핑 */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <Title level={5}>등급별 점수 매핑 ({gradeMappings.length}개)</Title>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addGradeMapping}>
                  등급 추가
                </Button>
              </div>

              {gradeMappings.map((mapping, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <Input
                    placeholder="값"
                    value={String(mapping.value)}
                    onChange={e => updateGradeMapping(index, 'value', e.target.value)}
                    style={{ width: 120 }}
                  />
                  <span>→</span>
                  <InputNumber
                    placeholder="점수"
                    value={mapping.score}
                    onChange={v => updateGradeMapping(index, 'score', v || 0)}
                    style={{ width: 80 }}
                  />
                  <span>점</span>
                  <Input
                    placeholder="레이블 (선택)"
                    value={mapping.label}
                    onChange={e => updateGradeMapping(index, 'label', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Switch
                    checkedChildren="고정"
                    unCheckedChildren="가변"
                    checked={mapping.fixed}
                    onChange={v => updateGradeMapping(index, 'fixed', v)}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeGradeMapping(index)}
                  />
                </div>
              ))}
            </div>

            {/* 키워드 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>키워드 (자동 매칭용)</Title>
              <div className="mb-2">
                {keywords.map(kw => (
                  <Tag key={kw} closable onClose={() => removeKeyword(kw)}>
                    {kw}
                  </Tag>
                ))}
              </div>
              <Input
                placeholder="키워드 입력 후 Enter"
                onPressEnter={(e) => {
                  addKeyword(e.currentTarget.value)
                  e.currentTarget.value = ''
                }}
                style={{ width: 200 }}
              />
            </div>

            <Form.Item className="mt-6">
              <Space>
                <Button type="primary" htmlType="submit">저장</Button>
                <Button onClick={() => {
                  setIsTemplateEditModalOpen(false)
                  setEditingTemplate(null)
                  templateEditForm.resetFields()
                  setGradeMappings([])
                  setKeywords([])
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Input Template Create Modal */}
        <Modal
          title="새 입력 템플릿 추가"
          open={isInputTemplateCreateModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsInputTemplateCreateModalOpen(false)
            inputTemplateCreateForm.resetFields()
            setFieldsSchema([])
            setInputKeywords([])
          }}
          footer={null}
          width={800}
        >
          <Form
            form={inputTemplateCreateForm}
            layout="vertical"
            onFinish={handleCreateInputTemplate}
            initialValues={{
              layout_type: 'vertical',
              is_repeatable: false,
              allow_file_upload: false,
              file_required: false
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="template_id"
                label="템플릿 ID"
                rules={[
                  { required: true, message: '템플릿 ID를 입력해주세요' },
                  { pattern: /^[a-z0-9_]+$/, message: '영문 소문자, 숫자, 언더스코어만 사용 가능합니다' }
                ]}
                tooltip="고유 식별자 (영문 소문자, 숫자, 언더스코어)"
              >
                <Input placeholder="예: coaching_experience" />
              </Form.Item>

              <Form.Item
                name="template_name"
                label="템플릿명"
                rules={[{ required: true, message: '템플릿명을 입력해주세요' }]}
              >
                <Input placeholder="예: 코칭경력" />
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label="설명"
            >
              <Input.TextArea rows={2} placeholder="템플릿에 대한 설명" />
            </Form.Item>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="layout_type"
                label="레이아웃"
              >
                <Select options={[
                  { label: '세로 배치', value: 'vertical' },
                  { label: '가로 배치', value: 'horizontal' },
                  { label: '그리드', value: 'grid' }
                ]} />
              </Form.Item>

              <Form.Item
                name="is_repeatable"
                label="다중입력"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="max_entries"
                label="최대 입력 수"
                tooltip="다중입력 허용 시 최대 개수"
              >
                <Input placeholder="예: 10" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="allow_file_upload"
                label="파일 첨부"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="file_required"
                label="파일 필수"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="allowed_file_types"
                label="허용 파일 형식"
                tooltip='예: ["pdf", "jpg", "png"]'
              >
                <Input placeholder='["pdf", "jpg", "png"]' />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="help_text"
                label="도움말"
              >
                <Input.TextArea rows={2} placeholder="사용자에게 표시될 도움말" />
              </Form.Item>

              <Form.Item
                name="placeholder"
                label="플레이스홀더"
              >
                <Input placeholder="입력 필드 기본 안내 문구" />
              </Form.Item>
            </div>

            {/* 필드 스키마 */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <Title level={5}>필드 스키마 ({fieldsSchema.length}개)</Title>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addFieldSchema}>
                  필드 추가
                </Button>
              </div>

              {fieldsSchema.map((field, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <Input
                    placeholder="필드명"
                    value={field.name}
                    onChange={e => updateFieldSchema(index, 'name', e.target.value)}
                    style={{ width: 120 }}
                  />
                  <Select
                    placeholder="타입"
                    value={field.type}
                    onChange={v => updateFieldSchema(index, 'type', v)}
                    style={{ width: 100 }}
                    options={[
                      { label: '텍스트', value: 'text' },
                      { label: '숫자', value: 'number' },
                      { label: '선택', value: 'select' },
                      { label: '다중선택', value: 'multiselect' },
                      { label: '파일', value: 'file' },
                      { label: '날짜', value: 'date' },
                      { label: '장문', value: 'textarea' }
                    ]}
                  />
                  <Input
                    placeholder="레이블"
                    value={field.label}
                    onChange={e => updateFieldSchema(index, 'label', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Switch
                    checkedChildren="필수"
                    unCheckedChildren="선택"
                    checked={field.required}
                    onChange={v => updateFieldSchema(index, 'required', v)}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeFieldSchema(index)}
                  />
                </div>
              ))}
            </div>

            {/* 키워드 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>키워드 (자동 매칭용)</Title>
              <div className="mb-2">
                {inputKeywords.map(kw => (
                  <Tag key={kw} closable onClose={() => removeInputKeyword(kw)}>
                    {kw}
                  </Tag>
                ))}
              </div>
              <Input
                placeholder="키워드 입력 후 Enter"
                onPressEnter={(e) => {
                  addInputKeyword(e.currentTarget.value)
                  e.currentTarget.value = ''
                }}
                style={{ width: 200 }}
              />
            </div>

            <Form.Item className="mt-6">
              <Space>
                <Button type="primary" htmlType="submit">생성</Button>
                <Button onClick={() => {
                  setIsInputTemplateCreateModalOpen(false)
                  inputTemplateCreateForm.resetFields()
                  setFieldsSchema([])
                  setInputKeywords([])
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Input Template Edit Modal */}
        <Modal
          title={`입력 템플릿 수정 - ${editingInputTemplate?.template_name}`}
          open={isInputTemplateEditModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsInputTemplateEditModalOpen(false)
            setEditingInputTemplate(null)
            inputTemplateEditForm.resetFields()
            setFieldsSchema([])
            setInputKeywords([])
          }}
          footer={null}
          width={800}
        >
          <Form
            form={inputTemplateEditForm}
            layout="vertical"
            onFinish={handleEditInputTemplate}
          >
            <Alert
              message={`템플릿 ID: ${editingInputTemplate?.template_id}`}
              type="info"
              className="mb-4"
            />

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="template_name"
                label="템플릿명"
                rules={[{ required: true, message: '템플릿명을 입력해주세요' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="is_active"
                label="활성 상태"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label="설명"
            >
              <Input.TextArea rows={2} />
            </Form.Item>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="layout_type"
                label="레이아웃"
              >
                <Select options={[
                  { label: '세로 배치', value: 'vertical' },
                  { label: '가로 배치', value: 'horizontal' },
                  { label: '그리드', value: 'grid' }
                ]} />
              </Form.Item>

              <Form.Item
                name="is_repeatable"
                label="다중입력"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="max_entries"
                label="최대 입력 수"
              >
                <Input />
              </Form.Item>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name="allow_file_upload"
                label="파일 첨부"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="file_required"
                label="파일 필수"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="allowed_file_types"
                label="허용 파일 형식"
              >
                <Input />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="help_text"
                label="도움말"
              >
                <Input.TextArea rows={2} />
              </Form.Item>

              <Form.Item
                name="placeholder"
                label="플레이스홀더"
              >
                <Input />
              </Form.Item>
            </div>

            {/* 필드 스키마 */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <Title level={5}>필드 스키마 ({fieldsSchema.length}개)</Title>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addFieldSchema}>
                  필드 추가
                </Button>
              </div>

              {fieldsSchema.map((field, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <Input
                    placeholder="필드명"
                    value={field.name}
                    onChange={e => updateFieldSchema(index, 'name', e.target.value)}
                    style={{ width: 120 }}
                  />
                  <Select
                    placeholder="타입"
                    value={field.type}
                    onChange={v => updateFieldSchema(index, 'type', v)}
                    style={{ width: 100 }}
                    options={[
                      { label: '텍스트', value: 'text' },
                      { label: '숫자', value: 'number' },
                      { label: '선택', value: 'select' },
                      { label: '다중선택', value: 'multiselect' },
                      { label: '파일', value: 'file' },
                      { label: '날짜', value: 'date' },
                      { label: '장문', value: 'textarea' }
                    ]}
                  />
                  <Input
                    placeholder="레이블"
                    value={field.label}
                    onChange={e => updateFieldSchema(index, 'label', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Switch
                    checkedChildren="필수"
                    unCheckedChildren="선택"
                    checked={field.required}
                    onChange={v => updateFieldSchema(index, 'required', v)}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeFieldSchema(index)}
                  />
                </div>
              ))}
            </div>

            {/* 키워드 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>키워드 (자동 매칭용)</Title>
              <div className="mb-2">
                {inputKeywords.map(kw => (
                  <Tag key={kw} closable onClose={() => removeInputKeyword(kw)}>
                    {kw}
                  </Tag>
                ))}
              </div>
              <Input
                placeholder="키워드 입력 후 Enter"
                onPressEnter={(e) => {
                  addInputKeyword(e.currentTarget.value)
                  e.currentTarget.value = ''
                }}
                style={{ width: 200 }}
              />
            </div>

            <Form.Item className="mt-6">
              <Space>
                <Button type="primary" htmlType="submit">저장</Button>
                <Button onClick={() => {
                  setIsInputTemplateEditModalOpen(false)
                  setEditingInputTemplate(null)
                  inputTemplateEditForm.resetFields()
                  setFieldsSchema([])
                  setInputKeywords([])
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
    </div>
  )
}
