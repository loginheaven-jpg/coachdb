import api from './api'

export interface CompetencyItemField {
  field_id: number
  field_name: string
  field_label: string
  field_type: string
  field_options: string | null
  is_required: boolean
  display_order: number
  placeholder: string | null
}

// 역량항목에 연결된 통합 템플릿 간략 정보
export interface UnifiedTemplateBasicInfo {
  template_id: string
  template_name: string
  description: string | null
  data_source: string
  evaluation_method: string
  grade_type: string | null
  matching_type: string | null
  has_scoring: boolean
  is_certification: boolean
}

export interface CompetencyItem {
  item_id: number
  item_name: string
  item_code: string
  category: string
  input_type: string
  is_active: boolean
  template: string | null
  template_config: string | null
  is_repeatable: boolean
  max_entries: number | null
  description?: string | null
  is_custom?: boolean
  created_by?: number | null
  fields: CompetencyItemField[]
  // 평가 템플릿 연결 (legacy)
  input_template_id?: string | null
  scoring_template_id: string | null
  scoring_config_override: string | null
  // 2-tier 통합 템플릿
  unified_template_id: string | null
  evaluation_method_override: string | null
  unified_template: UnifiedTemplateBasicInfo | null
  // 템플릿에서 복사 후 독립 관리 (역량항목별 커스터마이징)
  grade_mappings: string | null  // 등급-점수 매핑 JSON
  proof_required: string | null  // not_required, optional, required
  help_text: string | null
  placeholder: string | null
  // Phase 4: 평가 설정 (역량항목 완전 독립화)
  grade_type: string | null       // string, numeric, file_exists, multi_select
  matching_type: string | null     // exact, contains, range, grade
  grade_edit_mode: string          // fixed, score_only, flexible
  evaluation_method: string        // standard, by_name, by_existence
  data_source: string              // form_input, user_profile, coach_competency
  has_scoring: boolean             // computed: grade_type && matching_type
  // Phase 5: 점수 소스 설정
  scoring_value_source: string     // submitted, user_field, json_field
  scoring_source_field: string | null  // User 필드명 (예: coach_certification_number)
  extract_pattern: string | null   // 정규식 추출 패턴 (예: ^(.{3}))
  // 역량항목 전용 필드
  verification_note: string | null  // 검증 안내 문구
  auto_confirm_across_projects: boolean | null  // 타 과제 자동 컨펌
  field_label_overrides: string | null  // 필드 라벨 오버라이드 JSON
}

// Admin create/update types
export interface CompetencyItemFieldCreate {
  field_name: string
  field_label: string
  field_type: string
  field_options?: string
  is_required?: boolean
  display_order?: number
  placeholder?: string
}

export interface CompetencyItemCreate {
  item_code: string
  item_name: string
  category: 'BASIC' | 'DETAIL' | 'EDUCATION' | 'ADDON' | 'COACHING' | 'CERTIFICATION' | 'EXPERIENCE' | 'OTHER'
  input_type?: string
  template?: string
  template_config?: string
  is_repeatable?: boolean
  max_entries?: number
  is_active?: boolean
  description?: string
  is_custom?: boolean
  fields?: CompetencyItemFieldCreate[]
  // Legacy template fields
  input_template_id?: string
  scoring_template_id?: string
  scoring_config_override?: string
  // 2-tier unified template
  unified_template_id?: string
  evaluation_method_override?: string
  // 템플릿에서 복사 후 독립 관리 (역량항목별 커스터마이징)
  grade_mappings?: string
  proof_required?: string
  help_text?: string
  placeholder?: string
  // Phase 4: 평가 설정 (역량항목 완전 독립화)
  grade_type?: string
  matching_type?: string
  grade_edit_mode?: string
  evaluation_method?: string
  data_source?: string
  // Phase 5: 점수 소스 설정
  scoring_value_source?: string
  scoring_source_field?: string
  extract_pattern?: string
  // 역량항목 전용 필드
  verification_note?: string
  auto_confirm_across_projects?: boolean
  field_label_overrides?: string
}

