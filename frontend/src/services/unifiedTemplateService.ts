/**
 * 통합 템플릿 (UnifiedTemplate) API 서비스
 * 입력 템플릿 + 평가 템플릿 통합
 */
import api from './api'

// 데이터 소스 타입
export type DataSourceType = 'form_input' | 'user_profile' | 'coach_competency'

// 평가 방법 타입 (자격증 특수 케이스)
export type EvaluationMethodType = 'standard' | 'by_name' | 'by_existence'

// 레이아웃 타입
export type LayoutType = 'vertical' | 'horizontal' | 'grid'

// 필드 스키마
export interface FieldSchema {
  name: string
  type: string  // text, number, select, date, file, etc.
  label: string
  required?: boolean
  options?: string[]  // select 타입용
  placeholder?: string
  default_value?: unknown
  validation?: Record<string, unknown>  // min, max, pattern 등
}

// 등급 매핑
export interface GradeMapping {
  value: string | number
  score: number
  label?: string
  fixed?: boolean
}

// 통합 템플릿 응답 타입
export interface UnifiedTemplate {
  template_id: string
  template_name: string
  description?: string

  // 입력 설정
  data_source: DataSourceType
  source_field?: string
  display_only: boolean
  fields_schema: string  // JSON 문자열
  layout_type: LayoutType
  is_repeatable: boolean
  max_entries?: string
  validation_rules?: string  // JSON 문자열
  help_text?: string
  placeholder?: string

  // 평가 설정
  evaluation_method: EvaluationMethodType
  grade_type?: string  // string, numeric, file_exists, multi_select
  matching_type?: string  // exact, contains, range, grade
  scoring_value_source?: string  // submitted, user_field, json_field
  scoring_source_field?: string
  extract_pattern?: string
  aggregation_mode?: string  // first, sum, max, count, any_match, best_match
  default_mappings: string  // JSON 문자열
  fixed_grades: boolean
  allow_add_grades: boolean
  proof_required: string  // not_required, optional, required
  verification_note?: string
  is_required_default: boolean
  allow_multiple: boolean
  auto_confirm_across_projects: boolean

  // 공통
  keywords?: string  // JSON 문자열
  is_active: boolean
  created_at: string
  updated_at?: string

  // 계산된 필드
  has_scoring: boolean
  is_certification: boolean
}

// 통합 템플릿 생성 타입
export interface UnifiedTemplateCreate {
  template_id: string
  template_name: string
  description?: string

  // 입력 설정
  data_source?: DataSourceType
  source_field?: string
  display_only?: boolean
  fields_schema?: string
  layout_type?: LayoutType
  is_repeatable?: boolean
  max_entries?: string
  validation_rules?: string
  help_text?: string
  placeholder?: string

  // 평가 설정
  evaluation_method?: EvaluationMethodType
  grade_type?: string
  matching_type?: string
  scoring_value_source?: string
  scoring_source_field?: string
  extract_pattern?: string
  aggregation_mode?: string
  default_mappings?: string
  fixed_grades?: boolean
  allow_add_grades?: boolean
  proof_required?: string
  verification_note?: string
  is_required_default?: boolean
  allow_multiple?: boolean
  auto_confirm_across_projects?: boolean

  // 공통
  keywords?: string
  is_active?: boolean
}

// 통합 템플릿 수정 타입
export interface UnifiedTemplateUpdate {
  template_name?: string
  description?: string

  // 입력 설정
  data_source?: DataSourceType
  source_field?: string
  display_only?: boolean
  fields_schema?: string
  layout_type?: LayoutType
  is_repeatable?: boolean
  max_entries?: string
  validation_rules?: string
  help_text?: string
  placeholder?: string

  // 평가 설정
  evaluation_method?: EvaluationMethodType
  grade_type?: string
  matching_type?: string
  scoring_value_source?: string
  scoring_source_field?: string
  extract_pattern?: string
  aggregation_mode?: string
  default_mappings?: string
  fixed_grades?: boolean
  allow_add_grades?: boolean
  proof_required?: string
  verification_note?: string
  is_required_default?: boolean
  allow_multiple?: boolean
  auto_confirm_across_projects?: boolean

  // 공통
  keywords?: string
  is_active?: boolean
}

// 통합 템플릿 목록 응답 타입
export interface UnifiedTemplateListResponse {
  templates: UnifiedTemplate[]
  total: number
}

// 실제 적용될 평가 설정
export interface EffectiveScoringConfig {
  grade_type?: string
  matching_type?: string
  default_mappings: GradeMapping[]
  fixed_grades: boolean
  scoring_value_source?: string
  scoring_source_field?: string
  extract_pattern?: string
  aggregation_mode?: string
}

/**
 * 통합 템플릿 API 서비스
 */
