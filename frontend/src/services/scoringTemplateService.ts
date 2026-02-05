/**
 * 평가 템플릿 (Scoring Template) API 서비스
 */
import api from './api'

// 등급 매핑 타입
export interface GradeMapping {
  value: string | number
  score: number
  label?: string
  fixed?: boolean
}

// 평가 템플릿 응답 타입
export interface ScoringTemplate {
  template_id: string
  template_name: string
  description?: string

  // 평가 설정
  grade_type: string      // string, numeric, file_exists, multi_select
  matching_type: string   // exact, contains, range, grade
  value_source: string    // SUBMITTED, USER_FIELD, JSON_FIELD
  source_field?: string
  aggregation_mode: string  // first, sum, max, count, any_match, best_match

  // 등급 매핑 (JSON 문자열)
  default_mappings: string

  // 템플릿 특성
  fixed_grades: boolean
  allow_add_grades: boolean
  proof_required: string  // NOT_REQUIRED, OPTIONAL, REQUIRED
  verification_note?: string

  // 항목 설정 기본값
  is_required_default: boolean
  allow_multiple: boolean

  // 자동 컨펌 정책
  auto_confirm_across_projects: boolean

  // 키워드 (JSON 문자열)
  keywords?: string

  is_active: boolean
  created_at: string
  updated_at?: string
}

// 평가 템플릿 생성 타입
export interface ScoringTemplateCreate {
  template_id: string
  template_name: string
  description?: string
  grade_type: string
  matching_type: string
  value_source?: string
  source_field?: string
  aggregation_mode?: string
  default_mappings: string
  fixed_grades?: boolean
  allow_add_grades?: boolean
  proof_required?: string
  verification_note?: string
  is_required_default?: boolean
  allow_multiple?: boolean
  auto_confirm_across_projects?: boolean
  keywords?: string
  is_active?: boolean
}

// 평가 템플릿 수정 타입
export interface ScoringTemplateUpdate {
  template_name?: string
  description?: string
  grade_type?: string
  matching_type?: string
  value_source?: string
  source_field?: string
  aggregation_mode?: string
  default_mappings?: string
  fixed_grades?: boolean
  allow_add_grades?: boolean
  proof_required?: string
  verification_note?: string
  is_required_default?: boolean
  allow_multiple?: boolean
  auto_confirm_across_projects?: boolean
  keywords?: string
  is_active?: boolean
}

// 평가 템플릿 목록 응답 타입
export interface ScoringTemplateListResponse {
  templates: ScoringTemplate[]
  total: number
}

/**
 * 평가 템플릿 API 서비스
 */
const scoringTemplateService = {
  /**
   * 평가 템플릿 목록 조회
   */
  async getAll(activeOnly: boolean = true): Promise<ScoringTemplate[]> {
    const response = await api.get<ScoringTemplateListResponse>('/scoring-templates', {
      params: { active_only: activeOnly }
    })
    return response.data.templates
  },

  /**
   * 특정 평가 템플릿 조회
   */
  async getById(templateId: string): Promise<ScoringTemplate> {
    const response = await api.get<ScoringTemplate>(`/scoring-templates/${templateId}`)
    return response.data
  },

  /**
   * 평가 템플릿 생성
   */
  async create(data: ScoringTemplateCreate): Promise<ScoringTemplate> {
    const response = await api.post<ScoringTemplate>('/scoring-templates', data)
    return response.data
  },

  /**
   * 평가 템플릿 수정
   */
  async update(templateId: string, data: ScoringTemplateUpdate): Promise<ScoringTemplate> {
    const response = await api.put<ScoringTemplate>(`/scoring-templates/${templateId}`, data)
    return response.data
  },

  /**
   * 평가 템플릿 삭제 (비활성화)
   */
  async delete(templateId: string): Promise<void> {
    await api.delete(`/scoring-templates/${templateId}`)
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
  }
}

export default scoringTemplateService
