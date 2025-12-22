import api from './api'
import { CoachRole } from './projectService'
import { FileBasicInfo } from './competencyService'

// ============================================================================
// Type Definitions
// ============================================================================
export interface ParticipationProject {
  application_id: number
  project_id: number
  project_name: string
  recruitment_start_date: string
  recruitment_end_date: string
  application_status: string
  document_verification_status: string  // 'pending' | 'approved' | 'rejected' | 'partial' | 'supplement_requested'
  review_score: number | null
  selection_result: string
  submitted_at: string | null
  motivation: string | null
  applied_role: string | null
  has_supplement_request: boolean
  supplement_count: number
}

export interface ApplicationBase {
  motivation: string | null
  applied_role: CoachRole | null
}

export interface ApplicationCreate extends ApplicationBase {
  project_id: number
}

export interface ApplicationUpdate extends ApplicationBase {}

export interface Application extends ApplicationBase {
  application_id: number
  project_id: number
  user_id: number
  status: string
  auto_score: number | null
  final_score: number | null
  score_visibility: string
  can_submit: boolean
  selection_result: string
  submitted_at: string | null
  last_updated: string | null
  // 마감 후 스냅샷 동결 관련
  is_frozen: boolean
  frozen_at: string | null
}

// ============================================================================
// Application Data Types (Survey Item Responses)
// ============================================================================
export interface ApplicationDataSubmit {
  item_id: number
  submitted_value: string | null
  submitted_file_id: number | null
}

export interface ApplicationData {
  data_id: number
  application_id: number
  item_id: number
  competency_id: number | null
  submitted_value: string | null
  submitted_file_id: number | null
  submitted_file_info?: FileBasicInfo | null  // 파일 메타데이터
  verification_status: string  // 'pending' | 'approved' | 'rejected' | 'supplement_requested' | 'supplemented'
  item_score: number | null
  reviewed_by: number | null
  reviewed_at: string | null
  rejection_reason: string | null
  supplement_deadline: string | null
  supplement_requested_at: string | null

  // Linked competency 정보 (역량 지갑에서 가져온 실시간 데이터)
  linked_competency_value?: string | null
  linked_competency_file_id?: number | null
  linked_competency_file_info?: FileBasicInfo | null
  linked_competency_verification_status?: string | null

  // 하이브리드 구조: is_frozen 상태에 따라 표시할 값 (백엔드에서 계산)
  value_to_display?: string | null
  file_id_to_display?: number | null
  file_info_to_display?: FileBasicInfo | null
}

export interface SupplementSubmitRequest {
  submitted_value?: string | null
  submitted_file_id?: number | null
}

// ============================================================================
// Custom Question Answer Types
// ============================================================================
export interface CustomAnswerSubmit {
  question_id: number
  answer_text: string | null
  answer_file_id: number | null
}

export interface ApplicationSubmitRequest {
  motivation: string | null
  applied_role: CoachRole | null
  custom_answers: CustomAnswerSubmit[]
  application_data: ApplicationDataSubmit[]  // Survey item responses
}

export interface CustomQuestionAnswer {
  answer_id: number
  application_id: number
  question_id: number
  answer_text: string | null
  answer_file_id: number | null
  created_at: string
  updated_at: string | null
}

// ============================================================================
// API Service
// ============================================================================
const applicationService = {
  /**
   * Get current user's participation project list
   */
  async getMyApplications(): Promise<ParticipationProject[]> {
    const response = await api.get('/applications/my')
    return response.data
  },

  /**
   * Create a new application (draft)
   */
  async createApplication(data: ApplicationCreate): Promise<Application> {
    const response = await api.post('/applications', data)
    return response.data
  },

  /**
   * Get application details
   */
  async getApplication(applicationId: number): Promise<Application> {
    const response = await api.get(`/applications/${applicationId}`)
    return response.data
  },

  /**
   * Update application (motivation and role)
   */
  async updateApplication(applicationId: number, data: ApplicationUpdate): Promise<Application> {
    const response = await api.put(`/applications/${applicationId}`, data)
    return response.data
  },

  /**
   * Save or update a custom question answer
   */
  async saveCustomAnswer(applicationId: number, answerData: CustomAnswerSubmit): Promise<CustomQuestionAnswer> {
    const response = await api.post(`/applications/${applicationId}/answers`, answerData)
    return response.data
  },

  /**
   * Get all custom question answers for an application
   */
  async getCustomAnswers(applicationId: number): Promise<CustomQuestionAnswer[]> {
    const response = await api.get(`/applications/${applicationId}/answers`)
    return response.data
  },

  /**
   * Submit an application with motivation, role, and custom answers
   */
  async submitApplication(applicationId: number, submitData: ApplicationSubmitRequest): Promise<Application> {
    const response = await api.post(`/applications/${applicationId}/submit`, submitData)
    return response.data
  },

  /**
   * Get all application data (survey item responses) for an application
   */
  async getApplicationData(applicationId: number): Promise<ApplicationData[]> {
    const response = await api.get(`/applications/${applicationId}/data`)
    return response.data
  },

  /**
   * Save or update a single application data item
   */
  async saveApplicationData(applicationId: number, data: ApplicationDataSubmit): Promise<ApplicationData> {
    const response = await api.post(`/applications/${applicationId}/data`, data)
    return response.data
  },

  /**
   * Submit supplement for a specific application data item
   */
  async submitSupplement(applicationId: number, dataId: number, data: SupplementSubmitRequest): Promise<ApplicationData> {
    const response = await api.put(`/applications/${applicationId}/data/${dataId}/submit-supplement`, data)
    return response.data
  }
}

export default applicationService