const unifiedTemplateService = {
  /**
   * 통합 템플릿 목록 조회
   */
  async getAll(activeOnly: boolean = true): Promise<UnifiedTemplate[]> {
    const response = await api.get<UnifiedTemplateListResponse>('/unified-templates', {
      params: { active_only: activeOnly }
    })
    return response.data.templates
  },

  /**
   * 특정 통합 템플릿 조회
   */
  async getById(templateId: string): Promise<UnifiedTemplate> {
    const response = await api.get<UnifiedTemplate>(`/unified-templates/${templateId}`)
    return response.data
  },

  /**
   * 실제 적용될 평가 설정 조회
   */
  async getEffectiveScoringConfig(
    templateId: string,
    evaluationMethod?: EvaluationMethodType
  ): Promise<EffectiveScoringConfig> {
    const params: Record<string, string> = {}
    if (evaluationMethod) {
      params.evaluation_method = evaluationMethod
    }
    const response = await api.get<EffectiveScoringConfig>(
      `/unified-templates/${templateId}/effective-scoring`,
      { params }
    )
    return response.data
  },

  /**
   * 통합 템플릿 생성
   */
  async create(data: UnifiedTemplateCreate): Promise<UnifiedTemplate> {
    const response = await api.post<UnifiedTemplate>('/unified-templates', data)
    return response.data
  },

  /**
   * 통합 템플릿 수정
   */
  async update(templateId: string, data: UnifiedTemplateUpdate): Promise<UnifiedTemplate> {
    const response = await api.put<UnifiedTemplate>(`/unified-templates/${templateId}`, data)
    return response.data
  },

  /**
   * 통합 템플릿 삭제 (비활성화)
   */
  async delete(templateId: string): Promise<void> {
    await api.delete(`/unified-templates/${templateId}`)
  },

  // =====================
  // 유틸리티 함수
  // =====================

  /**
   * 필드 스키마 파싱 (JSON 문자열 -> 객체 배열)
   */
  parseFieldsSchema(fieldsJson: string): FieldSchema[] {
    try {
      return JSON.parse(fieldsJson)
    } catch {
      return []
    }
  },

  /**
   * 필드 스키마 직렬화 (객체 배열 -> JSON 문자열)
   */
  stringifyFieldsSchema(fields: FieldSchema[]): string {
    return JSON.stringify(fields)
  },

  /**
   * 등급 매핑 파싱 (JSON 문자열 -> 객체 배열)
   */
  parseMappings(mappingsJson: string): GradeMapping[] {
    try {
      return JSON.parse(mappingsJson)
    } catch {
      return []
    }
  },

  /**
   * 등급 매핑 직렬화 (객체 배열 -> JSON 문자열)
   */
  stringifyMappings(mappings: GradeMapping[]): string {
    return JSON.stringify(mappings)
  },

  /**
   * 키워드 파싱 (JSON 문자열 -> 문자열 배열)
   */
  parseKeywords(keywordsJson: string | undefined): string[] {
    if (!keywordsJson) return []
    try {
      return JSON.parse(keywordsJson)
    } catch {
      return []
    }
  },

  /**
   * 키워드 직렬화 (문자열 배열 -> JSON 문자열)
   */
  stringifyKeywords(keywords: string[]): string {
    return JSON.stringify(keywords)
  },

  // =====================
  // 레이블 함수
  // =====================

  /**
   * 데이터 소스 레이블
   */
  getDataSourceLabel(type: DataSourceType): string {
    const labels: Record<DataSourceType, string> = {
      'form_input': '폼 입력',
      'user_profile': '사용자 프로필',
      'coach_competency': '중앙 역량 DB'
    }
    return labels[type] || type
  },

  /**
   * 평가 방법 레이블
   */
  getEvaluationMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'standard': '일반 평가',
      'by_name': '이름으로 평가',
      'by_existence': '유무로 평가'
    }
    return labels[method] || method
  },

  /**
   * 등급 유형 레이블
   */
  getGradeTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'string': '문자열',
      'numeric': '숫자',
      'file_exists': '파일 유무',
      'multi_select': '복수 선택'
    }
    return labels[type] || type
  },

  /**
   * 매칭 방식 레이블
   */
  getMatchingTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'exact': '정확 일치',
      'contains': '포함 여부',
      'range': '범위 (이상/이하)',
      'grade': '등급별 점수'
    }
    return labels[type] || type
  },

  /**
   * 값 소스 레이블
   */
  getValueSourceLabel(type: string): string {
    const labels: Record<string, string> = {
      'submitted': '제출된 값',
      'user_field': '사용자 필드',
      'json_field': 'JSON 필드'
    }
    return labels[type?.toLowerCase()] || type
  },

  /**
   * 집계 방식 레이블
   */
  getAggregationModeLabel(type: string): string {
    const labels: Record<string, string> = {
      'first': '첫 번째 값',
      'sum': '합계',
      'max': '최대값',
      'count': '개수',
      'any_match': '하나라도 일치',
      'best_match': '가장 높은 점수'
    }
    return labels[type] || type
  },

  /**
   * 증빙 필수 여부 레이블
   */
  getProofRequiredLabel(type: string): string {
    const labels: Record<string, string> = {
      'not_required': '필요 없음',
      'optional': '선택',
      'required': '필수'
    }
    return labels[type?.toLowerCase()] || type
  },

  /**
   * 레이아웃 타입 레이블
   */
  getLayoutTypeLabel(type: LayoutType): string {
    const labels: Record<LayoutType, string> = {
      'vertical': '세로 배치',
      'horizontal': '가로 배치',
      'grid': '그리드 배치'
    }
    return labels[type] || type
  },

  /**
   * 자격증 평가 방법인지 확인
   */
  isCertificationTemplate(template: UnifiedTemplate): boolean {
    return template.is_certification ||
           template.evaluation_method === 'by_name' ||
           template.evaluation_method === 'by_existence' ||
           template.template_id.includes('certification')
  }
}

export default unifiedTemplateService
