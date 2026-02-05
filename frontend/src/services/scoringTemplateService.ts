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
  value_source: string    // submitted, user_field, json_field
  source_field?: string
  extract_pattern?: string  // JSON 추출 패턴
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
  extract_pattern?: string
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
  },

  /**
   * 등급 유형 레이블 가져오기
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
   * 매칭 방식 레이블 가져오기
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
   * 값 소스 레이블 가져오기
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
   * 집계 방식 레이블 가져오기
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
   * 증빙 필수 여부 레이블 가져오기
   */
  getProofRequiredLabel(type: string): string {
    const labels: Record<string, string> = {
      'not_required': '필요 없음',
      'optional': '선택',
      'required': '필수'
    }
    return labels[type?.toLowerCase()] || type
  }
}

export default scoringTemplateService
