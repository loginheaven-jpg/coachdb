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
  Alert,
  Divider,
  Tooltip
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  SyncOutlined,
  LinkOutlined,
  QuestionCircleOutlined
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
  FieldSchema,
  UserProfileFieldInfo,
  DataSourceType
} from '../services/inputTemplateService'
import unifiedTemplateService, {
  UnifiedTemplate,
  UnifiedTemplateCreate,
  UnifiedTemplateUpdate,
  GradeMapping as UnifiedGradeMapping,
  FieldSchema as UnifiedFieldSchema
} from '../services/unifiedTemplateService'

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

// 값 소스 옵션 (백엔드 Literal 타입에 맞춰 소문자 사용)
const VALUE_SOURCE_OPTIONS = [
  { label: '제출값', value: 'submitted' },
  { label: '사용자 필드', value: 'user_field' },
  { label: 'JSON 필드', value: 'json_field' }
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

// 증빙 필수 옵션 (백엔드 Literal 타입에 맞춰 소문자 사용)
const PROOF_REQUIRED_OPTIONS = [
  { label: '불필요', value: 'not_required' },
  { label: '선택', value: 'optional' },
  { label: '필수', value: 'required' }
]

// 등급 수정 모드 옵션
const GRADE_EDIT_MODE_OPTIONS = [
  { label: '수정불가', value: 'fixed' },
  { label: '점수만 수정', value: 'score_only' },
  { label: '자유수정', value: 'flexible' }
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
  const [userProfileFields, setUserProfileFields] = useState<UserProfileFieldInfo[]>([])
  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceType>('form_input')

  // 통합 템플릿 관련 상태
  const [unifiedTemplates, setUnifiedTemplates] = useState<UnifiedTemplate[]>([])
  const [unifiedTemplatesLoading, setUnifiedTemplatesLoading] = useState(false)
  const [isUnifiedTemplateEditModalOpen, setIsUnifiedTemplateEditModalOpen] = useState(false)
  const [isUnifiedTemplateCreateModalOpen, setIsUnifiedTemplateCreateModalOpen] = useState(false)
  const [isUnifiedTemplateSelectModalOpen, setIsUnifiedTemplateSelectModalOpen] = useState(false)
  const [cloneSourceTemplate, setCloneSourceTemplate] = useState<UnifiedTemplate | null>(null)
  const [editingUnifiedTemplate, setEditingUnifiedTemplate] = useState<UnifiedTemplate | null>(null)
  const [unifiedFieldsSchema, setUnifiedFieldsSchema] = useState<UnifiedFieldSchema[]>([])
  const [unifiedGradeMappings, setUnifiedGradeMappings] = useState<UnifiedGradeMapping[]>([])
  const [unifiedKeywords, setUnifiedKeywords] = useState<string[]>([])
  const [unifiedDataSource, setUnifiedDataSource] = useState<DataSourceType>('form_input')

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
  const [unifiedTemplateEditForm] = Form.useForm()
  const [unifiedTemplateCreateForm] = Form.useForm()

  useEffect(() => {
    loadItems()
    loadTemplates()
    loadInputTemplates()
    loadUnifiedTemplates()
    loadUserProfileFields()
  }, [showInactive, showInactiveTemplates, showInactiveInputTemplates])

  const loadUserProfileFields = async () => {
    try {
      const fields = await inputTemplateService.getUserProfileFields()
      setUserProfileFields(fields)
    } catch (error) {
      console.error('User 프로필 필드 로드 실패:', error)
    }
  }

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

  const loadUnifiedTemplates = async () => {
    setUnifiedTemplatesLoading(true)
    try {
      const data = await unifiedTemplateService.getAll(!showInactiveInputTemplates)
      // 정렬: 1) 평가 설정이 있는 것(has_scoring) 먼저, 2) 템플릿명 순
      const sorted = [...data].sort((a, b) => {
        // has_scoring이 true인 것 먼저
        if (a.has_scoring !== b.has_scoring) {
          return a.has_scoring ? -1 : 1
        }
        // 그 다음 템플릿명 순 (한글 정렬)
        return a.template_name.localeCompare(b.template_name, 'ko')
      })
      setUnifiedTemplates(sorted)
    } catch (error: any) {
      console.error('통합 템플릿 로드 실패:', error)
      // 통합 템플릿 로드 실패는 조용히 무시 (아직 마이그레이션 중일 수 있음)
    } finally {
      setUnifiedTemplatesLoading(false)
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
      description: item.description,
      // Legacy fields (deprecated)
      scoring_template_id: item.scoring_template_id,
      input_template_id: item.input_template_id,
      // 2-tier unified template
      unified_template_id: item.unified_template_id,
      evaluation_method_override: item.evaluation_method_override,
      // 역량항목 전용 설정
      proof_required: item.proof_required || 'optional',
      verification_note: item.verification_note,
      help_text: item.help_text,
      auto_confirm_across_projects: item.auto_confirm_across_projects || false
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
    setSelectedDataSource(template.data_source || 'form_input')
    inputTemplateEditForm.setFieldsValue({
      template_name: template.template_name,
      description: template.description,
      data_source: template.data_source || 'form_input',
      source_field: template.source_field,
      display_only: template.display_only || false,
      layout_type: template.layout_type,
      is_repeatable: template.is_repeatable,
      max_entries: template.max_entries,
      help_text: template.help_text,
      placeholder: template.placeholder,
      is_active: template.is_active
    })
    setIsInputTemplateEditModalOpen(true)
  }

  // 특정 입력 템플릿을 사용하는 역량항목 찾기
  const getItemsUsingTemplate = (templateId: string): CompetencyItem[] => {
    return items.filter(item => item.template === templateId)
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
          'not_required': 'default',
          'optional': 'blue',
          'required': 'red'
        }
        const labels: Record<string, string> = {
          'not_required': '불필요',
          'optional': '선택',
          'required': '필수'
        }
        const normalizedV = v?.toLowerCase() || v
        return <Tag color={colors[normalizedV]}>{labels[normalizedV] || v}</Tag>
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

  // 입력 템플릿에 대응하는 통합 템플릿 찾기
  const getUnifiedTemplateForInput = (templateId: string): UnifiedTemplate | undefined => {
    return unifiedTemplates.find(ut => ut.template_id === templateId)
  }

  // 입력 템플릿 확장 렌더 (통합 템플릿의 평가 설정 표시)
  const inputTemplateExpandedRowRender = (record: InputTemplate) => {
    const unified = getUnifiedTemplateForInput(record.template_id)

    if (!unified) {
      return (
        <div className="p-4 bg-gray-50 rounded">
          <Text type="secondary">통합 템플릿이 연결되지 않았습니다. (기존 입력 템플릿만 사용)</Text>
        </div>
      )
    }

    // 평가 설정이 없는 경우
    if (!unified.has_scoring) {
      return (
        <div className="p-4 bg-gray-50 rounded">
          <Text type="secondary">평가 설정 없음 (입력만 수집)</Text>
        </div>
      )
    }

    // 등급 매핑 파싱
    const mappings = unifiedTemplateService.parseMappings(unified.default_mappings)

    return (
      <div className="p-4 bg-blue-50 rounded">
        <div className="grid grid-cols-2 gap-4">
          {/* 평가 설정 요약 */}
          <div>
            <Text strong className="text-blue-800">📊 평가 설정</Text>
            <Descriptions size="small" column={1} className="mt-2">
              <Descriptions.Item label="평가 방법">
                <Tag color="blue">{unifiedTemplateService.getEvaluationMethodLabel(unified.evaluation_method)}</Tag>
              </Descriptions.Item>
              {unified.grade_type && (
                <Descriptions.Item label="등급 유형">
                  {unifiedTemplateService.getGradeTypeLabel(unified.grade_type)}
                </Descriptions.Item>
              )}
              {unified.matching_type && (
                <Descriptions.Item label="매칭 방식">
                  {unifiedTemplateService.getMatchingTypeLabel(unified.matching_type)}
                </Descriptions.Item>
              )}
              {unified.aggregation_mode && (
                <Descriptions.Item label="집계 방식">
                  {unifiedTemplateService.getAggregationModeLabel(unified.aggregation_mode)}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>

          {/* 등급 매핑 */}
          {mappings.length > 0 && (
            <div>
              <Text strong className="text-blue-800">🎯 등급 매핑</Text>
              <div className="mt-2 space-y-1">
                {mappings.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Tag color="orange">{m.score}점</Tag>
                    <span className="text-gray-600">
                      {m.label || (typeof m.value === 'number' ? `${m.value} 이상` : m.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
      width: '10%'
    },
    {
      title: '템플릿명',
      dataIndex: 'template_name',
      key: 'template_name',
      width: '12%'
    },
    {
      title: '레이아웃',
      dataIndex: 'layout_type',
      key: 'layout_type',
      width: '7%',
      render: (v: string) => inputTemplateService.getLayoutTypeLabel(v)
    },
    {
      title: '다중입력',
      dataIndex: 'is_repeatable',
      key: 'is_repeatable',
      width: '7%',
      render: (v: boolean, record: InputTemplate) => (
        v ? <Tag color="blue">Yes ({record.max_entries || '∞'})</Tag> : <Tag>No</Tag>
      )
    },
    {
      title: '필드',
      key: 'fields_count',
      width: '5%',
      render: (_: any, record: InputTemplate) => {
        const fields = inputTemplateService.parseFieldsSchema(record.fields_schema)
        return fields.length
      }
    },
    {
      title: '평가 설정',
      key: 'scoring_info',
      width: '20%',
      render: (_: any, record: InputTemplate) => {
        const unified = getUnifiedTemplateForInput(record.template_id)
        if (!unified || !unified.has_scoring) {
          return <Text type="secondary">-</Text>
        }
        return (
          <Space wrap size={[4, 4]}>
            {unified.grade_type && (
              <Tooltip title="등급 유형">
                <Tag color="purple">{unifiedTemplateService.getGradeTypeLabel(unified.grade_type)}</Tag>
              </Tooltip>
            )}
            {unified.matching_type && (
              <Tooltip title="매칭 방식">
                <Tag color="cyan">{unifiedTemplateService.getMatchingTypeLabel(unified.matching_type)}</Tag>
              </Tooltip>
            )}
            {unified.aggregation_mode && unified.aggregation_mode !== 'first' && (
              <Tooltip title="집계 방식">
                <Tag color="geekblue">{unifiedTemplateService.getAggregationModeLabel(unified.aggregation_mode)}</Tag>
              </Tooltip>
            )}
          </Space>
        )
      }
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '6%',
      render: (active: boolean) => (
        active ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>
      )
    },
    {
      title: '작업',
      key: 'actions',
      width: '12%',
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

  // 통합 템플릿 테이블 컬럼
  const unifiedTemplateColumns = [
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
      width: '7%',
      render: (v: string) => unifiedTemplateService.getLayoutTypeLabel(v as any)
    },
    {
      title: '다중입력',
      dataIndex: 'is_repeatable',
      key: 'is_repeatable',
      width: '7%',
      render: (v: boolean, record: UnifiedTemplate) => (
        v ? <Tag color="blue">Yes ({record.max_entries || '∞'})</Tag> : <Tag>No</Tag>
      )
    },
    {
      title: '필드',
      key: 'fields_count',
      width: '5%',
      render: (_: any, record: UnifiedTemplate) => {
        const fields = unifiedTemplateService.parseFieldsSchema(record.fields_schema)
        return fields.length
      }
    },
    {
      title: '평가 설정',
      key: 'scoring_info',
      width: '18%',
      render: (_: any, record: UnifiedTemplate) => {
        if (!record.has_scoring) {
          return <Text type="secondary">-</Text>
        }
        return (
          <Space wrap size={[4, 4]}>
            {record.grade_type && (
              <Tooltip title="등급 유형">
                <Tag color="purple">{unifiedTemplateService.getGradeTypeLabel(record.grade_type)}</Tag>
              </Tooltip>
            )}
            {record.matching_type && (
              <Tooltip title="매칭 방식">
                <Tag color="cyan">{unifiedTemplateService.getMatchingTypeLabel(record.matching_type)}</Tag>
              </Tooltip>
            )}
            {record.aggregation_mode && record.aggregation_mode !== 'first' && (
              <Tooltip title="집계 방식">
                <Tag color="geekblue">{unifiedTemplateService.getAggregationModeLabel(record.aggregation_mode)}</Tag>
              </Tooltip>
            )}
          </Space>
        )
      }
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '6%',
      render: (active: boolean) => (
        active ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>
      )
    },
    {
      title: '작업',
      key: 'actions',
      width: '12%',
      render: (_: any, record: UnifiedTemplate) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openUnifiedTemplateEditModal(record)}
          >
            수정
          </Button>
        </Space>
      )
    }
  ]

  // 통합 템플릿 확장 렌더
  const unifiedTemplateExpandedRowRender = (record: UnifiedTemplate) => {
    if (!record.has_scoring) {
      return (
        <div className="p-4 bg-gray-50 rounded">
          <Text type="secondary">평가 설정 없음 (입력만 수집)</Text>
        </div>
      )
    }

    const mappings = unifiedTemplateService.parseMappings(record.default_mappings)

    return (
      <div className="p-4 bg-blue-50 rounded">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Text strong className="text-blue-800">📊 평가 설정</Text>
            <Descriptions size="small" column={1} className="mt-2">
              <Descriptions.Item label="평가 방법">
                <Tag color="blue">{unifiedTemplateService.getEvaluationMethodLabel(record.evaluation_method)}</Tag>
              </Descriptions.Item>
              {record.grade_type && (
                <Descriptions.Item label="등급 유형">
                  {unifiedTemplateService.getGradeTypeLabel(record.grade_type)}
                </Descriptions.Item>
              )}
              {record.matching_type && (
                <Descriptions.Item label="매칭 방식">
                  {unifiedTemplateService.getMatchingTypeLabel(record.matching_type)}
                </Descriptions.Item>
              )}
              {record.aggregation_mode && (
                <Descriptions.Item label="집계 방식">
                  {unifiedTemplateService.getAggregationModeLabel(record.aggregation_mode)}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
          {mappings.length > 0 && (
            <div>
              <Text strong className="text-blue-800">🎯 등급 매핑</Text>
              <div className="mt-2 space-y-1">
                {mappings.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Tag color="orange">{m.score}점</Tag>
                    <span className="text-gray-600">
                      {m.label || (typeof m.value === 'number' ? `${m.value} 이상` : m.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 통합 템플릿 수정 모달 열기
  const openUnifiedTemplateEditModal = (template: UnifiedTemplate) => {
    setEditingUnifiedTemplate(template)
    setUnifiedFieldsSchema(unifiedTemplateService.parseFieldsSchema(template.fields_schema))
    setUnifiedGradeMappings(unifiedTemplateService.parseMappings(template.default_mappings))
    setUnifiedKeywords(unifiedTemplateService.parseKeywords(template.keywords))
    setUnifiedDataSource((template.data_source as DataSourceType) || 'form_input')
    unifiedTemplateEditForm.setFieldsValue({
      template_name: template.template_name,
      description: template.description,
      data_source: template.data_source || 'form_input',
      source_field: template.source_field,
      display_only: template.display_only || false,
      layout_type: template.layout_type,
      is_repeatable: template.is_repeatable,
      max_entries: template.max_entries,
      help_text: template.help_text,
      placeholder: template.placeholder,
      is_active: template.is_active,
      // 평가 설정
      evaluation_method: template.evaluation_method || 'standard',
      grade_type: template.grade_type,
      matching_type: template.matching_type,
      scoring_value_source: template.scoring_value_source,
      scoring_source_field: template.scoring_source_field,
      extract_pattern: template.extract_pattern,
      aggregation_mode: template.aggregation_mode || 'first',
      grade_edit_mode: template.grade_edit_mode || 'flexible',
      proof_required: template.proof_required || 'optional',
      verification_note: template.verification_note,
      is_required_default: template.is_required_default || false,
      allow_multiple: template.allow_multiple || false,
      auto_confirm_across_projects: template.auto_confirm_across_projects || false
    })
    setIsUnifiedTemplateEditModalOpen(true)
  }

  // 통합 템플릿 검증
  const validateUnifiedTemplate = (values: any): { errors: string[], warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []

    const { data_source, grade_type, matching_type, scoring_source_field, aggregation_mode } = values

    // 평가 설정이 있는지 확인
    const hasScoring = grade_type && matching_type

    if (hasScoring) {
      // 1. 소스 필드 검증 (폼 입력인 경우에만 필드 스키마 검증)
      if (!scoring_source_field) {
        warnings.push('평가 설정이 있지만 소스 필드가 지정되지 않았습니다.')
      } else if (data_source === 'form_input') {
        // 폼 입력인 경우에만 필드 스키마에서 소스 필드 검증
        const sourceField = unifiedFieldsSchema.find(f => f.name === scoring_source_field)

        if (!sourceField) {
          errors.push(`소스 필드 '${scoring_source_field}'가 필드 스키마에 존재하지 않습니다.`)
        } else {
          // 소스 필드 타입과 등급 유형 일치 여부
          if (grade_type === 'numeric' && sourceField.type !== 'number') {
            errors.push(`등급 유형이 '숫자'이지만 소스 필드 '${sourceField.label || sourceField.name}'의 타입이 '${sourceField.type}'입니다.`)
          }
          if (grade_type === 'string' && !['text', 'select', 'textarea'].includes(sourceField.type)) {
            warnings.push(`등급 유형이 '문자열'이지만 소스 필드 '${sourceField.label || sourceField.name}'의 타입이 '${sourceField.type}'입니다.`)
          }
          if (grade_type === 'file_exists' && sourceField.type !== 'file') {
            errors.push(`등급 유형이 '파일유무'이지만 소스 필드 '${sourceField.label || sourceField.name}'의 타입이 '${sourceField.type}'입니다.`)
          }

          // 소스 필드가 필수인지 확인
          if (!sourceField.required) {
            warnings.push(`소스 필드 '${sourceField.label || sourceField.name}'가 '선택'으로 설정되어 있습니다. 평가에 사용되는 필드는 '필수'로 설정하는 것이 좋습니다.`)
          }
        }
      }
      // 회원정보 참조(user_profile) 또는 중앙DB 참조(coach_competency)인 경우
      // 소스 필드는 시스템 필드이므로 별도 검증 불필요

      // 2. 집계 방식과 등급 유형 검증 (합계/최대값은 숫자 타입에서만 의미 있음)
      if (['sum', 'max'].includes(aggregation_mode) && grade_type !== 'numeric') {
        errors.push(`집계 방식이 '${aggregation_mode === 'sum' ? '합계' : '최대값'}'이지만 등급 유형이 '숫자'가 아닙니다. 합계/최대값은 숫자 타입에서만 사용할 수 있습니다.`)
      }

      // 3. 등급 매핑 검증
      if (unifiedGradeMappings.length === 0) {
        warnings.push('등급 매핑이 설정되지 않았습니다. 점수 계산이 제대로 되지 않을 수 있습니다.')
      }
    }

    // 4. 등급 유형만 있고 매칭 방식이 없는 경우
    if (grade_type && !matching_type) {
      warnings.push('등급 유형은 선택되었지만 매칭 방식이 선택되지 않았습니다.')
    }

    return { errors, warnings }
  }

  // 통합 템플릿 생성 - 신규
  const openCreateNewUnifiedTemplate = () => {
    setIsUnifiedTemplateSelectModalOpen(false)
    setCloneSourceTemplate(null)
    unifiedTemplateCreateForm.resetFields()
    setUnifiedFieldsSchema([])
    setUnifiedGradeMappings([])
    setUnifiedKeywords([])
    setUnifiedDataSource('form_input')
    unifiedTemplateCreateForm.setFieldsValue({
      data_source: 'form_input',
      layout_type: 'vertical',
      evaluation_method: 'standard',
      grade_edit_mode: 'flexible',
      proof_required: 'optional',
      is_active: true
    })
    setIsUnifiedTemplateCreateModalOpen(true)
  }

  // 통합 템플릿 생성 - 복제
  const openCloneUnifiedTemplate = (template: UnifiedTemplate) => {
    setIsUnifiedTemplateSelectModalOpen(false)
    setCloneSourceTemplate(template)
    unifiedTemplateCreateForm.resetFields()
    // 복제할 템플릿의 데이터로 초기화
    setUnifiedFieldsSchema(unifiedTemplateService.parseFieldsSchema(template.fields_schema))
    setUnifiedGradeMappings(unifiedTemplateService.parseMappings(template.default_mappings))
    setUnifiedKeywords(unifiedTemplateService.parseKeywords(template.keywords))
    setUnifiedDataSource((template.data_source as DataSourceType) || 'form_input')
    unifiedTemplateCreateForm.setFieldsValue({
      template_name: `${template.template_name} (복제)`,
      description: template.description,
      data_source: template.data_source || 'form_input',
      source_field: template.source_field,
      display_only: template.display_only || false,
      layout_type: template.layout_type,
      is_repeatable: template.is_repeatable,
      max_entries: template.max_entries,
      help_text: template.help_text,
      placeholder: template.placeholder,
      is_active: true,
      evaluation_method: template.evaluation_method || 'standard',
      grade_type: template.grade_type,
      matching_type: template.matching_type,
      scoring_value_source: template.scoring_value_source,
      scoring_source_field: template.scoring_source_field,
      extract_pattern: template.extract_pattern,
      aggregation_mode: template.aggregation_mode || 'first',
      grade_edit_mode: template.grade_edit_mode || 'flexible',
      proof_required: template.proof_required || 'optional',
      verification_note: template.verification_note,
      is_required_default: template.is_required_default || false,
      allow_multiple: template.allow_multiple || false,
      auto_confirm_across_projects: template.auto_confirm_across_projects || false
    })
    setIsUnifiedTemplateCreateModalOpen(true)
  }

  // 통합 템플릿 생성 핸들러
  const handleCreateUnifiedTemplate = async (values: any) => {
    // template_id 검증
    if (!values.template_id || !/^[a-z0-9_]+$/.test(values.template_id)) {
      message.error('템플릿 ID는 영문 소문자, 숫자, 언더스코어만 사용할 수 있습니다.')
      return
    }

    // 검증 수행
    const { errors, warnings } = validateUnifiedTemplate(values)

    if (errors.length > 0) {
      Modal.error({
        title: '템플릿 검증 오류',
        content: (
          <div>
            <p className="mb-2">다음 오류를 수정해주세요:</p>
            <ul className="list-disc pl-4">
              {errors.map((err, i) => <li key={i} className="text-red-600">{err}</li>)}
            </ul>
          </div>
        )
      })
      return
    }

    const doCreate = async () => {
      try {
        const cleanedValues = Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, value === '' ? null : value])
        )

        // file 필드가 없으면 proof_required를 자동으로 not_required로 설정
        const hasFileField = unifiedFieldsSchema.some(f => f.type === 'file')
        if (!hasFileField) {
          cleanedValues.proof_required = 'not_required'
        }

        const templateData = {
          ...cleanedValues,
          fields_schema: unifiedTemplateService.stringifyFieldsSchema(unifiedFieldsSchema),
          default_mappings: unifiedTemplateService.stringifyMappings(unifiedGradeMappings),
          keywords: unifiedTemplateService.stringifyKeywords(unifiedKeywords)
        } as UnifiedTemplateCreate
        await unifiedTemplateService.create(templateData)
        message.success('템플릿이 생성되었습니다.')
        setIsUnifiedTemplateCreateModalOpen(false)
        setCloneSourceTemplate(null)
        unifiedTemplateCreateForm.resetFields()
        setUnifiedFieldsSchema([])
        setUnifiedGradeMappings([])
        setUnifiedKeywords([])
        loadUnifiedTemplates()
      } catch (error: any) {
        console.error('템플릿 생성 실패:', error)
        if (error.response?.status === 409) {
          message.error('이미 존재하는 템플릿 ID입니다. 다른 ID를 사용해주세요.')
        } else {
          message.error(error.response?.data?.detail || '생성에 실패했습니다.')
        }
      }
    }

    if (warnings.length > 0) {
      Modal.confirm({
        title: '템플릿 검증 경고',
        content: (
          <div>
            <p className="mb-2">다음 사항을 확인해주세요:</p>
            <ul className="list-disc pl-4">
              {warnings.map((warn, i) => <li key={i} className="text-orange-600">{warn}</li>)}
            </ul>
            <p className="mt-2 font-semibold">계속 생성하시겠습니까?</p>
          </div>
        ),
        onOk: doCreate
      })
    } else {
      await doCreate()
    }
  }

  // 통합 템플릿 수정 핸들러
  const handleEditUnifiedTemplate = async (values: any) => {
    if (!editingUnifiedTemplate) return

    // 검증 수행
    const { errors, warnings } = validateUnifiedTemplate(values)

    // 에러가 있으면 저장 차단
    if (errors.length > 0) {
      Modal.error({
        title: '템플릿 검증 오류',
        content: (
          <div>
            <p className="mb-2">다음 오류를 수정해주세요:</p>
            <ul className="list-disc pl-4">
              {errors.map((err, i) => <li key={i} className="text-red-600">{err}</li>)}
            </ul>
          </div>
        )
      })
      return
    }

    // 경고가 있으면 확인 요청
    if (warnings.length > 0) {
      Modal.confirm({
        title: '템플릿 검증 경고',
        content: (
          <div>
            <p className="mb-2">다음 사항을 확인해주세요:</p>
            <ul className="list-disc pl-4">
              {warnings.map((warn, i) => <li key={i} className="text-orange-600">{warn}</li>)}
            </ul>
            <p className="mt-3">그래도 저장하시겠습니까?</p>
          </div>
        ),
        okText: '저장',
        cancelText: '취소',
        onOk: () => saveUnifiedTemplate(values)
      })
      return
    }

    // 검증 통과 시 바로 저장
    await saveUnifiedTemplate(values)
  }

  // 실제 저장 로직
  const saveUnifiedTemplate = async (values: any) => {
    try {
      // 빈 문자열을 null로 변환 (백엔드 Literal 타입 검증 통과를 위해)
      const cleanedValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value === '' ? null : value])
      )

      // file 필드가 없으면 proof_required를 자동으로 not_required로 설정
      const hasFileField = unifiedFieldsSchema.some(f => f.type === 'file')
      if (!hasFileField) {
        cleanedValues.proof_required = 'not_required'
      }

      const templateData: UnifiedTemplateUpdate = {
        ...cleanedValues,
        fields_schema: unifiedTemplateService.stringifyFieldsSchema(unifiedFieldsSchema),
        default_mappings: unifiedTemplateService.stringifyMappings(unifiedGradeMappings),
        keywords: unifiedTemplateService.stringifyKeywords(unifiedKeywords)
      }
      await unifiedTemplateService.update(editingUnifiedTemplate!.template_id, templateData)
      message.success('템플릿이 수정되었습니다.')
      setIsUnifiedTemplateEditModalOpen(false)
      setEditingUnifiedTemplate(null)
      unifiedTemplateEditForm.resetFields()
      setUnifiedFieldsSchema([])
      setUnifiedGradeMappings([])
      setUnifiedKeywords([])
      loadUnifiedTemplates()
    } catch (error: any) {
      console.error('템플릿 수정 실패:', error)
      message.error(error.response?.data?.detail || '수정에 실패했습니다.')
    }
  }

  // 통합 템플릿 필드 스키마 관리
  const addUnifiedFieldSchema = () => {
    setUnifiedFieldsSchema([...unifiedFieldsSchema, { name: '', type: 'text', label: '', required: false }])
  }

  const updateUnifiedFieldSchema = (index: number, field: keyof UnifiedFieldSchema, value: any) => {
    const updated = [...unifiedFieldsSchema]
    updated[index] = { ...updated[index], [field]: value }
    setUnifiedFieldsSchema(updated)
  }

  const removeUnifiedFieldSchema = (index: number) => {
    setUnifiedFieldsSchema(unifiedFieldsSchema.filter((_, i) => i !== index))
  }

  // 통합 템플릿 키워드 관리
  const addUnifiedKeyword = (keyword: string) => {
    if (keyword && !unifiedKeywords.includes(keyword)) {
      setUnifiedKeywords([...unifiedKeywords, keyword])
    }
  }

  const removeUnifiedKeyword = (keyword: string) => {
    setUnifiedKeywords(unifiedKeywords.filter(k => k !== keyword))
  }

  // 통합 템플릿 등급 매핑 관리
  const addUnifiedGradeMapping = () => {
    setUnifiedGradeMappings([...unifiedGradeMappings, { value: '', score: 0 }])
  }

  const updateUnifiedGradeMapping = (index: number, field: keyof UnifiedGradeMapping, value: any) => {
    const updated = [...unifiedGradeMappings]
    updated[index] = { ...updated[index], [field]: value }
    setUnifiedGradeMappings(updated)
  }

  const removeUnifiedGradeMapping = (index: number) => {
    setUnifiedGradeMappings(unifiedGradeMappings.filter((_, i) => i !== index))
  }

  // 이 통합 템플릿을 사용하는 역량항목 찾기
  const getItemsUsingUnifiedTemplate = (templateId: string): CompetencyItem[] => {
    return items.filter(item => item.template === templateId)
  }

  const columns = [
    {
      title: '항목코드',
      dataIndex: 'item_code',
      key: 'item_code',
      width: '12%',
    },
    {
      title: '항목명',
      dataIndex: 'item_name',
      key: 'item_name',
      width: '18%',
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      width: '8%',
      render: (category: string) => getCategoryTag(category),
    },
    {
      title: '연결 템플릿',
      key: 'unified_template',
      width: '20%',
      render: (_: any, record: CompetencyItem) => {
        // 통합 템플릿이 연결된 경우
        if (record.unified_template) {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="blue" icon={<LinkOutlined />}>
                {record.unified_template.template_name}
              </Tag>
              {record.unified_template.has_scoring ? (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {unifiedTemplateService.getEvaluationMethodLabel(record.unified_template.evaluation_method)}
                  {record.evaluation_method_override && ` → ${unifiedTemplateService.getEvaluationMethodLabel(record.evaluation_method_override)}`}
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: '11px' }}>입력만</Text>
              )}
            </Space>
          )
        }
        // unified_template_id만 있는 경우 (아직 로딩 안됨)
        if (record.unified_template_id) {
          return <Tag color="blue">{record.unified_template_id}</Tag>
        }
        // Legacy: 이전 템플릿만 있는 경우
        if (record.scoring_template_id || record.template) {
          return (
            <Tooltip title="Legacy 템플릿 (마이그레이션 필요)">
              <Tag color="orange">
                {record.scoring_template_id || record.template}
              </Tag>
            </Tooltip>
          )
        }
        return <Text type="secondary">-</Text>
      },
    },
    {
      title: '다중입력',
      dataIndex: 'is_repeatable',
      key: 'is_repeatable',
      width: '8%',
      render: (repeatable: boolean, record: CompetencyItem) => (
        repeatable ? <Tag color="blue">Yes ({record.max_entries || '∞'})</Tag> : <Tag>No</Tag>
      ),
    },
    {
      title: '필드 수',
      key: 'fields_count',
      width: '6%',
      render: (_: any, record: CompetencyItem) => record.fields?.length || 0,
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '6%',
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

          {/* 템플릿 관리 탭 (입력+평가 통합) */}
          <Tabs.TabPane tab="템플릿 관리" key="unifiedTemplates">
            <div className="flex justify-between items-center mb-4">
              <Text className="text-gray-600">
                역량항목의 입력 폼 구조와 평가 방법을 통합 관리합니다.
              </Text>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsUnifiedTemplateSelectModalOpen(true)}
              >
                새 템플릿 추가
              </Button>
            </div>

            <div className="mb-4">
              <Space>
                <Text>비활성 템플릿 포함:</Text>
                <Switch checked={showInactiveInputTemplates} onChange={setShowInactiveInputTemplates} />
              </Space>
            </div>

            <Table
              columns={unifiedTemplateColumns}
              dataSource={unifiedTemplates}
              rowKey="template_id"
              loading={unifiedTemplatesLoading}
              expandable={{
                expandedRowRender: unifiedTemplateExpandedRowRender,
                rowExpandable: (record) => record.has_scoring
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `총 ${total}개`
              }}
              locale={{
                emptyText: '등록된 템플릿이 없습니다.'
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

            <Form.Item
              name="description"
              label="설명/안내문구"
              tooltip="코치에게 표시될 입력 안내 문구"
            >
              <Input.TextArea rows={2} placeholder="예: 보유하신 코칭 자격증 정보를 입력해주세요" />
            </Form.Item>

            {/* 통합 템플릿 선택 섹션 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>
                <LinkOutlined className="mr-2" />
                통합 템플릿 연결
              </Title>
              <Alert
                message="템플릿 연결"
                description="역량항목에 템플릿을 연결하면 입력 폼 구조와 평가 방법이 자동으로 적용됩니다."
                type="info"
                showIcon
                className="mb-4"
              />
              <Form.Item
                name="unified_template_id"
                label="통합 템플릿"
                tooltip="이 항목의 입력 폼과 평가에 사용할 템플릿을 선택합니다"
              >
                <Select
                  placeholder="통합 템플릿 선택"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={unifiedTemplates.map(t => ({
                    label: `${t.template_name} (${t.template_id})`,
                    value: t.template_id
                  }))}
                />
              </Form.Item>

              {/* 자격증 평가방법 오버라이드 (자격증 템플릿 선택 시) */}
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.unified_template_id !== curr.unified_template_id}>
                {({ getFieldValue }) => {
                  const selectedTemplateId = getFieldValue('unified_template_id')
                  const template = unifiedTemplates.find(t => t.template_id === selectedTemplateId)
                  if (!template) return null

                  const mappings = unifiedTemplateService.parseMappings(template.default_mappings)

                  return (
                    <>
                      {/* 자격증 템플릿인 경우 평가방법 선택 */}
                      {template.is_certification && (
                        <Form.Item
                          name="evaluation_method_override"
                          label="평가방법 (자격증)"
                          tooltip="자격증 평가 시 이름으로 평가할지, 유무로 평가할지 선택합니다"
                        >
                          <Select
                            placeholder="평가방법 선택"
                            allowClear
                            options={[
                              { label: '기본 (템플릿 설정 사용)', value: '' },
                              { label: '이름으로 평가 (자격증명 키워드 매칭)', value: 'by_name' },
                              { label: '유무로 평가 (증빙파일 첨부 여부)', value: 'by_existence' }
                            ]}
                          />
                        </Form.Item>
                      )}

                      {/* 선택된 템플릿 미리보기 */}
                      <div className="bg-gray-50 p-4 rounded mb-4">
                        <Text strong>선택된 템플릿:</Text> <Tag color="blue">{template.template_name}</Tag>
                        <Descriptions size="small" column={2} className="mt-2">
                          <Descriptions.Item label="데이터소스">
                            {unifiedTemplateService.getDataSourceLabel(template.data_source)}
                          </Descriptions.Item>
                          <Descriptions.Item label="평가방법">
                            {unifiedTemplateService.getEvaluationMethodLabel(template.evaluation_method)}
                          </Descriptions.Item>
                          {template.grade_type && (
                            <Descriptions.Item label="등급유형">
                              {unifiedTemplateService.getGradeTypeLabel(template.grade_type)}
                            </Descriptions.Item>
                          )}
                          {template.matching_type && (
                            <Descriptions.Item label="매칭방식">
                              {unifiedTemplateService.getMatchingTypeLabel(template.matching_type)}
                            </Descriptions.Item>
                          )}
                        </Descriptions>
                        {template.has_scoring && mappings.length > 0 && (
                          <div className="mt-2">
                            <Text type="secondary">등급 매핑 ({mappings.length}개):</Text>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {mappings.slice(0, 5).map((m, i) => (
                                <Tag key={i}>{String(m.value)} → {m.score}점</Tag>
                              ))}
                              {mappings.length > 5 && <Tag>+{mappings.length - 5}개</Tag>}
                            </div>
                          </div>
                        )}
                        {!template.has_scoring && (
                          <div className="mt-2">
                            <Tag color="default">평가 없음 (입력만)</Tag>
                          </div>
                        )}
                      </div>
                    </>
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

            <Form.Item
              name="description"
              label="설명/안내문구"
              tooltip="코치에게 표시될 입력 안내 문구"
            >
              <Input.TextArea rows={2} placeholder="예: 보유하신 코칭 자격증 정보를 입력해주세요" />
            </Form.Item>

            {/* 통합 템플릿 선택 섹션 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>
                <LinkOutlined className="mr-2" />
                통합 템플릿 연결
              </Title>

              {/* 현재 연결 상태 표시 */}
              {editingItem?.unified_template && (
                <Alert
                  message={`현재 연결: ${editingItem.unified_template.template_name}`}
                  type="success"
                  showIcon
                  className="mb-4"
                />
              )}

              <Form.Item
                name="unified_template_id"
                label="통합 템플릿"
                tooltip="이 항목의 입력 폼과 평가에 사용할 템플릿을 선택합니다"
              >
                <Select
                  placeholder="통합 템플릿 선택"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={unifiedTemplates.map(t => ({
                    label: `${t.template_name} (${t.template_id})`,
                    value: t.template_id
                  }))}
                />
              </Form.Item>

              {/* 자격증 평가방법 오버라이드 및 템플릿 미리보기 */}
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.unified_template_id !== curr.unified_template_id}>
                {({ getFieldValue }) => {
                  const selectedTemplateId = getFieldValue('unified_template_id')
                  const template = unifiedTemplates.find(t => t.template_id === selectedTemplateId)
                  if (!template) return null

                  const mappings = unifiedTemplateService.parseMappings(template.default_mappings)

                  return (
                    <>
                      {/* 자격증 템플릿인 경우 평가방법 선택 */}
                      {template.is_certification && (
                        <Form.Item
                          name="evaluation_method_override"
                          label="평가방법 (자격증)"
                          tooltip="자격증 평가 시 이름으로 평가할지, 유무로 평가할지 선택합니다"
                        >
                          <Select
                            placeholder="평가방법 선택"
                            allowClear
                            options={[
                              { label: '기본 (템플릿 설정 사용)', value: '' },
                              { label: '이름으로 평가 (자격증명 키워드 매칭)', value: 'by_name' },
                              { label: '유무로 평가 (증빙파일 첨부 여부)', value: 'by_existence' }
                            ]}
                          />
                        </Form.Item>
                      )}

                      {/* 선택된 템플릿 미리보기 */}
                      <div className="bg-gray-50 p-4 rounded mb-4">
                        <Text strong>선택된 템플릿:</Text> <Tag color="blue">{template.template_name}</Tag>
                        <Descriptions size="small" column={2} className="mt-2">
                          <Descriptions.Item label="데이터소스">
                            {unifiedTemplateService.getDataSourceLabel(template.data_source)}
                          </Descriptions.Item>
                          <Descriptions.Item label="평가방법">
                            {unifiedTemplateService.getEvaluationMethodLabel(template.evaluation_method)}
                          </Descriptions.Item>
                          {template.grade_type && (
                            <Descriptions.Item label="등급유형">
                              {unifiedTemplateService.getGradeTypeLabel(template.grade_type)}
                            </Descriptions.Item>
                          )}
                          {template.matching_type && (
                            <Descriptions.Item label="매칭방식">
                              {unifiedTemplateService.getMatchingTypeLabel(template.matching_type)}
                            </Descriptions.Item>
                          )}
                        </Descriptions>
                        {template.has_scoring && mappings.length > 0 && (
                          <div className="mt-2">
                            <Text type="secondary">등급 매핑 ({mappings.length}개):</Text>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {mappings.slice(0, 5).map((m, i) => (
                                <Tag key={i}>{String(m.value)} → {m.score}점</Tag>
                              ))}
                              {mappings.length > 5 && <Tag>+{mappings.length - 5}개</Tag>}
                            </div>
                          </div>
                        )}
                        {!template.has_scoring && (
                          <div className="mt-2">
                            <Tag color="default">평가 없음 (입력만)</Tag>
                          </div>
                        )}
                        {/* 등급 수정 모드 안내 */}
                        <div className="mt-2">
                          <Tag color={template.grade_edit_mode === 'fixed' ? 'red' : template.grade_edit_mode === 'score_only' ? 'orange' : 'green'}>
                            {unifiedTemplateService.getGradeEditModeLabel(template.grade_edit_mode)}
                          </Tag>
                        </div>
                      </div>
                    </>
                  )
                }}
              </Form.Item>
            </div>

            {/* 역량항목 전용 설정 섹션 */}
            <div className="border-t pt-4 mt-4">
              <Title level={5}>역량항목 설정 (커스터마이징)</Title>

              <Form.Item
                name="proof_required"
                label="증빙 필수"
                tooltip="코치가 증빙을 제출해야 하는지 여부"
              >
                <Select
                  options={[
                    { label: '필요 없음', value: 'not_required' },
                    { label: '선택 (제출 가능)', value: 'optional' },
                    { label: '필수', value: 'required' }
                  ]}
                />
              </Form.Item>

              <Form.Item
                name="verification_note"
                label="검증 안내"
                tooltip="검토자가 확인할 때 참고할 안내 문구"
              >
                <Input.TextArea rows={2} placeholder="예: 자격증 적합성은 검토자가 증빙을 확인하여 판단합니다" />
              </Form.Item>

              <Form.Item
                name="help_text"
                label="도움말"
                tooltip="코치에게 표시될 도움말"
              >
                <Input.TextArea rows={2} placeholder="예: 코칭 관련 자격증만 입력해주세요" />
              </Form.Item>

              <Form.Item
                name="auto_confirm_across_projects"
                label="타 과제 자동 컨펌"
                valuePropName="checked"
                tooltip="한 과제에서 확인완료되면 다른 과제에도 자동 적용"
              >
                <Switch />
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
              value_source: 'submitted',
              aggregation_mode: 'best_match',
              proof_required: 'optional',
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
              is_repeatable: false
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

        {/* Input Template Edit Modal - 개선된 레이아웃 */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <SettingOutlined />
              <span>입력 템플릿 수정</span>
            </div>
          }
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
          width={720}
        >
          <Form
            form={inputTemplateEditForm}
            layout="vertical"
            onFinish={handleEditInputTemplate}
            size="small"
          >
            {/* 연결된 역량항목 표시 */}
            {editingInputTemplate && (
              <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <LinkOutlined className="text-blue-600" />
                  <Text strong className="text-blue-800">
                    이 템플릿을 사용하는 역량항목
                  </Text>
                  <Tag color="blue">{getItemsUsingTemplate(editingInputTemplate.template_id).length}개</Tag>
                </div>
                <div className="flex flex-wrap gap-1">
                  {getItemsUsingTemplate(editingInputTemplate.template_id).length > 0 ? (
                    getItemsUsingTemplate(editingInputTemplate.template_id).map(item => (
                      <Tag key={item.item_id} color="geekblue">{item.item_name}</Tag>
                    ))
                  ) : (
                    <Text type="secondary" className="text-xs">사용 중인 역량항목이 없습니다</Text>
                  )}
                </div>
              </div>
            )}

            {/* 기본 정보 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">기본 정보</Text>
              </Divider>
              {/* 라벨 행 */}
              <div className="grid grid-cols-12 gap-3 mb-1">
                <div className="col-span-4">
                  <span className="text-xs text-gray-500">템플릿 ID</span>
                </div>
                <div className="col-span-6">
                  <span className="text-xs text-gray-500">* 템플릿명</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">활성</span>
                </div>
              </div>
              {/* 값/입력 행 */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-4">
                  <div className="px-2 py-1 bg-gray-100 rounded text-sm font-mono h-[30px] flex items-center">
                    {editingInputTemplate?.template_id}
                  </div>
                </div>
                <div className="col-span-6">
                  <Form.Item name="template_name" rules={[{ required: true, message: '필수' }]} className="!mb-0">
                    <Input size="small" />
                  </Form.Item>
                </div>
                <div className="col-span-2">
                  <Form.Item name="is_active" valuePropName="checked" className="!mb-0">
                    <Switch size="small" />
                  </Form.Item>
                </div>
              </div>
              {/* 설명 - 인라인 */}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-500 w-12 flex-shrink-0">설명</span>
                <Form.Item name="description" className="!mb-0 flex-1">
                  <Input size="small" placeholder="템플릿 설명 (선택사항)" />
                </Form.Item>
              </div>
            </div>

            {/* 데이터 소스 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">데이터 소스</Text>
              </Divider>
              <div className="grid grid-cols-12 gap-2 mb-1">
                <div className="col-span-4">
                  <span className="text-xs text-gray-500">소스 유형</span>
                </div>
                <div className="col-span-5">
                  <span className="text-xs text-gray-500">참조 필드 (회원정보 참조 시)</span>
                </div>
                <div className="col-span-3">
                  <span className="text-xs text-gray-500">읽기전용</span>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Form.Item name="data_source" className="!mb-0">
                    <Select
                      size="small"
                      onChange={(value: DataSourceType) => setSelectedDataSource(value)}
                      options={[
                        { label: '폼 입력', value: 'form_input' },
                        { label: '회원정보 참조', value: 'user_profile' },
                        { label: '중앙 DB 참조', value: 'coach_competency' }
                      ]}
                    />
                  </Form.Item>
                </div>
                <div className="col-span-5">
                  <Form.Item name="source_field" className="!mb-0">
                    <Select
                      size="small"
                      allowClear
                      placeholder="필드 선택"
                      disabled={selectedDataSource !== 'user_profile'}
                      options={userProfileFields.map(f => ({
                        label: f.label,
                        value: f.field_name
                      }))}
                    />
                  </Form.Item>
                </div>
                <div className="col-span-3">
                  <Form.Item name="display_only" valuePropName="checked" className="!mb-0">
                    <Switch size="small" disabled={selectedDataSource === 'form_input'} />
                  </Form.Item>
                </div>
              </div>
              {selectedDataSource === 'user_profile' && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                  회원가입 시 입력한 정보를 참조합니다. 평가 시 해당 필드 값으로 점수를 계산합니다.
                </div>
              )}
            </div>

            {/* 입력 설정 섹션 - data_source가 form_input일 때만 표시 */}
            {selectedDataSource === 'form_input' && (
            <>
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">입력 설정</Text>
              </Divider>
              {/* 라벨 행 */}
              <div className="grid grid-cols-12 gap-2 mb-1">
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">레이아웃</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">다중입력</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">최대 수</span>
                </div>
                <div className="col-span-6">
                  <span className="text-xs text-gray-500">플레이스홀더</span>
                </div>
              </div>
              {/* 값/입력 행 */}
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <Form.Item name="layout_type" className="!mb-0">
                    <Select
                      size="small"
                      options={[
                        { label: '세로', value: 'vertical' },
                        { label: '가로', value: 'horizontal' },
                        { label: '그리드', value: 'grid' }
                      ]}
                    />
                  </Form.Item>
                </div>
                <div className="col-span-2">
                  <Form.Item name="is_repeatable" valuePropName="checked" className="!mb-0">
                    <Switch size="small" />
                  </Form.Item>
                </div>
                <div className="col-span-2">
                  <Form.Item name="max_entries" className="!mb-0">
                    <Input size="small" placeholder="무제한" />
                  </Form.Item>
                </div>
                <div className="col-span-6">
                  <Form.Item name="placeholder" className="!mb-0">
                    <Input size="small" />
                  </Form.Item>
                </div>
              </div>
              {/* 도움말 - 인라인 */}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-500 w-12 flex-shrink-0">도움말</span>
                <Form.Item name="help_text" className="!mb-0 flex-1">
                  <Input size="small" placeholder="사용자에게 표시될 안내 문구" />
                </Form.Item>
              </div>
            </div>

            {/* 필드 스키마 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Space size="small">
                  <Text strong className="text-gray-600 text-sm">필드 스키마</Text>
                  <Tag color="orange" className="!mr-0">{fieldsSchema.length}개</Tag>
                </Space>
              </Divider>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {fieldsSchema.map((field, index) => (
                  <div key={index} className="flex gap-1 items-center bg-gray-50 p-1 rounded">
                    <Input
                      size="small"
                      placeholder="필드명"
                      value={field.name}
                      onChange={e => updateFieldSchema(index, 'name', e.target.value)}
                      style={{ width: 90 }}
                      className="font-mono text-xs"
                    />
                    <Select
                      size="small"
                      placeholder="타입"
                      value={field.type}
                      onChange={v => updateFieldSchema(index, 'type', v)}
                      style={{ width: 80 }}
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
                      size="small"
                      placeholder="레이블"
                      value={field.label}
                      onChange={e => updateFieldSchema(index, 'label', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Switch
                      size="small"
                      checkedChildren="필수"
                      unCheckedChildren="선택"
                      checked={field.required}
                      onChange={v => updateFieldSchema(index, 'required', v)}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeFieldSchema(index)}
                    />
                  </div>
                ))}
              </div>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={addFieldSchema}
                className="w-full mt-2"
              >
                필드 추가
              </Button>
            </div>
            </>
            )}

            {/* 키워드 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">키워드 (자동 매칭)</Text>
              </Divider>
              <div className="flex flex-wrap gap-1 mb-2 min-h-6">
                {inputKeywords.map(kw => (
                  <Tag key={kw} closable onClose={() => removeInputKeyword(kw)} className="!m-0">
                    {kw}
                  </Tag>
                ))}
              </div>
              <Input
                size="small"
                placeholder="키워드 입력 후 Enter"
                onPressEnter={(e) => {
                  addInputKeyword(e.currentTarget.value)
                  e.currentTarget.value = ''
                }}
                style={{ width: 180 }}
              />
            </div>

            {/* 평가 설정 섹션 (통합 템플릿에서 가져옴) */}
            {editingInputTemplate && (() => {
              const unified = getUnifiedTemplateForInput(editingInputTemplate.template_id)
              if (!unified || !unified.has_scoring) return null
              const mappings = unifiedTemplateService.parseMappings(unified.default_mappings)
              return (
                <div className="mb-4">
                  <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                    <Text strong className="text-blue-600 text-sm">📊 평가 설정</Text>
                  </Divider>
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    {/* 평가 설정 요약 */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <span className="text-xs text-gray-500 block">등급 유형</span>
                        <Tag color="purple">{unifiedTemplateService.getGradeTypeLabel(unified.grade_type || '')}</Tag>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">매칭 방식</span>
                        <Tag color="cyan">{unifiedTemplateService.getMatchingTypeLabel(unified.matching_type || '')}</Tag>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">집계 방식</span>
                        <Tag color="geekblue">{unifiedTemplateService.getAggregationModeLabel(unified.aggregation_mode || 'first')}</Tag>
                      </div>
                    </div>
                    {/* 등급 매핑 */}
                    {mappings.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">등급 매핑</span>
                        <div className="space-y-1">
                          {mappings.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <Tag color="orange" className="!m-0">{m.score}점</Tag>
                              <span className="text-gray-700">
                                {m.label || (typeof m.value === 'number' ? `${m.value} 이상` : String(m.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-blue-600">
                      💡 평가 설정은 통합 템플릿에서 관리됩니다
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* 저장/취소 버튼 */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                onClick={() => {
                  setIsInputTemplateEditModalOpen(false)
                  setEditingInputTemplate(null)
                  inputTemplateEditForm.resetFields()
                  setFieldsSchema([])
                  setInputKeywords([])
                }}
              >
                취소
              </Button>
              <Button type="primary" htmlType="submit">
                저장
              </Button>
            </div>
          </Form>
        </Modal>

        {/* 통합 템플릿 수정 모달 */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <SettingOutlined className="text-blue-600" />
              <span>템플릿 수정 - {editingUnifiedTemplate?.template_name}</span>
            </div>
          }
          open={isUnifiedTemplateEditModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsUnifiedTemplateEditModalOpen(false)
            setEditingUnifiedTemplate(null)
            unifiedTemplateEditForm.resetFields()
            setUnifiedFieldsSchema([])
            setUnifiedGradeMappings([])
            setUnifiedKeywords([])
          }}
          footer={null}
          width={800}
        >
          <Form
            form={unifiedTemplateEditForm}
            layout="vertical"
            onFinish={handleEditUnifiedTemplate}
            size="small"
          >
            {/* 연결된 역량항목 표시 */}
            {editingUnifiedTemplate && (
              <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <LinkOutlined className="text-blue-600" />
                  <Text strong className="text-blue-800">
                    이 템플릿을 사용하는 역량항목
                  </Text>
                  <Tag color="blue">{getItemsUsingUnifiedTemplate(editingUnifiedTemplate.template_id).length}개</Tag>
                </div>
                <div className="flex flex-wrap gap-1">
                  {getItemsUsingUnifiedTemplate(editingUnifiedTemplate.template_id).length > 0 ? (
                    getItemsUsingUnifiedTemplate(editingUnifiedTemplate.template_id).map(item => (
                      <Tag key={item.item_id} color="geekblue">{item.item_name}</Tag>
                    ))
                  ) : (
                    <Text type="secondary" className="text-xs">사용 중인 역량항목이 없습니다</Text>
                  )}
                </div>
              </div>
            )}

            {/* 기본 정보 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">기본 정보</Text>
              </Divider>
              <div className="grid grid-cols-12 gap-3 mb-1">
                <div className="col-span-4">
                  <span className="text-xs text-gray-500">템플릿 ID</span>
                </div>
                <div className="col-span-6">
                  <span className="text-xs text-gray-500">* 템플릿명</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">활성</span>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-4">
                  <div className="px-2 py-1 bg-gray-100 rounded text-sm font-mono h-[30px] flex items-center">
                    {editingUnifiedTemplate?.template_id}
                  </div>
                </div>
                <div className="col-span-6">
                  <Form.Item name="template_name" rules={[{ required: true, message: '필수' }]} className="!mb-0">
                    <Input size="small" />
                  </Form.Item>
                </div>
                <div className="col-span-2">
                  <Form.Item name="is_active" valuePropName="checked" className="!mb-0">
                    <Switch size="small" />
                  </Form.Item>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-500 w-12 flex-shrink-0">설명</span>
                <Form.Item name="description" className="!mb-0 flex-1">
                  <Input size="small" placeholder="템플릿 설명 (선택사항)" />
                </Form.Item>
              </div>
            </div>

            {/* 데이터 소스 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">데이터 소스</Text>
              </Divider>
              <div className="grid grid-cols-12 gap-2 mb-1">
                <div className="col-span-4">
                  <span className="text-xs text-gray-500">소스 유형</span>
                </div>
                <div className="col-span-5">
                  <span className="text-xs text-gray-500">참조 필드 (회원정보 참조 시)</span>
                </div>
                <div className="col-span-3">
                  <span className="text-xs text-gray-500">읽기전용</span>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Form.Item name="data_source" className="!mb-0">
                    <Select
                      size="small"
                      onChange={(value: DataSourceType) => setUnifiedDataSource(value)}
                      options={[
                        { label: '폼 입력', value: 'form_input' },
                        { label: '회원정보 참조', value: 'user_profile' },
                        { label: '중앙 DB 참조', value: 'coach_competency' }
                      ]}
                    />
                  </Form.Item>
                </div>
                <div className="col-span-5">
                  <Form.Item name="source_field" className="!mb-0">
                    <Select
                      size="small"
                      allowClear
                      placeholder="필드 선택"
                      disabled={unifiedDataSource !== 'user_profile'}
                      options={userProfileFields.map(f => ({
                        label: f.label,
                        value: f.field_name
                      }))}
                    />
                  </Form.Item>
                </div>
                <div className="col-span-3">
                  <Form.Item name="display_only" valuePropName="checked" className="!mb-0">
                    <Switch size="small" disabled={unifiedDataSource === 'form_input'} />
                  </Form.Item>
                </div>
              </div>
            </div>

            {/* 입력 설정 섹션 */}
            {unifiedDataSource === 'form_input' && (
            <>
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">입력 설정</Text>
              </Divider>
              <div className="grid grid-cols-12 gap-2 mb-1">
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">레이아웃</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">다중입력</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">최대 수</span>
                </div>
                <div className="col-span-6">
                  <span className="text-xs text-gray-500">플레이스홀더</span>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <Form.Item name="layout_type" className="!mb-0">
                    <Select
                      size="small"
                      options={[
                        { label: '세로', value: 'vertical' },
                        { label: '가로', value: 'horizontal' },
                        { label: '그리드', value: 'grid' }
                      ]}
                    />
                  </Form.Item>
                </div>
                <div className="col-span-2">
                  <Form.Item name="is_repeatable" valuePropName="checked" className="!mb-0">
                    <Switch size="small" />
                  </Form.Item>
                </div>
                <div className="col-span-2">
                  <Form.Item name="max_entries" className="!mb-0">
                    <Input size="small" placeholder="무제한" />
                  </Form.Item>
                </div>
                <div className="col-span-6">
                  <Form.Item name="placeholder" className="!mb-0">
                    <Input size="small" />
                  </Form.Item>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-500 w-12 flex-shrink-0">도움말</span>
                <Form.Item name="help_text" className="!mb-0 flex-1">
                  <Input size="small" placeholder="사용자에게 표시될 안내 문구" />
                </Form.Item>
              </div>
            </div>

            {/* 필드 스키마 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Space size="small">
                  <Text strong className="text-gray-600 text-sm">필드 스키마</Text>
                  <Tag color="orange" className="!mr-0">{unifiedFieldsSchema.length}개</Tag>
                </Space>
              </Divider>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {unifiedFieldsSchema.map((field, index) => (
                  <div key={index} className="flex gap-1 items-center bg-gray-50 p-1 rounded">
                    <Input
                      size="small"
                      placeholder="필드명"
                      value={field.name}
                      onChange={e => updateUnifiedFieldSchema(index, 'name', e.target.value)}
                      style={{ width: 90 }}
                      className="font-mono text-xs"
                    />
                    <Select
                      size="small"
                      placeholder="타입"
                      value={field.type}
                      onChange={v => updateUnifiedFieldSchema(index, 'type', v)}
                      style={{ width: 80 }}
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
                      size="small"
                      placeholder="레이블"
                      value={field.label}
                      onChange={e => updateUnifiedFieldSchema(index, 'label', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Switch
                      size="small"
                      checkedChildren="필수"
                      unCheckedChildren="선택"
                      checked={field.required}
                      onChange={v => updateUnifiedFieldSchema(index, 'required', v)}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeUnifiedFieldSchema(index)}
                    />
                  </div>
                ))}
              </div>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={addUnifiedFieldSchema}
                className="w-full mt-2"
              >
                필드 추가
              </Button>
            </div>
            </>
            )}

            {/* 평가 설정 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-blue-600 text-sm">📊 평가 설정</Text>
              </Divider>
              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                {/* 평가 방법 및 기본 설정 */}
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">평가 방법</span>
                    <Form.Item name="evaluation_method" className="!mb-0">
                      <Select
                        size="small"
                        options={[
                          { label: '일반 평가', value: 'standard' },
                          { label: '이름으로 평가', value: 'by_name' },
                          { label: '유무로 평가', value: 'by_existence' }
                        ]}
                        onChange={(value) => {
                          if (value === 'by_existence') {
                            // 유무로 평가 선택 시 자동 설정 (수정불가)
                            unifiedTemplateEditForm.setFieldsValue({
                              grade_type: 'file_exists',
                              matching_type: 'exact',
                              grade_edit_mode: 'fixed'
                            })
                            setUnifiedGradeMappings([
                              { value: 'true', score: 20, label: '유자격' },
                              { value: 'false', score: 0, label: '무자격' }
                            ])
                          } else if (value === 'by_name') {
                            // 이름으로 평가 선택 시 문자열 등급 (자유수정)
                            unifiedTemplateEditForm.setFieldsValue({
                              grade_type: 'string',
                              matching_type: 'contains',
                              grade_edit_mode: 'flexible'
                            })
                          }
                        }}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">
                      등급 유형{' '}
                      <Tooltip title="비교할 원본 값의 데이터 타입. 문자열: 텍스트 값 매칭(자격증명 등), 숫자: 범위 비교(시간, 점수), 파일유무: 첨부 여부, 복수선택: 선택 항목 매칭">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="grade_type" className="!mb-0">
                      <Select
                        size="small"
                        allowClear
                        placeholder="선택"
                        options={GRADE_TYPE_OPTIONS}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">매칭 방식</span>
                    <Form.Item name="matching_type" className="!mb-0">
                      <Select
                        size="small"
                        allowClear
                        placeholder="선택"
                        options={MATCHING_TYPE_OPTIONS}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">
                      집계 방식{' '}
                      <Tooltip title="복수 입력 시 점수 계산 방법. 첫번째: 첫 값만, 합계: 모든 점수 합산, 최대값: 숫자 중 가장 큰 값, 최고점수: 각 값의 점수 중 가장 높은 점수, 개수: 입력 개수로 점수">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="aggregation_mode" className="!mb-0">
                      <Select
                        size="small"
                        options={AGGREGATION_MODE_OPTIONS}
                      />
                    </Form.Item>
                  </div>
                </div>

                {/* 값 소스 설정 */}
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">값 소스</span>
                    <Form.Item name="scoring_value_source" className="!mb-0">
                      <Select
                        size="small"
                        allowClear
                        placeholder="선택"
                        options={VALUE_SOURCE_OPTIONS}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">소스 필드</span>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.grade_type !== curr.grade_type}>
                      {({ getFieldValue }) => {
                        const gradeType = getFieldValue('grade_type')

                        // 등급 유형에 따라 선택 가능한 필드 타입 결정
                        let matchingFields: typeof unifiedFieldsSchema = []
                        let placeholder = '필드 선택'

                        if (gradeType === 'numeric') {
                          matchingFields = unifiedFieldsSchema.filter(f => f.type === 'number')
                          placeholder = '숫자 필드 선택'
                        } else if (gradeType === 'string') {
                          matchingFields = unifiedFieldsSchema.filter(f =>
                            ['text', 'select', 'textarea'].includes(f.type)
                          )
                          placeholder = '문자열 필드 선택'
                        } else if (gradeType === 'file_exists') {
                          matchingFields = unifiedFieldsSchema.filter(f => f.type === 'file')
                          placeholder = '파일 필드 선택'
                        } else if (gradeType === 'multi_select') {
                          matchingFields = unifiedFieldsSchema.filter(f =>
                            ['select', 'multiselect'].includes(f.type)
                          )
                          placeholder = '선택 필드 선택'
                        }

                        if (matchingFields.length > 0) {
                          return (
                            <Form.Item name="scoring_source_field" className="!mb-0">
                              <Select
                                size="small"
                                allowClear
                                placeholder={placeholder}
                                options={matchingFields.map(f => ({
                                  label: f.label || f.name,
                                  value: f.name
                                }))}
                              />
                            </Form.Item>
                          )
                        }

                        // 필드가 없거나 등급 유형이 지정되지 않은 경우 수동 입력
                        return (
                          <Form.Item name="scoring_source_field" className="!mb-0">
                            <Input size="small" placeholder="필드명 직접 입력" />
                          </Form.Item>
                        )
                      }}
                    </Form.Item>
                  </div>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.grade_type !== curr.grade_type}>
                    {({ getFieldValue }) => {
                      const gradeType = getFieldValue('grade_type')
                      // 숫자 타입이고 소스필드를 직접 선택한 경우 추출 패턴은 불필요
                      if (gradeType === 'numeric') return null
                      return (
                        <div className="col-span-4">
                          <span className="text-xs text-gray-500 block mb-1">
                            추출 패턴{' '}
                            <Tooltip title="JSON 필드에서 특정 값을 추출할 때 사용하는 정규식 패턴. 예: hours: (\d+)">
                              <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                            </Tooltip>
                          </span>
                          <Form.Item name="extract_pattern" className="!mb-0">
                            <Input size="small" placeholder="정규식 패턴" />
                          </Form.Item>
                        </div>
                      )
                    }}
                  </Form.Item>
                </div>

                {/* 옵션 설정 */}
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">
                      증빙 필수{' '}
                      {!unifiedFieldsSchema.some(f => f.type === 'file') && (
                        <Tooltip title="file 타입 필드가 없어 증빙 불필요로 고정됩니다">
                          <QuestionCircleOutlined className="text-orange-400 cursor-help" />
                        </Tooltip>
                      )}
                    </span>
                    <Form.Item name="proof_required" className="!mb-0">
                      <Select
                        size="small"
                        options={PROOF_REQUIRED_OPTIONS}
                        disabled={!unifiedFieldsSchema.some(f => f.type === 'file')}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">
                      등급 수정 모드{' '}
                      <Tooltip title="프로젝트에서 등급 매핑을 어느 정도까지 수정할 수 있는지 설정합니다. 수정불가: 모두 고정, 점수만: 점수만 변경 가능, 자유수정: 모두 변경 가능">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="grade_edit_mode" className="!mb-0">
                      <Select size="small" options={GRADE_EDIT_MODE_OPTIONS} />
                    </Form.Item>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-500 block mb-1">
                      컨펌 방식{' '}
                      <Tooltip title="자동: 한 프로젝트에서 검증 완료되면 다른 프로젝트에서도 자동 승인. 수동: 각 프로젝트마다 별도 검증 필요.">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="auto_confirm_across_projects" valuePropName="checked" className="!mb-0">
                      <Switch size="small" checkedChildren="자동" unCheckedChildren="수동" />
                    </Form.Item>
                  </div>
                </div>

                {/* 검증 노트 */}
                <div className="mb-3">
                  <span className="text-xs text-gray-500 block mb-1">
                    검증 안내 (검토자용){' '}
                    <Tooltip title="검토자가 증빙 확인 시 참고할 수 있는 안내 문구입니다. 검토 화면에서 표시됩니다.">
                      <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                    </Tooltip>
                  </span>
                  <Form.Item name="verification_note" className="!mb-0">
                    <Input size="small" placeholder="검증 시 참고할 안내 문구 (검토자에게 표시됨)" />
                  </Form.Item>
                </div>

                {/* 등급 매핑 - 등급 유형/평가 방법에 따라 동적 UI */}
                <Form.Item noStyle shouldUpdate={(prev, curr) =>
                  prev.grade_type !== curr.grade_type ||
                  prev.evaluation_method !== curr.evaluation_method
                }>
                  {({ getFieldValue }) => {
                    const gradeType = getFieldValue('grade_type')
                    const evaluationMethod = getFieldValue('evaluation_method')
                    const isNumeric = gradeType === 'numeric'
                    const isString = gradeType === 'string'
                    const isFileExists = gradeType === 'file_exists' || evaluationMethod === 'by_existence'

                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">등급 매핑</span>
                          <Tag color="orange">{unifiedGradeMappings.length}개</Tag>
                        </div>
                        {/* 등급 유형에 따른 안내 메시지 */}
                        <div className="text-xs text-gray-500 mb-2 p-2 bg-gray-100 rounded">
                          {isNumeric ? (
                            <span>📊 <b>숫자</b> 등급: 범위 기준값 입력 (예: 1000 → 1000 이상이면 해당 점수)</span>
                          ) : isString ? (
                            <span>📝 <b>문자열</b> 등급: 매칭할 값 입력 (예: KSC, KPC, PCC 등)</span>
                          ) : isFileExists ? (
                            <span>📎 <b>파일 유무</b> 등급: 증빙파일 첨부 여부로 점수 부여 (있음/없음 고정)</span>
                          ) : (
                            <span>등급 유형을 선택하면 입력 형식이 변경됩니다</span>
                          )}
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {unifiedGradeMappings.map((mapping, index) => (
                            <div key={index} className="flex gap-2 items-center bg-white p-1 rounded">
                              {isFileExists ? (
                                // 파일 유무 등급: 값은 고정, 점수와 레이블만 수정 가능
                                <Tag color={mapping.value === 'true' ? 'green' : 'default'} style={{ width: 100, textAlign: 'center' }}>
                                  {mapping.value === 'true' ? '✓ 있음' : '✗ 없음'}
                                </Tag>
                              ) : isNumeric ? (
                                <InputNumber
                                  size="small"
                                  placeholder="예: 1000"
                                  value={typeof mapping.value === 'number' ? mapping.value : Number(mapping.value) || undefined}
                                  onChange={v => updateUnifiedGradeMapping(index, 'value', v || 0)}
                                  style={{ width: 100 }}
                                />
                              ) : (
                                <Input
                                  size="small"
                                  placeholder={isString ? "예: KSC" : "값"}
                                  value={mapping.value as string}
                                  onChange={e => updateUnifiedGradeMapping(index, 'value', e.target.value)}
                                  style={{ width: 100 }}
                                />
                              )}
                              <InputNumber
                                size="small"
                                placeholder="점수"
                                value={mapping.score}
                                onChange={v => updateUnifiedGradeMapping(index, 'score', v || 0)}
                                style={{ width: 70 }}
                              />
                              <Input
                                size="small"
                                placeholder={isNumeric ? "예: 1000시간 이상" : isString ? "예: KSC자격" : isFileExists ? "레이블" : "레이블 (선택)"}
                                value={mapping.label}
                                onChange={e => updateUnifiedGradeMapping(index, 'label', e.target.value)}
                                style={{ flex: 1 }}
                              />
                              {!isFileExists && (
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => removeUnifiedGradeMapping(index)}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        {!isFileExists && (
                          <Button
                            type="dashed"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={addUnifiedGradeMapping}
                            className="w-full mt-2"
                          >
                            등급 추가
                          </Button>
                        )}
                      </div>
                    )
                  }}
                </Form.Item>
              </div>
            </div>

            {/* 키워드 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">키워드 (자동 매칭)</Text>
              </Divider>
              <div className="flex flex-wrap gap-1 mb-2 min-h-6">
                {unifiedKeywords.map(kw => (
                  <Tag key={kw} closable onClose={() => removeUnifiedKeyword(kw)} className="!m-0">
                    {kw}
                  </Tag>
                ))}
              </div>
              <Input
                size="small"
                placeholder="키워드 입력 후 Enter"
                onPressEnter={(e) => {
                  addUnifiedKeyword(e.currentTarget.value)
                  e.currentTarget.value = ''
                }}
                style={{ width: 180 }}
              />
            </div>

            {/* 저장/취소 버튼 */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                onClick={() => {
                  setIsUnifiedTemplateEditModalOpen(false)
                  setEditingUnifiedTemplate(null)
                  unifiedTemplateEditForm.resetFields()
                  setUnifiedFieldsSchema([])
                  setUnifiedGradeMappings([])
                  setUnifiedKeywords([])
                }}
              >
                취소
              </Button>
              <Button type="primary" htmlType="submit">
                저장
              </Button>
            </div>
          </Form>
        </Modal>

        {/* 템플릿 추가 방식 선택 모달 */}
        <Modal
          title="새 템플릿 추가"
          open={isUnifiedTemplateSelectModalOpen}
          onCancel={() => setIsUnifiedTemplateSelectModalOpen(false)}
          footer={null}
          width={500}
        >
          <div className="py-4">
            <p className="text-gray-600 mb-6">템플릿 추가 방식을 선택해주세요.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setIsUnifiedTemplateSelectModalOpen(false)}>
                취소
              </Button>
              <Button
                type="default"
                onClick={() => {
                  setIsUnifiedTemplateSelectModalOpen(false)
                  // 복제할 템플릿 선택 모달 열기
                  Modal.confirm({
                    title: '복제할 템플릿 선택',
                    width: 600,
                    content: (
                      <div className="max-h-80 overflow-y-auto mt-4">
                        {unifiedTemplates.filter(t => t.is_active).map(template => (
                          <div
                            key={template.template_id}
                            className="p-3 border rounded mb-2 cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                            onClick={() => {
                              Modal.destroyAll()
                              openCloneUnifiedTemplate(template)
                            }}
                          >
                            <div className="font-medium">{template.template_name}</div>
                            <div className="text-xs text-gray-500">{template.template_id}</div>
                            {template.description && (
                              <div className="text-sm text-gray-600 mt-1">{template.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ),
                    okButtonProps: { style: { display: 'none' } },
                    cancelText: '취소'
                  })
                }}
              >
                기존 템플릿 복제
              </Button>
              <Button type="primary" onClick={openCreateNewUnifiedTemplate}>
                신규 생성
              </Button>
            </div>
          </div>
        </Modal>

        {/* 통합 템플릿 생성 모달 */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <PlusOutlined className="text-green-600" />
              <span>새 통합 템플릿 생성</span>
              {cloneSourceTemplate && (
                <Tag color="blue">복제: {cloneSourceTemplate.template_name}</Tag>
              )}
            </div>
          }
          open={isUnifiedTemplateCreateModalOpen}
          maskClosable={false}
          onCancel={() => {
            setIsUnifiedTemplateCreateModalOpen(false)
            setCloneSourceTemplate(null)
            unifiedTemplateCreateForm.resetFields()
            setUnifiedFieldsSchema([])
            setUnifiedGradeMappings([])
            setUnifiedKeywords([])
          }}
          footer={null}
          width={900}
        >
          <Form
            form={unifiedTemplateCreateForm}
            layout="vertical"
            onFinish={handleCreateUnifiedTemplate}
            size="small"
          >
            {/* 기본 정보 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">기본 정보</Text>
              </Divider>
              <div className="grid grid-cols-12 gap-3 mb-2">
                <div className="col-span-4">
                  <Form.Item
                    name="template_id"
                    label="템플릿 ID"
                    rules={[
                      { required: true, message: '템플릿 ID를 입력해주세요' },
                      { pattern: /^[a-z0-9_]+$/, message: '영문 소문자, 숫자, 언더스코어만 사용 가능' }
                    ]}
                    className="!mb-0"
                  >
                    <Input placeholder="예: kca_certification" />
                  </Form.Item>
                </div>
                <div className="col-span-5">
                  <Form.Item
                    name="template_name"
                    label="템플릿명"
                    rules={[{ required: true, message: '템플릿명을 입력해주세요' }]}
                    className="!mb-0"
                  >
                    <Input placeholder="예: KCA 자격증" />
                  </Form.Item>
                </div>
                <div className="col-span-3">
                  <Form.Item name="is_active" label="활성화" valuePropName="checked" className="!mb-0">
                    <Switch checkedChildren="활성" unCheckedChildren="비활성" defaultChecked />
                  </Form.Item>
                </div>
              </div>
              <Form.Item name="description" label="설명" className="!mb-0">
                <Input.TextArea rows={2} placeholder="템플릿에 대한 설명" />
              </Form.Item>
            </div>

            {/* 데이터 소스 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-gray-600 text-sm">📥 데이터 소스</Text>
              </Divider>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">소스 유형</span>
                    <Form.Item name="data_source" className="!mb-0">
                      <Select
                        size="small"
                        options={[
                          { label: '폼 입력', value: 'form_input' },
                          { label: '사용자 프로필', value: 'user_profile' },
                          { label: '중앙 역량 DB', value: 'coach_competency' }
                        ]}
                        onChange={(value) => setUnifiedDataSource(value as DataSourceType)}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">참조 필드</span>
                    <Form.Item name="source_field" className="!mb-0">
                      <Select
                        size="small"
                        allowClear
                        disabled={unifiedDataSource === 'form_input'}
                        placeholder="필드 선택"
                        options={[
                          { label: '이름', value: 'full_name' },
                          { label: '이메일', value: 'email' },
                          { label: '전화번호', value: 'phone' },
                          { label: '소속기관', value: 'organization' },
                          { label: '직위', value: 'position' },
                          { label: '자격증', value: 'certifications' },
                          { label: '코칭연수', value: 'coaching_years' },
                          { label: '전문분야', value: 'specialty' }
                        ]}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">읽기전용</span>
                    <Form.Item name="display_only" valuePropName="checked" className="!mb-0">
                      <Switch size="small" />
                    </Form.Item>
                  </div>
                </div>
              </div>
            </div>

            {/* 입력 설정 섹션 */}
            {unifiedDataSource === 'form_input' && (
              <div className="mb-4">
                <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                  <Text strong className="text-gray-600 text-sm">📝 입력 설정</Text>
                </Divider>
                <div className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="grid grid-cols-12 gap-2 mb-3">
                    <div className="col-span-2">
                      <Form.Item name="layout_type" className="!mb-0">
                        <Select
                          size="small"
                          options={[
                            { label: '세로', value: 'vertical' },
                            { label: '가로', value: 'horizontal' },
                            { label: '그리드', value: 'grid' }
                          ]}
                        />
                      </Form.Item>
                    </div>
                    <div className="col-span-2">
                      <Form.Item name="is_repeatable" valuePropName="checked" className="!mb-0">
                        <Switch size="small" checkedChildren="다중입력" unCheckedChildren="단일" />
                      </Form.Item>
                    </div>
                    <div className="col-span-2">
                      <Form.Item name="max_entries" className="!mb-0">
                        <Input size="small" placeholder="최대 개수" />
                      </Form.Item>
                    </div>
                    <div className="col-span-6">
                      <Form.Item name="help_text" className="!mb-0">
                        <Input size="small" placeholder="도움말 텍스트" />
                      </Form.Item>
                    </div>
                  </div>
                  {/* 필드 스키마 */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">필드 스키마</span>
                      <Tag color="green">{unifiedFieldsSchema.length}개</Tag>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {unifiedFieldsSchema.map((field, index) => (
                        <div key={index} className="flex gap-2 items-center bg-white p-1 rounded">
                          <Input
                            size="small"
                            placeholder="필드명"
                            value={field.name}
                            onChange={e => updateUnifiedFieldSchema(index, 'name', e.target.value)}
                            style={{ width: 80 }}
                          />
                          <Select
                            size="small"
                            value={field.type}
                            onChange={v => updateUnifiedFieldSchema(index, 'type', v)}
                            options={FIELD_TYPE_OPTIONS}
                            style={{ width: 80 }}
                          />
                          <Input
                            size="small"
                            placeholder="라벨"
                            value={field.label}
                            onChange={e => updateUnifiedFieldSchema(index, 'label', e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <Switch
                            size="small"
                            checked={field.required}
                            onChange={v => updateUnifiedFieldSchema(index, 'required', v)}
                            checkedChildren="필수"
                            unCheckedChildren="선택"
                          />
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeUnifiedFieldSchema(index)} />
                        </div>
                      ))}
                    </div>
                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addUnifiedFieldSchema} className="w-full mt-2">
                      필드 추가
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 평가 설정 섹션 */}
            <div className="mb-4">
              <Divider orientation="left" orientationMargin={0} className="!mt-0 !mb-3">
                <Text strong className="text-blue-600 text-sm">📊 평가 설정</Text>
              </Divider>
              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">평가 방법</span>
                    <Form.Item name="evaluation_method" className="!mb-0">
                      <Select
                        size="small"
                        options={[
                          { label: '일반 평가', value: 'standard' },
                          { label: '이름으로 평가', value: 'by_name' },
                          { label: '유무로 평가', value: 'by_existence' }
                        ]}
                        onChange={(value) => {
                          if (value === 'by_existence') {
                            unifiedTemplateCreateForm.setFieldsValue({
                              grade_type: 'file_exists',
                              matching_type: 'exact',
                              grade_edit_mode: 'fixed'
                            })
                            setUnifiedGradeMappings([
                              { value: 'true', score: 20, label: '유자격' },
                              { value: 'false', score: 0, label: '무자격' }
                            ])
                          } else if (value === 'by_name') {
                            unifiedTemplateCreateForm.setFieldsValue({
                              grade_type: 'string',
                              matching_type: 'contains',
                              grade_edit_mode: 'flexible'
                            })
                          }
                        }}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">
                      등급 유형{' '}
                      <Tooltip title="비교할 원본 값의 데이터 타입. 문자열: 텍스트 값 매칭(자격증명 등), 숫자: 범위 비교(시간, 점수), 파일유무: 첨부 여부, 복수선택: 선택 항목 매칭">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="grade_type" className="!mb-0">
                      <Select size="small" allowClear placeholder="선택" options={GRADE_TYPE_OPTIONS} />
                    </Form.Item>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">매칭 방식</span>
                    <Form.Item name="matching_type" className="!mb-0">
                      <Select size="small" allowClear placeholder="선택" options={MATCHING_TYPE_OPTIONS} />
                    </Form.Item>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">
                      집계 방식{' '}
                      <Tooltip title="복수 입력 시 점수 계산 방법. 첫번째: 첫 값만, 합계: 모든 점수 합산, 최대값: 숫자 중 가장 큰 값, 최고점수: 각 값의 점수 중 가장 높은 점수, 개수: 입력 개수로 점수">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="aggregation_mode" className="!mb-0">
                      <Select size="small" options={AGGREGATION_MODE_OPTIONS} />
                    </Form.Item>
                  </div>
                </div>

                {/* 값 소스 설정 */}
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">값 소스</span>
                    <Form.Item name="scoring_value_source" className="!mb-0">
                      <Select
                        size="small"
                        allowClear
                        placeholder="선택"
                        options={VALUE_SOURCE_OPTIONS}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">소스 필드</span>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.grade_type !== curr.grade_type}>
                      {({ getFieldValue }) => {
                        const gradeType = getFieldValue('grade_type')

                        // 등급 유형에 따라 선택 가능한 필드 타입 결정
                        let matchingFields: typeof unifiedFieldsSchema = []
                        let placeholder = '필드 선택'

                        if (gradeType === 'numeric') {
                          matchingFields = unifiedFieldsSchema.filter(f => f.type === 'number')
                          placeholder = '숫자 필드 선택'
                        } else if (gradeType === 'string') {
                          matchingFields = unifiedFieldsSchema.filter(f =>
                            ['text', 'select', 'textarea'].includes(f.type)
                          )
                          placeholder = '문자열 필드 선택'
                        } else if (gradeType === 'file_exists') {
                          matchingFields = unifiedFieldsSchema.filter(f => f.type === 'file')
                          placeholder = '파일 필드 선택'
                        } else if (gradeType === 'multi_select') {
                          matchingFields = unifiedFieldsSchema.filter(f =>
                            ['select', 'multiselect'].includes(f.type)
                          )
                          placeholder = '선택 필드 선택'
                        }

                        if (matchingFields.length > 0) {
                          return (
                            <Form.Item name="scoring_source_field" className="!mb-0">
                              <Select
                                size="small"
                                allowClear
                                placeholder={placeholder}
                                options={matchingFields.map(f => ({
                                  label: f.label || f.name,
                                  value: f.name
                                }))}
                              />
                            </Form.Item>
                          )
                        }

                        // 필드가 없거나 등급 유형이 지정되지 않은 경우 수동 입력
                        return (
                          <Form.Item name="scoring_source_field" className="!mb-0">
                            <Input size="small" placeholder="필드명 직접 입력" />
                          </Form.Item>
                        )
                      }}
                    </Form.Item>
                  </div>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.grade_type !== curr.grade_type}>
                    {({ getFieldValue }) => {
                      const gradeType = getFieldValue('grade_type')
                      // 숫자 타입이고 소스필드를 직접 선택한 경우 추출 패턴은 불필요
                      if (gradeType === 'numeric') return null
                      return (
                        <div className="col-span-4">
                          <span className="text-xs text-gray-500 block mb-1">
                            추출 패턴{' '}
                            <Tooltip title="JSON 필드에서 특정 값을 추출할 때 사용하는 정규식 패턴">
                              <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                            </Tooltip>
                          </span>
                          <Form.Item name="extract_pattern" className="!mb-0">
                            <Input size="small" placeholder="정규식 패턴" />
                          </Form.Item>
                        </div>
                      )
                    }}
                  </Form.Item>
                </div>

                {/* 등급 매핑 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">등급 매핑</span>
                    <Tag color="orange">{unifiedGradeMappings.length}개</Tag>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {unifiedGradeMappings.map((mapping, index) => (
                      <div key={index} className="flex gap-2 items-center bg-white p-1 rounded">
                        <Input
                          size="small"
                          placeholder="값"
                          value={mapping.value as string}
                          onChange={e => updateUnifiedGradeMapping(index, 'value', e.target.value)}
                          style={{ width: 100 }}
                        />
                        <InputNumber
                          size="small"
                          placeholder="점수"
                          value={mapping.score}
                          onChange={v => updateUnifiedGradeMapping(index, 'score', v || 0)}
                          style={{ width: 70 }}
                        />
                        <Input
                          size="small"
                          placeholder="레이블"
                          value={mapping.label}
                          onChange={e => updateUnifiedGradeMapping(index, 'label', e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeUnifiedGradeMapping(index)} />
                      </div>
                    ))}
                  </div>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addUnifiedGradeMapping} className="w-full mt-2">
                    등급 추가
                  </Button>
                </div>

                {/* 기타 설정 */}
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500 block mb-1">
                      증빙 필수{' '}
                      {!unifiedFieldsSchema.some(f => f.type === 'file') && (
                        <Tooltip title="file 타입 필드가 없어 증빙 불필요로 고정됩니다">
                          <QuestionCircleOutlined className="text-orange-400 cursor-help" />
                        </Tooltip>
                      )}
                    </span>
                    <Form.Item name="proof_required" className="!mb-0">
                      <Select
                        size="small"
                        options={PROOF_REQUIRED_OPTIONS}
                        disabled={!unifiedFieldsSchema.some(f => f.type === 'file')}
                      />
                    </Form.Item>
                  </div>
                  <div className="col-span-4">
                    <span className="text-xs text-gray-500 block mb-1">
                      등급 수정 모드{' '}
                      <Tooltip title="프로젝트에서 등급 매핑을 어느 정도까지 수정할 수 있는지 설정합니다. 수정불가: 모두 고정, 점수만: 점수만 변경 가능, 자유수정: 모두 변경 가능">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="grade_edit_mode" className="!mb-0">
                      <Select size="small" options={GRADE_EDIT_MODE_OPTIONS} />
                    </Form.Item>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-500 block mb-1">
                      컨펌 방식{' '}
                      <Tooltip title="자동: 한 프로젝트에서 검증 완료되면 다른 프로젝트에서도 자동 승인. 수동: 각 프로젝트마다 별도 검증 필요.">
                        <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                      </Tooltip>
                    </span>
                    <Form.Item name="auto_confirm_across_projects" valuePropName="checked" className="!mb-0">
                      <Switch size="small" checkedChildren="자동" unCheckedChildren="수동" />
                    </Form.Item>
                  </div>
                </div>

                {/* 검증 안내 */}
                <div className="mb-3">
                  <span className="text-xs text-gray-500 block mb-1">
                    검증 안내 (검토자용){' '}
                    <Tooltip title="검토자가 증빙 확인 시 참고할 수 있는 안내 문구입니다. 검토 화면에서 표시됩니다.">
                      <QuestionCircleOutlined className="text-blue-400 cursor-help" />
                    </Tooltip>
                  </span>
                  <Form.Item name="verification_note" className="!mb-0">
                    <Input size="small" placeholder="검증 시 참고할 안내 문구 (검토자에게 표시됨)" />
                  </Form.Item>
                </div>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                onClick={() => {
                  setIsUnifiedTemplateCreateModalOpen(false)
                  setCloneSourceTemplate(null)
                  unifiedTemplateCreateForm.resetFields()
                  setUnifiedFieldsSchema([])
                  setUnifiedGradeMappings([])
                  setUnifiedKeywords([])
                }}
              >
                취소
              </Button>
              <Button type="primary" htmlType="submit">
                생성
              </Button>
            </div>
          </Form>
        </Modal>
    </div>
  )
}
