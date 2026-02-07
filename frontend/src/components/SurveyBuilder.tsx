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
  Radio,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  LockOutlined
} from '@ant-design/icons'
import projectService, {
  CompetencyItem,
  CustomQuestion,
  ItemTemplate,
  ProofRequiredLevel,
  CompetencyItemCreate,
  ScoringCriteriaCreate,
  MatchingType,
  ValueSourceType,
  AggregationMode
} from '../services/projectService'
import SurveyPreview from './SurveyPreview'
import GradeConfigModal from './scoring/GradeConfigModal'
import {
  ScoringConfig,
  MatchingType as MTUpper,
  GradeType,
  ValueSource,
  AggregationMode as AggUpper
} from '../types/scoring'
import { criteriaCreateToScoringConfig, scoringConfigToCriteriaCreate } from '../utils/scoringHelpers'
import { useAuthStore } from '../stores/authStore'
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

const { Text } = Typography
const { Panel } = Collapse

// 기본항목 정의 (배점 없음, 포함/불포함만 설정)
const BASIC_PROFILE_ITEMS = [
  { id: 'name', name: '이름' },
  { id: 'phone', name: '전화번호' },
  { id: 'birth_year', name: '생년' },
  { id: 'gender', name: '성별' },
  { id: 'address', name: '주소 (시/군/구)' },
  { id: 'coach_certification_number', name: '코치 자격증 번호' },
  { id: 'organization', name: '소속' },
  { id: 'in_person_coaching_area', name: '대면코칭 가능지역' },
  { id: 'coaching_fields', name: '코칭분야' },
  { id: 'introduction', name: '자기소개' }
]

const BASIC_APPLICATION_ITEMS = [
  { id: 'applied_role', name: '신청역할' },
  { id: 'motivation', name: '지원동기 및 기여점' }
]

// 등급별 배점 기본 템플릿 (항목 유형에 따라 자동 설정)
interface GradeTemplateConfig {
  type: 'string' | 'numeric'
  value_source: ValueSourceType
  source_field?: string
  extract_pattern?: string
  grades: Array<{ value?: string; min?: number; max?: number; score: number }>
  description: string  // 한글 설명
}

const GRADE_TEMPLATES: Record<string, GradeTemplateConfig> = {
  // 인증등급 (KSC/KPC/KAC) - 인증번호 앞 3자리로 판별
  'BASIC_CERT_LEVEL': {
    type: 'string',
    value_source: ValueSourceType.USER_FIELD,
    source_field: 'coach_certification_number',
    extract_pattern: '^(.{3})',  // 앞 3글자 추출
    grades: [
      { value: 'KSC', score: 10 },
      { value: 'KPC', score: 5 },
      { value: 'KAC', score: 1 }
    ],
    description: '회원 인증번호 앞 3자리(KSC/KPC/KAC)로 자동 판별'
  },

  // 학위 (degree 템플릿)
  'degree': {
    type: 'string',
    value_source: ValueSourceType.JSON_FIELD,
    source_field: 'degree_level',
    grades: [
      { value: '박사', score: 10 },
      { value: '박사수료', score: 7 },
      { value: '석사', score: 5 },
      { value: '학사', score: 3 }
    ],
    description: '학력 선택값(degree_level)으로 자동 판별'
  },

  // 숫자 범위 - 기본 템플릿
  'number': {
    type: 'numeric',
    value_source: ValueSourceType.SUBMITTED,
    grades: [
      { min: 1000, score: 10 },
      { min: 500, max: 999, score: 5 },
      { max: 499, score: 1 }
    ],
    description: '입력된 숫자값으로 판별 (예: 코칭시간)'
  },

  // 경력 연차
  'career_years': {
    type: 'numeric',
    value_source: ValueSourceType.SUBMITTED,
    grades: [
      { min: 10, score: 10 },
      { min: 5, max: 9, score: 5 },
      { max: 4, score: 1 }
    ],
    description: '경력 연차로 판별'
  }
}