export interface CompetencyItemUpdate {
  item_name?: string
  category?: string
  template?: string
  template_config?: string
  is_repeatable?: boolean
  max_entries?: number
  is_active?: boolean
  description?: string
  // Legacy template fields
  input_template_id?: string
  scoring_template_id?: string
  scoring_config_override?: string
  // 2-tier unified template
  unified_template_id?: string
  evaluation_method_override?: string
  // 템플릿에서 복사 후 독립 관리 (역량항목별 커스터마이징)
  grade_mappings?: string
  proof_required?: string
  help_text?: string
  placeholder?: string
  // Phase 4: 평가 설정 (역량항목 완전 독립화)
  grade_type?: string
  matching_type?: string
  grade_edit_mode?: string
  evaluation_method?: string
  data_source?: string
  // Phase 5: 점수 소스 설정
  scoring_value_source?: string
  scoring_source_field?: string
  extract_pattern?: string
  // 역량항목 전용 필드
  verification_note?: string
  auto_confirm_across_projects?: boolean
  field_label_overrides?: string
}

export interface FileBasicInfo {
  file_id: number
  original_filename: string
  file_size: number
  mime_type: string
  uploaded_at: string
}

export interface CoachCompetency {
  competency_id: number
  user_id: number
  item_id: number
  value: string | null
  file_id: number | null
  verification_status: 'pending' | 'approved' | 'rejected' | 'supplemented'
  verified_by: number | null
  verified_at: string | null
  rejection_reason: string | null
  is_anonymized: boolean
  created_at: string
  updated_at: string | null
  competency_item?: CompetencyItem
  file_info?: FileBasicInfo
}

export interface CompetencyCreateData {
  item_id: number
  value?: string
  file_id?: number
}

export interface CompetencyUpdateData {
  value?: string
  file_id?: number
}

class CompetencyService {
  async getCompetencyItems(): Promise<CompetencyItem[]> {
    const response = await api.get<CompetencyItem[]>('/competencies/items')
    return response.data
  }

  async getMyCompetencies(): Promise<CoachCompetency[]> {
    const response = await api.get<CoachCompetency[]>('/competencies/my')
    return response.data
  }

  async createCompetency(data: CompetencyCreateData): Promise<CoachCompetency> {
    const response = await api.post<CoachCompetency>('/competencies/', data)
    return response.data
  }

  async updateCompetency(competencyId: number, data: CompetencyUpdateData, syncToApplications: boolean = false): Promise<CoachCompetency> {
    const response = await api.put<CoachCompetency>(`/competencies/${competencyId}?sync_to_applications=${syncToApplications}`, data)
    return response.data
  }

  async checkLinkedApplications(competencyId: number): Promise<{ has_linked_applications: boolean; linked_count: number }> {
    const response = await api.get<{ competency_id: number; has_linked_applications: boolean; linked_count: number }>(`/competencies/${competencyId}/has-linked-applications`)
    return response.data
  }

  async deleteCompetency(competencyId: number): Promise<void> {
    await api.delete(`/competencies/${competencyId}`)
  }

  // ============================================================================
  // Admin Methods (SUPER_ADMIN only)
  // ============================================================================

  async getAllCompetencyItems(includeInactive: boolean = true): Promise<CompetencyItem[]> {
    const response = await api.get<CompetencyItem[]>(`/competencies/items/all?include_inactive=${includeInactive}`)
    return response.data
  }

  async createCompetencyItem(data: CompetencyItemCreate): Promise<CompetencyItem> {
    const response = await api.post<CompetencyItem>('/competencies/items', data)
    return response.data
  }

  async updateCompetencyItem(itemId: number, data: CompetencyItemUpdate): Promise<CompetencyItem> {
    const response = await api.put<CompetencyItem>(`/competencies/items/${itemId}`, data)
    return response.data
  }

  async deleteCompetencyItem(itemId: number): Promise<void> {
    await api.delete(`/competencies/items/${itemId}`)
  }

  async createCompetencyItemField(itemId: number, data: CompetencyItemFieldCreate): Promise<CompetencyItemField> {
    const response = await api.post<CompetencyItemField>(`/competencies/items/${itemId}/fields`, data)
    return response.data
  }

  async updateCompetencyItemField(itemId: number, fieldId: number, data: Partial<CompetencyItemFieldCreate>): Promise<CompetencyItemField> {
    const response = await api.put<CompetencyItemField>(`/competencies/items/${itemId}/fields/${fieldId}`, data)
    return response.data
  }

  async deleteCompetencyItemField(itemId: number, fieldId: number): Promise<void> {
    await api.delete(`/competencies/items/${itemId}/fields/${fieldId}`)
  }
}

export default new CompetencyService()
