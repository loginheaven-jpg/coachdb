/**
 * 입력 템플릿 (Input Template) API 서비스
 */
import api from './api'

// 데이터 소스 타입
export type DataSourceType = 'form_input' | 'user_profile' | 'coach_competency'

// User 프로필 필드 정보
export interface UserProfileFieldInfo {
  field_name: string
  label: string
  description: string
  type: string
}

// 필드 스키마 타입
export interface FieldSchema {
  name: string
  type: string  // text, number, select, multiselect, file, date, textarea
  label: string
  required?: boolean
  options?: string[]
  placeholder?: string
  default_value?: string | number | boolean
  validation?: Record<string, unknown>
}

// 입력 템플릿 응답 타입
export interface InputTemplate {
  template_id: string
  template_name: string
  description?: string

  // 데이터 소스 설정
  data_source: DataSourceType  // form_input (기본), user_profile (User 테이블 참조), coach_competency (중앙 DB)
  source_field?: string        // data_source가 user_profile일 때 참조할 필드명
  display_only: boolean        // 읽기 전용 표시 여부

  // 필드 스키마 (JSON 문자열) - data_source가 form_input일 때만 사용
  fields_schema: string

  // 레이아웃
  layout_type: string  // vertical, horizontal, grid

  // 입력 특성
  is_repeatable: boolean
  max_entries?: string

  // 검증/도움말
  validation_rules?: string  // JSON 문자열
  help_text?: string
  placeholder?: string

  // 키워드 (JSON 문자열)
  keywords?: string

  is_active: boolean
  created_at: string
  updated_at?: string
}

// 입력 템플릿 생성 타입
export interface InputTemplateCreate {
  template_id: string
  template_name: string
  description?: string
  data_source?: DataSourceType
  source_field?: string
  display_only?: boolean
  fields_schema?: string
  layout_type?: string
  is_repeatable?: boolean
  max_entries?: string
  validation_rules?: string
  help_text?: string
  placeholder?: string
  keywords?: string
  is_active?: boolean
}

// 입력 템플릿 수정 타입
export interface InputTemplateUpdate {
  template_name?: string
  description?: string
  data_source?: DataSourceType
  source_field?: string
  display_only?: boolean
  fields_schema?: string
  layout_type?: string
  is_repeatable?: boolean
  max_entries?: string
  validation_rules?: string
  help_text?: string
  placeholder?: string
  keywords?: string
  is_active?: boolean
}

// 입력 템플릿 목록 응답 타입
export interface InputTemplateListResponse {
  templates: InputTemplate[]
  total: number
}

/**
 * 입력 템플릿 API 서비스
 */
const inputTemplateService = {
  /**
   * 입력 템플릿 목록 조회
   */
  async getAll(activeOnly: boolean = true): Promise<InputTemplate[]> {
    const response = await api.get<InputTemplateListResponse>('/input-templates', {
      params: { active_only: activeOnly }
    })
    return response.data.templates
  },

  /**
   * 특정 입력 템플릿 조회
   */
  async getById(templateId: string): Promise<InputTemplate> {
    const response = await api.get<InputTemplate>(`/input-templates/${templateId}`)
    return response.data
  },

  /**
   * User 프로필에서 참조 가능한 필드 목록 조회
   */
  async getUserProfileFields(): Promise<UserProfileFieldInfo[]> {
    const response = await api.get<UserProfileFieldInfo[]>('/input-templates/user-profile-fields')
    return response.data
  },

  /**
   * 입력 템플릿 생성
   */
  async create(data: InputTemplateCreate): Promise<InputTemplate> {
    const response = await api.post<InputTemplate>('/input-templates', data)
    return response.data
  },

  /**
   * 입력 템플릿 수정
   */
  async update(templateId: string, data: InputTemplateUpdate): Promise<InputTemplate> {
    const response = await api.put<InputTemplate>(`/input-templates/${templateId}`, data)
    return response.data
  },

  /**
   * 입력 템플릿 삭제 (비활성화)
   */
  async delete(templateId: string): Promise<void> {
    await api.delete(`/input-templates/${templateId}`)
  },

  /**
   * 필드 스키마 파싱 (JSON 문자열 -> 객체 배열)
   */
  parseFieldsSchema(schemaJson: string): FieldSchema[] {
    try {
      return JSON.parse(schemaJson)
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
   * 검증 규칙 파싱 (JSON 문자열 -> 객체)
   */
  parseValidationRules(rulesJson: string | undefined): Record<string, unknown> {
    if (!rulesJson) return {}
    try {
      return JSON.parse(rulesJson)
    } catch {
      return {}
    }
  },

  /**
   * 검증 규칙 직렬화 (객체 -> JSON 문자열)
   */
  stringifyValidationRules(rules: Record<string, unknown>): string {
    return JSON.stringify(rules)
  },

  /**
   * 필드 타입 레이블 가져오기
   */
  getFieldTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'text': '텍스트',
      'number': '숫자',
      'select': '단일선택',
      'multiselect': '다중선택',
      'file': '파일',
      'date': '날짜',
      'textarea': '장문 텍스트'
    }
    return labels[type] || type
  },

  /**
   * 레이아웃 타입 레이블 가져오기
   */
  getLayoutTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'vertical': '세로 배치',
      'horizontal': '가로 배치',
      'grid': '그리드'
    }
    return labels[type] || type
  },

  /**
   * 데이터 소스 타입 레이블 가져오기
   */
  getDataSourceLabel(type: DataSourceType): string {
    const labels: Record<DataSourceType, string> = {
      'form_input': '폼 입력',
      'user_profile': '회원정보 참조',
      'coach_competency': '중앙 DB 참조'
    }
    return labels[type] || type
  },

  /**
   * 데이터 소스 타입 설명 가져오기
   */
  getDataSourceDescription(type: DataSourceType): string {
    const descriptions: Record<DataSourceType, string> = {
      'form_input': '사용자가 폼에서 직접 입력',
      'user_profile': 'User 테이블 필드값 참조 (읽기 전용)',
      'coach_competency': '이미 입력된 중앙 DB에서 가져옴'
    }
    return descriptions[type] || ''
  }
}

export default inputTemplateService