// 항목 템플릿에 따른 등급 템플릿 매핑
function getGradeTemplate(item: CompetencyItem): GradeTemplateConfig | null {
  // Phase 4/5: CompetencyItem의 grade_type + grade_mappings 우선 사용
  if (item.has_scoring && item.grade_type && item.grade_mappings) {
    try {
      const mappings = typeof item.grade_mappings === 'string'
        ? JSON.parse(item.grade_mappings) : item.grade_mappings
      if (Array.isArray(mappings) && mappings.length > 0) {
        // value_source 변환: 소문자 DB값 → 대문자 enum값
        let valueSource = ValueSourceType.SUBMITTED
        if (item.scoring_value_source === 'user_field') valueSource = ValueSourceType.USER_FIELD
        else if (item.scoring_value_source === 'json_field') valueSource = ValueSourceType.JSON_FIELD

        return {
          type: (item.grade_type === 'numeric' ? 'numeric' : 'string') as 'string' | 'numeric',
          value_source: valueSource,
          source_field: item.scoring_source_field || undefined,
          extract_pattern: item.extract_pattern || undefined,
          grades: mappings,
          description: item.description || ''
        }
      }
    } catch {
      // JSON 파싱 실패 시 fallback
    }
  }

  // Legacy: 항목 템플릿으로 매핑
  if (item.template) {
    const templateKey = item.template.toLowerCase()
    if (GRADE_TEMPLATES[templateKey]) {
      return GRADE_TEMPLATES[templateKey]
    }
  }

  // 항목 코드로 매핑 (BASIC_CERT_LEVEL 등)
  if (item.item_code && GRADE_TEMPLATES[item.item_code]) {
    return GRADE_TEMPLATES[item.item_code]
  }

  // 기본: null (수동 설정)
  return null
}

interface SurveyBuilderProps {
  projectId: number
  visible?: boolean
  onClose?: () => void
  onSave: () => void
  embedded?: boolean  // true면 모달 없이 직접 렌더링
  projectStatus?: string  // 프로젝트 상태 (draft, pending, approved, etc.)
}

interface ItemSelection {
  item: CompetencyItem
  included: boolean
  is_required: boolean  // 입력 필수 여부
  score: number | null
  proof_required_level: ProofRequiredLevel
  scoring_criteria: ScoringCriteriaCreate[]  // 배점 기준 (GRADE 타입 지원)
}

interface GroupedItems {
  [category: string]: ItemSelection[]
}

