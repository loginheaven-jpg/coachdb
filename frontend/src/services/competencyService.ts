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
  fields: CompetencyItemField[]
  // 평가 템플릿 연결
  scoring_template_id: string | null
  scoring_config_override: string | null
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
  fields?: CompetencyItemFieldCreate[]
  scoring_template_id?: string
  scoring_config_override?: string
}

export interface CompetencyItemUpdate {
  item_name?: string
  category?: string
  template?: string
  template_config?: string
  is_repeatable?: boolean
  max_entries?: number
  is_active?: boolean
  scoring_template_id?: string
  scoring_config_override?: string
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