export default function SurveyBuilder({ projectId, visible = true, onClose, onSave, embedded = false, projectStatus }: SurveyBuilderProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allItems, setAllItems] = useState<CompetencyItem[]>([])
  const [selections, setSelections] = useState<Map<number, ItemSelection>>(new Map())
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const initialSelectionsRef = useRef<string>('')

  // 기본항목 포함 상태 (기본값: 모두 true)
  const [basicProfileIncluded, setBasicProfileIncluded] = useState<Record<string, boolean>>(
    () => BASIC_PROFILE_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: true }), {})
  )
  const [basicApplicationIncluded, setBasicApplicationIncluded] = useState<Record<string, boolean>>(
    () => BASIC_APPLICATION_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: true }), {})
  )

  // 커스텀 질문 생성 모달
  const [showCustomQuestionModal, setShowCustomQuestionModal] = useState(false)
  const [customQuestionForm] = Form.useForm()
  const [creatingCustom, setCreatingCustom] = useState(false)

  // 등급 배점 설정 모달
  const [gradeConfigItemId, setGradeConfigItemId] = useState<number | null>(null)
  const [gradeModalConfig, setGradeModalConfig] = useState<ScoringConfig | undefined>()
  const { user } = useAuthStore()

  useEffect(() => {
    if (visible || embedded) {
      loadData()
      setHasChanges(false)
    }
  }, [visible, projectId, embedded])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all competency items and filter out user profile items (personal info is from registration)
      const USER_PROFILE_ITEM_CODES = [
        'BASIC_NAME', 'BASIC_PHONE', 'BASIC_EMAIL', 'BASIC_ADDRESS',
        'BASIC_GENDER', 'BASIC_BIRTHDATE', 'DETAIL_COACHING_AREA', 'DETAIL_CERT_NUMBER'
      ]
      const allItemsFromApi = await projectService.getCompetencyItems(true)
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
        // 기존 scoring_criteria 로드 (GRADE 배점 지원)
        const existingCriteria: ScoringCriteriaCreate[] = existing?.scoring_criteria?.map(c => ({
          matching_type: c.matching_type,
          expected_value: c.expected_value,
          score: Number(c.score) || 0,
          value_source: c.value_source || ValueSourceType.SUBMITTED,
          source_field: c.source_field || null,
          extract_pattern: c.extract_pattern || null,
          aggregation_mode: c.aggregation_mode || AggregationMode.ANY_MATCH
        })) || []
        newSelections.set(item.item_id, {
          item,
          included: existing ? true : defaultIncluded,
          is_required: existing?.is_required ?? true,  // 기본값: 필수
          score: existing?.max_score ?? null,
          proof_required_level: existing?.proof_required_level || ProofRequiredLevel.OPTIONAL,
          scoring_criteria: existingCriteria
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
  // EXPERIENCE → 코칭경력, OTHER → 기타 (커스텀 항목 전용)
  const CATEGORY_GROUP_MAP: Record<string, string> = {
    'BASIC': '기본정보',
    'CERTIFICATION': '자격증',
    'EDUCATION': '학력',
    'EXPERIENCE': '코칭경력',
    'OTHER': '기타',          // OTHER → 기타 (커스텀 항목 전용)
    // Legacy 카테고리 호환
    'DETAIL': '코칭경력',     // DETAIL → 코칭경력으로 매핑
    'ADDON': '코칭경력',      // ADDON → 코칭경력으로 변경
    'COACHING': '코칭경력',   // COACHING → 코칭경력으로 매핑
    'EVALUATION': '코칭경력', // EVALUATION → 코칭경력으로 매핑
    'INFO': '기본정보'        // INFO → 기본정보로 매핑
  }

  // 그룹 우선순위 (저장 시 display_order 결정에 사용)
  const GROUP_PRIORITY: Record<string, number> = {
    '기본정보': 1,
    '자격증': 2,
    '학력': 3,
    '코칭연수': 4,
    '코칭경력': 5,
    '기타': 6
  }

  // 그룹 우선순위 반환 (카테고리 기반)
  const getGroupPriority = (category: string, isCustom: boolean): number => {
    if (isCustom && category === 'OTHER') return 6  // 커스텀 + OTHER 카테고리는 기타 그룹
    const groupName = CATEGORY_GROUP_MAP[category] || '코칭경력'
    return GROUP_PRIORITY[groupName] || 5
  }

  const groupItemsByCategory = (): GroupedItems => {
    const grouped: GroupedItems = {
      '자격증': [],
      '학력': [],
      '코칭연수': [],
      '코칭경력': [],
      '기타': []
    }

    selections.forEach(selection => {
      const category = selection.item.category || 'EXPERIENCE'
      const itemCode = selection.item.item_code || ''
      const template = selection.item.template || ''

      // EXP_COACHING_TRAINING 또는 coaching_time 템플릿은 '코칭연수' 그룹으로
      if (itemCode === 'EXP_COACHING_TRAINING' || template === 'coaching_time') {
        grouped['코칭연수'].push(selection)
        return
      }

      // 커스텀 항목은 category에 따라 그룹 결정
      if (selection.item.is_custom) {
        if (category === 'OTHER') {
          grouped['기타'].push(selection)
        } else {
          // 코칭경력(EXPERIENCE) 커스텀 항목
          grouped['코칭경력'].push(selection)
        }
        return
      }

      // 카테고리에 따라 그룹 결정
      const groupName = CATEGORY_GROUP_MAP[category] || '코칭경력'

      // 기본정보(BASIC)는 User 테이블에서 직접 표시하므로 설문에서 제외
      if (groupName === '기본정보') {
        return
      }

      if (grouped[groupName]) {
        grouped[groupName].push(selection)
      } else {
        grouped['코칭경력'].push(selection)  // 매핑되지 않은 카테고리는 코칭경력으로
      }
    })

    // 코칭경력 그룹 내 정렬: '누적 코칭 시간'(EXP_COACHING_HOURS)이 먼저 나오도록
    grouped['코칭경력'].sort((a, b) => {
      const codeA = a.item.item_code || ''
      const codeB = b.item.item_code || ''
      // EXP_COACHING_HOURS를 최우선으로
      if (codeA === 'EXP_COACHING_HOURS') return -1
      if (codeB === 'EXP_COACHING_HOURS') return 1
      // 커스텀 항목은 뒤로
      if (a.item.is_custom && !b.item.is_custom) return 1
      if (!a.item.is_custom && b.item.is_custom) return -1
      return 0
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
            scoring_criteria: selection.scoring_criteria || []  // GRADE 배점 기준 포함
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

  // GradeConfigModal에서 OK 시 ScoringConfig → ScoringCriteriaCreate[] 변환 후 저장
  const handleGradeConfigOk = (config: ScoringConfig) => {
    if (!gradeConfigItemId) return
    const { criteria, maxScore } = scoringConfigToCriteriaCreate(config)
    const currentSelection = selections.get(gradeConfigItemId)
    if (currentSelection) {
      const otherCriteria = currentSelection.scoring_criteria.filter(
        c => c.matching_type !== MatchingType.GRADE
      )
      updateSelection(gradeConfigItemId, {
        scoring_criteria: [...otherCriteria, ...criteria],
        score: maxScore > 0 ? maxScore : currentSelection.score
      })
    }
    setGradeConfigItemId(null)
    setGradeModalConfig(undefined)
    message.success(`등급 배점이 설정되었습니다. (배점: ${maxScore}점)`)
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

    // 100점 검증: draft 상태는 경고만, pending 이상은 차단
    if (totalScore !== 100) {
      const isDraft = !projectStatus || projectStatus === 'draft'

      if (isDraft) {
        // Draft 상태: 경고만 표시하고 저장 허용
        Modal.warning({
          title: '배점 확인',
          content: (
            <div>
              <p>현재 총 배점: <strong>{totalScore}점</strong></p>
              <p>과제 승인 요청을 하려면 총 배점이 100점이어야 합니다.</p>
              <p>임시저장은 가능하지만, 나중에 100점으로 조정해주세요.</p>
            </div>
          ),
          okText: '확인'
        })
        // 계속 진행 (저장 허용)
      } else {
        // Pending 이상: 저장 차단
        message.error(`총 배점이 100점이 아닙니다. 현재: ${totalScore}점`)
        return
      }
    }

    setLoading(true)
    let saveSucceeded = false
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
          scoring_criteria: selection.scoring_criteria || []  // GRADE 배점 기준 포함
        }

        if (existing) {
          await projectService.updateProjectItem(projectId, existing.project_item_id, itemData)
        } else {
          await projectService.addProjectItem(projectId, itemData)
        }
      }

      // 저장 성공
      saveSucceeded = true
      message.success('설문 구성이 저장되었습니다.')
      setHasChanges(false)
    } catch (error: any) {
      console.error('저장 실패:', error?.response?.data || error?.message || error)
      message.error(error?.response?.data?.detail || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }

    // 저장 성공 시에만 콜백 호출 (에러가 발생해도 저장 성공 메시지 유지)
    if (saveSucceeded) {
      try {
        onSave()
        onClose?.()
      } catch (callbackError) {
        console.warn('저장 후 콜백 처리 중 오류 (무시됨):', callbackError)
      }
    }
  }

  // 전역 이벤트 리스너 (ProjectUnifiedPage에서 트리거)
  useEffect(() => {
    if (!embedded) return

    const handlePreviewEvent = () => setShowPreview(true)
    const handleSaveEvent = () => handleSave()

    window.addEventListener('projectSurveyPreview', handlePreviewEvent)
    window.addEventListener('projectSurveySave', handleSaveEvent)

    return () => {
      window.removeEventListener('projectSurveyPreview', handlePreviewEvent)
      window.removeEventListener('projectSurveySave', handleSaveEvent)
    }
  }, [embedded, handleSave])

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
          onClose?.()
        }
      })
    } else {
      onClose?.()
    }
  }

  // 템플릿에 맞는 필드 구조 생성
  const getFieldsForTemplate = (template: string, itemName: string, values: any) => {
    switch (template) {
      case ItemTemplate.COACHING_TIME:
        // 코칭연수: 내용 + 연도 + 시간 + 증빙
        return [
          { field_name: 'description', field_label: '연수명/내용', field_type: 'text', is_required: true, display_order: 0, placeholder: '예: 한국한부모협회 주관' },
          { field_name: 'year', field_label: '이수연도', field_type: 'number', is_required: true, display_order: 1, placeholder: '예: 2024' },
          { field_name: 'hours', field_label: '이수시간', field_type: 'number', is_required: true, display_order: 2, placeholder: '예: 12' },
          { field_name: 'proof', field_label: '증빙서류', field_type: 'file', is_required: false, display_order: 3 }
        ]
      case ItemTemplate.COACHING_EXPERIENCE:
        // 코칭경력: 기관명 + 연도 + 시간 + 증빙
        return [
          { field_name: 'org_name', field_label: '코칭과제/기관명', field_type: 'text', is_required: true, display_order: 0, placeholder: '예: 청년재단 코칭사업' },
          { field_name: 'year', field_label: '연도', field_type: 'number', is_required: true, display_order: 1, placeholder: '예: 2024' },
          { field_name: 'hours', field_label: '코칭시간', field_type: 'number', is_required: true, display_order: 2, placeholder: '예: 50' },
          { field_name: 'proof', field_label: '증빙서류', field_type: 'file', is_required: false, display_order: 3 }
        ]
      case ItemTemplate.SELECT:
      case ItemTemplate.MULTISELECT:
        return [{
          field_name: 'value',
          field_label: itemName,
          field_type: template,
          field_options: values.field_options ? JSON.stringify(values.field_options.split('\n').filter((o: string) => o.trim())) : null,
          is_required: true,
          display_order: 0
        }]
      case ItemTemplate.TEXT_FILE:
        return [
          { field_name: 'text', field_label: itemName, field_type: 'text', is_required: true, display_order: 0, placeholder: values.placeholder || null },
          { field_name: 'proof', field_label: '증빙자료', field_type: 'file', is_required: false, display_order: 1 }
        ]
      default:
        return [{
          field_name: 'value',
          field_label: itemName,
          field_type: template || 'text',
          field_options: values.field_options ? JSON.stringify(values.field_options.split('\n').filter((o: string) => o.trim())) : null,
          is_required: true,
          display_order: 0,
          placeholder: values.placeholder || null
        }]
    }
  }

  // 항목 추가 핸들러
  const handleCreateCustomQuestion = async (values: any) => {
    setCreatingCustom(true)
    try {
      const template = values.template || ItemTemplate.TEXT
      const fields = getFieldsForTemplate(template, values.item_name, values)
      // 선택한 그룹에 따라 category 설정 (EXPERIENCE: 코칭경력, OTHER: 기타)
      const category = values.target_category || 'EXPERIENCE'

      const createData: CompetencyItemCreate = {
        item_name: values.item_name,
        category: category,  // EXPERIENCE(코칭경력) 또는 OTHER(기타)
        input_type: 'text',  // Deprecated but required
        template: template,
        template_config: values.field_options ? JSON.stringify({ options: values.field_options.split('\n').filter((o: string) => o.trim()) }) : null,
        is_repeatable: values.is_repeatable || false,
        max_entries: values.max_entries || null,
        description: values.description || null,
        is_custom: true,
        fields: fields
      }

      const newItem = await projectService.createCustomCompetencyItem(createData)

      // 새 항목을 selections에 추가
      const newSelections = new Map(selections)
      newSelections.set(newItem.item_id, {
        item: newItem,
        included: true,
        is_required: true,
        score: null,
        proof_required_level: ProofRequiredLevel.OPTIONAL,  // 기본값: 증빙선택
        scoring_criteria: []
      })
      setSelections(newSelections)
      setAllItems([...allItems, newItem])

      message.success('항목이 추가되었습니다.')
      setShowCustomQuestionModal(false)
      customQuestionForm.resetFields()
      setHasChanges(true)
      autoSaveDebounced(newSelections)
    } catch (error: any) {
      console.error('항목 추가 실패:', error)
      message.error(error.response?.data?.detail || '항목 추가에 실패했습니다.')
    } finally {
      setCreatingCustom(false)
    }
  }

  const grouped = groupItemsByCategory()
  const totalScore = calculateTotalScore()
  const isValid = totalScore === 100

  // 설문 구성 내용 (모달/탭 공통)
  const surveyContent = (
    <>
      {/* 설문 항목 안내 */}
      <Alert
        type="info"
        message="모집 시 응모자가 입력할 항목을 정의합니다."
        style={{ marginBottom: 16 }}
        showIcon
      />

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
        {/* 기본항목 - 프로필 */}
        <Card size="small">
          <div className="flex items-center gap-2 mb-3">
            <Text strong>기본항목 (프로필)</Text>
            <Tag color="blue">배점 없음</Tag>
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {BASIC_PROFILE_ITEMS.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-1">
                <Switch
                  checked={basicProfileIncluded[item.id]}
                  onChange={(checked) => setBasicProfileIncluded(prev => ({ ...prev, [item.id]: checked }))}
                  checkedChildren="포함"
                  unCheckedChildren="불포함"
                />
                <Text>{item.name}</Text>
              </div>
            ))}
          </Space>
        </Card>

        {/* 기본항목 - 신청서 */}
        <Card size="small">
          <div className="flex items-center gap-2 mb-3">
            <Text strong>기본항목 (신청서)</Text>
            <Tag color="blue">배점 없음</Tag>
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {BASIC_APPLICATION_ITEMS.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-1">
                <Switch
                  checked={basicApplicationIncluded[item.id]}
                  onChange={(checked) => setBasicApplicationIncluded(prev => ({ ...prev, [item.id]: checked }))}
                  checkedChildren="포함"
                  unCheckedChildren="불포함"
                />
                <Text>{item.name}</Text>
              </div>
            ))}
          </Space>
        </Card>

        {/* Item Groups */}
        <Collapse defaultActiveKey={['자격증', '학력', '코칭연수', '코칭경력', '기타']}>
          {Object.entries(grouped).map(([category, items]) => {
            // '기타'와 '코칭경력' 그룹은 항목이 없어도 표시 (+ 추가 버튼이 있으므로)
            const showEmptyGroup = category === '기타' || category === '코칭경력'
            if (items.length === 0 && !showEmptyGroup) return null

            return (
              <Panel
                key={category}
                header={
                  <Space>
                    <Text strong>{category}</Text>
                    {(category === '기타' || category === '코칭경력') && items.filter(i => i.item.is_custom).length > 0 && (
                      <Tag color="purple">{items.filter(i => i.item.is_custom).length}개 커스텀</Tag>
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
                              onChange={(checked) => {
                                const updates: Partial<ItemSelection> = { included: checked }
                                // 포함 시 템플릿 설정 자동 로드
                                if (checked && (!selection.scoring_criteria || selection.scoring_criteria.length === 0)) {
                                  const item = selection.item
                                  if (item.has_scoring && item.grade_type && item.grade_mappings) {
                                    const template = getGradeTemplate(item)
                                    if (template) {
                                      const vsMap: Record<string, ValueSource> = { 'submitted': ValueSource.SUBMITTED, 'user_field': ValueSource.USER_FIELD, 'json_field': ValueSource.JSON_FIELD, 'SUBMITTED': ValueSource.SUBMITTED, 'USER_FIELD': ValueSource.USER_FIELD, 'JSON_FIELD': ValueSource.JSON_FIELD }
                                      const autoConfig: ScoringConfig = {
                                        itemId: item.item_id,
                                        matchingType: MTUpper.GRADE,
                                        gradeType: template.type === 'numeric' ? GradeType.NUMERIC : GradeType.STRING,
                                        valueSource: vsMap[template.value_source || 'SUBMITTED'] || ValueSource.SUBMITTED,
                                        sourceField: template.source_field,
                                        extractPattern: template.extract_pattern,
                                        aggregationMode: item.is_repeatable ? AggUpper.BEST_MATCH : AggUpper.ANY_MATCH,
                                        gradeMappings: template.grades.map((g: any) => ({
                                          value: g.value ?? '',
                                          score: g.score ?? 0,
                                          ...(g.label ? { label: g.label } : {})
                                        })),
                                        configured: true
                                      }
                                      const { criteria, maxScore } = scoringConfigToCriteriaCreate(autoConfig)
                                      updates.scoring_criteria = criteria
                                      if (maxScore > 0) updates.score = maxScore
                                    }
                                  }
                                }
                                updateSelection(selection.item.item_id, updates)
                              }}
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
                            {selection.item.grade_edit_mode === 'fixed' && (
                              <Tag color="red" icon={<LockOutlined />}>템플릿 고정</Tag>
                            )}
                            {selection.item.grade_edit_mode === 'score_only' && (
                              <Tag color="orange">점수만 수정</Tag>
                            )}
                          </Space>

                          {/* 포함된 항목에 배점 표시 (기본정보는 설문에서 제외됨) */}
                          {selection.included && (
                            <Space>
                              <Text>배점:</Text>
                              {/* GRADE 설정된 항목은 배점 입력 비활성화 (등급 최고점으로 자동 결정) */}
                              {selection.scoring_criteria?.some(c => c.matching_type === MatchingType.GRADE) ? (
                                <Tooltip title="등급설정의 최고점이 배점으로 사용됩니다">
                                  <InputNumber
                                    min={0}
                                    max={100}
                                    value={selection.score || undefined}
                                    disabled
                                    style={{ width: 80, backgroundColor: '#f5f5f5' }}
                                  />
                                </Tooltip>
                              ) : (
                                <InputNumber
                                  min={0}
                                  max={100}
                                  value={selection.score || undefined}
                                  onChange={(value) => updateSelection(selection.item.item_id, { score: value })}
                                  style={{ width: 80 }}
                                  placeholder="점수"
                                />
                              )}
                              <Button
                                type="text"
                                size="small"
                                icon={<SettingOutlined />}
                                onClick={() => {
                                  setGradeConfigItemId(selection.item.item_id)
                                  // 기존 GRADE criteria → ScoringConfig 변환
                                  const gradeCriteria = selection.scoring_criteria?.filter(
                                    c => c.matching_type === MatchingType.GRADE
                                  ) || []
                                  if (gradeCriteria.length > 0) {
                                    const parsed = criteriaCreateToScoringConfig(
                                      selection.item.item_id,
                                      gradeCriteria
                                    )
                                    setGradeModalConfig(parsed || undefined)
                                  } else {
                                    // 템플릿 기본값으로 초기화
                                    const template = getGradeTemplate(selection.item)
                                    if (template) {
                                      const vsMap: Record<string, ValueSource> = { 'submitted': ValueSource.SUBMITTED, 'user_field': ValueSource.USER_FIELD, 'json_field': ValueSource.JSON_FIELD, 'SUBMITTED': ValueSource.SUBMITTED, 'USER_FIELD': ValueSource.USER_FIELD, 'JSON_FIELD': ValueSource.JSON_FIELD }
                                      setGradeModalConfig({
                                        itemId: selection.item.item_id,
                                        matchingType: MTUpper.GRADE,
                                        gradeType: template.type === 'numeric' ? GradeType.NUMERIC : GradeType.STRING,
                                        valueSource: vsMap[template.value_source || 'SUBMITTED'] || ValueSource.SUBMITTED,
                                        sourceField: template.source_field,
                                        extractPattern: template.extract_pattern,
                                        aggregationMode: selection.item.is_repeatable ? AggUpper.BEST_MATCH : AggUpper.ANY_MATCH,
                                        gradeMappings: template.grades.map((g: any) => ({
                                          value: g.value ?? '',
                                          score: g.score ?? 0,
                                          ...(g.label ? { label: g.label } : {})
                                        })),
                                        configured: false
                                      })
                                      message.info(`'${selection.item.item_name}' 항목의 추천 설정이 자동으로 적용되었습니다. 필요시 수정하세요.`)
                                    } else {
                                      setGradeModalConfig(undefined)
                                    }
                                  }
                                }}
                              >
                                {selection.scoring_criteria?.some(c => c.matching_type === MatchingType.GRADE)
                                  ? '등급설정'
                                  : '등급설정'}
                              </Button>
                              {selection.scoring_criteria?.some(c => c.matching_type === MatchingType.GRADE) && (
                                <Tag color="blue">GRADE</Tag>
                              )}
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

                  {/* '코칭경력'과 '기타' 그룹에 항목 추가 버튼 표시 */}
                  {(category === '기타' || category === '코칭경력') && (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      block
                      onClick={() => {
                        // 선택한 그룹에 따라 category와 기본 템플릿 설정
                        customQuestionForm.setFieldsValue({
                          target_category: category === '코칭경력' ? 'EXPERIENCE' : 'OTHER',
                          template: category === '코칭경력' ? ItemTemplate.COACHING_EXPERIENCE : ItemTemplate.TEXT
                        })
                        setShowCustomQuestionModal(true)
                      }}
                    >
                      항목 추가
                    </Button>
                  )}
                </Space>
              </Panel>
            )
          })}
        </Collapse>
      </Space>
    </>
  )

  // embedded 모드: 모달 없이 직접 렌더링
  if (embedded) {
    return (
      <>
        {surveyContent}

        {/* Preview Modal */}
        <SurveyPreview
          projectId={projectId}
          visible={showPreview}
          onClose={() => setShowPreview(false)}
          selections={selections}
          customQuestions={customQuestions}
        />

        {/* Custom Question Creation Modal */}
        <Modal
          title="항목 추가"
          open={showCustomQuestionModal}
          maskClosable={false}
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
              is_repeatable: false,
              target_category: 'EXPERIENCE'
            }}
          >
            <Form.Item
              name="target_category"
              label="추가할 그룹"
              rules={[{ required: true, message: '그룹을 선택해주세요' }]}
            >
              <Select>
                <Select.Option value="EXPERIENCE">코칭경력</Select.Option>
                <Select.Option value="OTHER">기타</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="item_name"
              label="항목 이름"
              rules={[{ required: true, message: '항목 이름을 입력해주세요' }]}
            >
              <Input placeholder="예: 한부모가정 코칭경험" />
            </Form.Item>

            <Form.Item
              name="description"
              label="안내 문구 (선택)"
            >
              <Input.TextArea
                placeholder="응모자에게 보여줄 안내 문구를 입력하세요"
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
                <Select.Option value={ItemTemplate.COACHING_TIME}>코칭연수 (내용 + 연도 + 시간 + 증빙)</Select.Option>
                <Select.Option value={ItemTemplate.COACHING_EXPERIENCE}>코칭경력 (기관명 + 연도 + 시간 + 증빙)</Select.Option>
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

        {/* Grade Configuration Modal - 공유 GradeConfigModal 컴포넌트 사용 */}
        {gradeConfigItemId && (() => {
          const sel = selections.get(gradeConfigItemId)
          const itm = sel?.item
          return itm ? (
            <GradeConfigModal
              visible={true}
              itemId={gradeConfigItemId}
              itemName={itm.item_name}
              maxScore={sel?.score || 0}
              initialConfig={gradeModalConfig}
              onOk={handleGradeConfigOk}
              onCancel={() => { setGradeConfigItemId(null); setGradeModalConfig(undefined) }}
              gradeEditMode={itm.grade_edit_mode as 'fixed' | 'score_only' | 'flexible' | undefined}
              isSuperAdmin={user?.roles?.includes('SUPER_ADMIN')}
            />
          ) : null
        })()}
      </>
    )
  }

  // 모달 모드: 기존 방식
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
          미리보기
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
      {surveyContent}

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
        title="항목 추가"
        open={showCustomQuestionModal}
        maskClosable={false}
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
            is_repeatable: false,
            target_category: 'EXPERIENCE'
          }}
        >
          <Form.Item
            name="target_category"
            label="추가할 그룹"
            rules={[{ required: true, message: '그룹을 선택해주세요' }]}
          >
            <Select>
              <Select.Option value="EXPERIENCE">코칭경력</Select.Option>
              <Select.Option value="OTHER">기타</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="item_name"
            label="항목 이름"
            rules={[{ required: true, message: '항목 이름을 입력해주세요' }]}
          >
            <Input placeholder="예: 한부모가정 코칭경험" />
          </Form.Item>

          <Form.Item
            name="description"
            label="안내 문구 (선택)"
          >
            <Input.TextArea
              placeholder="응모자에게 보여줄 안내 문구를 입력하세요"
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
              <Select.Option value={ItemTemplate.COACHING_TIME}>코칭연수 (내용 + 연도 + 시간 + 증빙)</Select.Option>
              <Select.Option value={ItemTemplate.COACHING_EXPERIENCE}>코칭경력 (기관명 + 연도 + 시간 + 증빙)</Select.Option>
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

      {/* Grade Configuration Modal - 공유 GradeConfigModal 컴포넌트 사용 (모달 모드) */}
      {gradeConfigItemId && (() => {
        const sel = selections.get(gradeConfigItemId)
        const itm = sel?.item
        return itm ? (
          <GradeConfigModal
            visible={true}
            itemId={gradeConfigItemId}
            itemName={itm.item_name}
            maxScore={sel?.score || 0}
            initialConfig={gradeModalConfig}
            onOk={handleGradeConfigOk}
            onCancel={() => { setGradeConfigItemId(null); setGradeModalConfig(undefined) }}
            gradeEditMode={itm.grade_edit_mode as 'fixed' | 'score_only' | 'flexible' | undefined}
            isSuperAdmin={user?.roles?.includes('SUPER_ADMIN')}
          />
        ) : null
      })()}
    </Modal>
  )
}
