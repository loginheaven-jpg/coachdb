import api from './api'

// ============================================================================
// Enums
// ============================================================================
export enum ProjectStatus {
  DRAFT = 'draft',              // 초안 (임시저장, 비공개)
  PENDING = 'pending',          // 승인대기 (SUPER_ADMIN 승인 필요)
  REJECTED = 'rejected',        // 반려됨 (수정 후 재상신 가능)
  READY = 'ready',              // 승인완료 (모집대기/모집중은 날짜로 계산)
  RECRUITING = 'recruiting',    // 접수중 (legacy)
  REVIEWING = 'reviewing',      // 심사중
  IN_PROGRESS = 'in_progress',  // 과제진행중
  EVALUATING = 'evaluating',    // 과제평가중
  COMPLETED = 'completed',      // (레거시)
  CLOSED = 'closed'             // 종료
}

// 표시용 상태 (display_status)
export type DisplayStatus = 'draft' | 'pending' | 'recruiting' | 'recruiting_ended' | 'reviewing' | 'in_progress' | 'evaluating' | 'closed'

export enum CoachRole {
  LEADER = 'leader',
  PARTICIPANT = 'participant',
  SUPERVISOR = 'supervisor'
}

export enum ProofRequiredLevel {
  NOT_REQUIRED = 'not_required',
  OPTIONAL = 'optional',
  REQUIRED = 'required'
}

export enum MatchingType {
  EXACT = 'exact',
  CONTAINS = 'contains',
  RANGE = 'range',
  GRADE = 'grade'  // 등급별 점수 (문자열/숫자 범위 모두 지원)
}

export enum ValueSourceType {
  SUBMITTED = 'submitted',     // ApplicationData.submitted_value (기본값)
  USER_FIELD = 'user_field',   // User 테이블 필드 (예: coach_certification_number)
  JSON_FIELD = 'json_field'    // submitted_value JSON 내부 필드 (예: degree_level)
}

export enum AggregationMode {
  FIRST = 'first',           // 첫 번째만 (기본값)
  SUM = 'sum',               // 합산 (숫자 범위용)
  MAX = 'max',               // 최대값
  COUNT = 'count',           // 입력 개수
  ANY_MATCH = 'any_match',   // 하나라도 매칭되면 (문자열용)
  BEST_MATCH = 'best_match'  // 가장 높은 점수 매칭
}

// GRADE 타입용 등급 정의
export interface GradeConfigString {
  type: 'string'
  matchMode?: 'exact' | 'contains' | 'any'  // 매칭 방식 (기본값: 'exact', any=어떤 값이든)
  grades: Array<{ value: string; score: number }>
  proofPenalty?: number  // 증빙 감점 (예: -3)
}

export interface GradeConfigNumeric {
  type: 'numeric'
  grades: Array<{ min?: number; max?: number; score: number }>
  proofPenalty?: number  // 증빙 감점 (예: -3)
}

// 복수선택 등급
export interface GradeConfigMultiSelect {
  type: 'multi_select'
  mode: 'contains' | 'count'  // 포함 여부 / 선택 개수
  grades: Array<{ value?: string; min?: number; score: number }>
  proofPenalty?: number  // 증빙 감점 (예: -3)
}

// 파일 유무 등급
export interface GradeConfigFileExists {
  type: 'file_exists'
  grades: {
    exists: number   // 파일 있음
    none: number     // 파일 없음 (0)
  }
  proofPenalty?: number  // 증빙 감점 (예: -3)
}

export type GradeConfig =
  | GradeConfigString
  | GradeConfigNumeric
  | GradeConfigMultiSelect
  | GradeConfigFileExists

export enum ItemTemplate {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  FILE = 'file',
  TEXT_FILE = 'text_file',
  DEGREE = 'degree',
  COACHING_HISTORY = 'coaching_history',
  COACHING_TIME = 'coaching_time',  // 코칭시간 (내용 + 연도 + 시간 + 증빙)
  COACHING_EXPERIENCE = 'coaching_experience'  // 코칭경력 (기관명 + 연도 + 시간 + 증빙)
}

// ============================================================================
// Type Definitions
// ============================================================================
export interface UserBasicInfo {
  user_id: number
  username: string
  full_name: string | null
}

export interface ProjectBase {
  project_name: string
  description: string | null
  support_program_name?: string | null
  recruitment_start_date: string // ISO date string
  recruitment_end_date: string
  project_start_date: string | null
  project_end_date: string | null
  max_participants: number
  project_manager_id: number | null
}

export interface ProjectCreate extends ProjectBase {
  status?: ProjectStatus
}

export interface ProjectUpdate {
  project_name?: string
  description?: string | null
  recruitment_start_date?: string
  recruitment_end_date?: string
  project_start_date?: string | null
  project_end_date?: string | null
  actual_start_date?: string | null
  actual_end_date?: string | null
  overall_feedback?: string | null
  status?: ProjectStatus
  max_participants?: number
  project_manager_id?: number | null
}

export interface Project extends ProjectBase {
  project_id: number
  status: ProjectStatus
  display_status?: DisplayStatus  // 표시용 상태 (서버에서 계산)
  actual_start_date: string | null
  actual_end_date: string | null
  overall_feedback: string | null
  created_by: number
  created_at: string
  updated_at: string | null
}

export interface ProjectDetail extends Project {
  creator: UserBasicInfo | null
  project_manager: UserBasicInfo | null
  application_count: number | null
  selected_count: number | null
  current_participants?: number  // 확정된 참여자 수
}

export interface ProjectListItem {
  project_id: number
  project_name: string
  recruitment_start_date: string
  recruitment_end_date: string
  project_start_date: string | null
  project_end_date: string | null
  status: ProjectStatus
  display_status?: DisplayStatus  // 표시용 상태 (서버에서 계산)
  max_participants: number
  application_count: number | null
  current_participants: number | null  // 확정된 참여자 수
  created_by: number  // 생성자 ID
  project_manager_id: number | null  // 과제관리자 ID
  created_at: string
}

// ============================================================================
// Competency Item Types
// ============================================================================
export interface CompetencyItemField {
  field_id: number
  field_name: string
  field_label: string
  field_type: string
  field_options: string | null  // JSON string
  is_required: boolean
  display_order: number
  placeholder: string | null
}

export interface CompetencyItem {
  item_id: number
  item_name: string
  item_code: string
  category: string
  input_type: string  // Deprecated
  is_active: boolean

  // Template system
  template: ItemTemplate | null
  template_config: string | null  // JSON string
  is_repeatable: boolean
  max_entries: number | null
  description: string | null  // 설문 입력 안내 문구

  // Custom question support
  is_custom: boolean
  created_by: number | null

  // Fields
  fields: CompetencyItemField[]
}

export interface CompetencyItemCreate {
  item_name: string
  item_code?: string | null  // Auto-generated for custom questions
  category?: string
  input_type?: string
  template?: ItemTemplate | null
  template_config?: string | null
  is_repeatable?: boolean
  max_entries?: number | null
  is_active?: boolean
  description?: string | null
  is_custom: boolean
  fields?: CompetencyItemFieldCreate[]
}

export interface CompetencyItemFieldCreate {
  field_name: string
  field_label: string
  field_type: string
  field_options?: string | null
  is_required?: boolean
  display_order?: number
  placeholder?: string | null
}

export interface ScoringCriteriaCreate {
  matching_type: MatchingType
  expected_value: string  // GRADE 타입: JSON string (GradeConfig 형태)
  score: number  // GRADE 타입에서는 expected_value JSON에서 결정하므로 0으로 설정 가능
  // GRADE 타입용 값 소스 설정
  value_source?: ValueSourceType  // 값을 가져올 소스 (기본값: SUBMITTED)
  source_field?: string | null  // User 필드명 또는 JSON 필드명
  extract_pattern?: string | null  // 정규식 패턴 (예: "^(.{3})" - 앞 3글자 추출)
  // 복수입력 항목의 집계 방식
  aggregation_mode?: AggregationMode  // 집계 방식 (기본값: FIRST)
}

export interface ScoringCriteria extends ScoringCriteriaCreate {
  criteria_id: number
  value_source: ValueSourceType
  source_field: string | null
  extract_pattern: string | null
  aggregation_mode: AggregationMode
}

export interface ProjectItemCreate {
  item_id: number
  is_required: boolean
  proof_required_level: ProofRequiredLevel
  max_score: number | null
  display_order: number
  scoring_criteria: ScoringCriteriaCreate[]
}

export interface ProjectItem extends ProjectItemCreate {
  project_item_id: number
  project_id: number
  competency_item: CompetencyItem | null
  scoring_criteria: ScoringCriteria[]
}

export interface ScoreValidation {
  is_valid: boolean
  total_score: number
  missing_score: number
  message: string
}

// ============================================================================
// Custom Question Types
// ============================================================================
export interface CustomQuestionBase {
  question_text: string
  question_type: 'text' | 'textarea' | 'select' | 'file'
  is_required: boolean
  display_order: number
  options: string | null // JSON string for select options
}

export interface CustomQuestionCreate extends CustomQuestionBase {
  project_id: number
  max_score: number | null
  allows_text: boolean
  allows_file: boolean
  file_required: boolean
}

export interface CustomQuestionUpdate {
  question_text?: string
  question_type?: 'text' | 'textarea' | 'select' | 'file'
  is_required?: boolean
  display_order?: number
  options?: string | null
  max_score?: number | null
  allows_text?: boolean
  allows_file?: boolean
  file_required?: boolean
}

export interface CustomQuestion extends CustomQuestionBase {
  question_id: number
  project_id: number
  max_score: number | null
  allows_text: boolean
  allows_file: boolean
  file_required: boolean
  created_at: string
  updated_at: string | null
}

// ============================================================================
// Coach Evaluation Types
// ============================================================================
export interface CoachEvaluationBase {
  participation_score: number // 1-4
  feedback_text: string | null
  special_notes: string | null
}

export interface CoachEvaluationCreate extends CoachEvaluationBase {
  project_id: number
  coach_user_id: number
}

export interface CoachEvaluationUpdate {
  participation_score?: number
  feedback_text?: string | null
  special_notes?: string | null
}

export interface CoachEvaluation extends CoachEvaluationBase {
  evaluation_id: number
  project_id: number
  coach_user_id: number
  evaluated_by: number
  evaluated_at: string
  updated_at: string | null
  coach: UserBasicInfo | null
  evaluator: UserBasicInfo | null
}

// ============================================================================
// Project Applications (응모자 목록)
// ============================================================================
export interface ApplicantInfo {
  user_id: number
  name: string
  email: string
  phone: string | null
}

export interface ProjectApplicationListItem {
  application_id: number
  project_id: number
  user_id: number
  applicant: ApplicantInfo
  status: string  // draft, submitted, reviewing, completed
  auto_score: number | null
  final_score: number | null
  selection_result: string  // pending, selected, rejected
  applied_role: string | null
  submitted_at: string | null
  last_updated: string | null
  is_frozen: boolean
  frozen_at: string | null
  document_verification_status: string  // pending, partial, approved, rejected, supplement_requested
  supplement_count: number
}

// ============================================================================
// Project Staff (심사위원) Types
// ============================================================================
export interface ProjectStaffResponse {
  project_id: number
  staff_user_id: number
  assigned_at: string
  staff_user: UserBasicInfo | null
}

export interface ProjectStaffListResponse {
  staff_list: ProjectStaffResponse[]
  total_count: number
}

// ============================================================================
// API Service
// ============================================================================
const projectService = {
  // ============================================================================
  // Project CRUD
  // ============================================================================

  /**
   * Create a new project
   */
  async createProject(data: ProjectCreate): Promise<Project> {
    const response = await api.post('/projects', data)
    return response.data
  },

  /**
   * Create a test project with realistic content
   * Recruitment period: 2 weeks from today
   */
  async createTestProject(): Promise<Project> {
    const response = await api.post('/projects/create-test')
    return response.data
  },

  /**
   * Create a test project with 10 submitted applications for review testing
   * Creates virtual test users and assigns random scores (60-95)
   */
  async createTestProjectWithApplications(): Promise<Project> {
    const response = await api.post('/projects/create-test-with-applications')
    return response.data
  },

  /**
   * Get list of projects with optional filters
   */
  async listProjects(params?: {
    status?: ProjectStatus
    manager_id?: number
    mode?: 'participate' | 'manage' | 'review'
    skip?: number
    limit?: number
  }): Promise<ProjectListItem[]> {
    const response = await api.get('/projects', { params })
    return response.data
  },

  /**
   * Get detailed project information
   */
  async getProject(projectId: number): Promise<ProjectDetail> {
    const response = await api.get(`/projects/${projectId}`)
    return response.data
  },

  /**
   * Update project information
   */
  async updateProject(projectId: number, data: ProjectUpdate): Promise<Project> {
    const response = await api.put(`/projects/${projectId}`, data)
    return response.data
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId: number): Promise<void> {
    await api.delete(`/projects/${projectId}`)
  },

  // ============================================================================
  // Custom Questions
  // ============================================================================

  /**
   * Create a custom question for a project
   */
  async createCustomQuestion(data: CustomQuestionCreate): Promise<CustomQuestion> {
    const response = await api.post('/projects/questions', data)
    return response.data
  },

  /**
   * Get all custom questions for a project
   */
  async getProjectQuestions(projectId: number): Promise<CustomQuestion[]> {
    const response = await api.get(`/projects/${projectId}/questions`)
    return response.data
  },

  /**
   * Update a custom question
   */
  async updateCustomQuestion(questionId: number, data: CustomQuestionUpdate): Promise<CustomQuestion> {
    const response = await api.put(`/projects/questions/${questionId}`, data)
    return response.data
  },

  /**
   * Delete a custom question
   */
  async deleteCustomQuestion(questionId: number): Promise<void> {
    await api.delete(`/projects/questions/${questionId}`)
  },

  // ============================================================================
  // Coach Evaluations
  // ============================================================================

  /**
   * Create coach evaluation for a project
   */
  async createCoachEvaluation(projectId: number, data: CoachEvaluationCreate): Promise<CoachEvaluation> {
    const response = await api.post(`/projects/${projectId}/evaluations`, data)
    return response.data
  },

  /**
   * Get all coach evaluations for a project
   */
  async getProjectEvaluations(projectId: number): Promise<CoachEvaluation[]> {
    const response = await api.get(`/projects/${projectId}/evaluations`)
    return response.data
  },

  /**
   * Update coach evaluation
   */
  async updateCoachEvaluation(evaluationId: number, data: CoachEvaluationUpdate): Promise<CoachEvaluation> {
    const response = await api.put(`/projects/evaluations/${evaluationId}`, data)
    return response.data
  },

  /**
   * Delete coach evaluation
   */
  async deleteCoachEvaluation(evaluationId: number): Promise<void> {
    await api.delete(`/projects/evaluations/${evaluationId}`)
  },

  // ============================================================================
  // Project Items (설문항목)
  // ============================================================================

  /**
   * Get all project items for a project
   */
  async getProjectItems(projectId: number): Promise<ProjectItem[]> {
    const response = await api.get(`/projects/${projectId}/items`)
    return response.data
  },

  /**
   * Add a competency item to project
   */
  async addProjectItem(projectId: number, data: ProjectItemCreate): Promise<ProjectItem> {
    const response = await api.post(`/projects/${projectId}/items`, data)
    return response.data
  },

  /**
   * Update a project item
   */
  async updateProjectItem(projectId: number, projectItemId: number, data: ProjectItemCreate): Promise<ProjectItem> {
    const response = await api.put(`/projects/${projectId}/items/${projectItemId}`, data)
    return response.data
  },

  /**
   * Delete a project item
   */
  async deleteProjectItem(projectId: number, projectItemId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/items/${projectItemId}`)
  },

  /**
   * Validate total score equals 100
   */
  async validateProjectScore(projectId: number): Promise<ScoreValidation> {
    const response = await api.post(`/projects/${projectId}/validate-score`)
    return response.data
  },

  /**
   * 정식저장 - 모든 조건 검증 후 ready 상태로 전환
   * 조건: 과제기간 입력 완료 + 설문 100점
   */
  async finalizeProject(projectId: number): Promise<Project> {
    const response = await api.post(`/projects/${projectId}/finalize`)
    return response.data
  },

  // ============================================================================
  // Project Approval (SUPER_ADMIN only)
  // ============================================================================

  /**
   * 과제 승인 (SUPER_ADMIN only)
   * PENDING 상태의 과제를 READY로 변경
   */
  async approveProject(projectId: number): Promise<Project> {
    const response = await api.post(`/projects/${projectId}/approve`)
    return response.data
  },

  /**
   * 과제 반려 (SUPER_ADMIN only)
   * PENDING 상태의 과제를 REJECTED로 변경
   */
  async rejectProject(projectId: number, reason: string): Promise<Project> {
    const response = await api.post(`/projects/${projectId}/reject`, { reason })
    return response.data
  },

  /**
   * 과제 재상신 (과제 생성자만)
   * REJECTED 상태의 과제를 PENDING으로 변경
   */
  async resubmitProject(projectId: number): Promise<Project> {
    const response = await api.post(`/projects/${projectId}/resubmit`)
    return response.data
  },

  /**
   * Get all competency items (master data)
   */
  async getCompetencyItems(): Promise<CompetencyItem[]> {
    const response = await api.get('/competencies/items')
    return response.data
  },

  // ============================================================================
  // Custom Competency Items (커스텀 질문)
  // ============================================================================

  /**
   * Create a custom competency item (커스텀 질문 생성)
   * This creates a reusable competency item with is_custom=true
   */
  async createCustomCompetencyItem(data: CompetencyItemCreate): Promise<CompetencyItem> {
    const response = await api.post('/competencies/items', {
      ...data,
      is_custom: true
    })
    return response.data
  },

  /**
   * Update a custom competency item
   */
  async updateCustomCompetencyItem(itemId: number, data: Partial<CompetencyItemCreate>): Promise<CompetencyItem> {
    const response = await api.put(`/competencies/items/${itemId}`, data)
    return response.data
  },

  /**
   * Delete (deactivate) a custom competency item
   */
  async deleteCustomCompetencyItem(itemId: number): Promise<void> {
    await api.delete(`/competencies/items/${itemId}`)
  },

  // ============================================================================
  // Project Applications (응모자 목록)
  // ============================================================================

  /**
   * Get all applications for a project
   */
  async getProjectApplications(projectId: number, statusFilter?: string): Promise<ProjectApplicationListItem[]> {
    const params = statusFilter ? { status_filter: statusFilter } : undefined
    const response = await api.get(`/projects/${projectId}/applications`, { params })
    return response.data
  },

  /**
   * Freeze all submitted applications for a project (스냅샷 동결)
   */
  async freezeApplications(projectId: number): Promise<{ message: string; frozen_count: number; snapshot_count: number }> {
    const response = await api.post(`/projects/${projectId}/freeze-applications`)
    return response.data
  },

  // ============================================================================
  // Project Staff (심사위원) Management - SUPER_ADMIN only
  // ============================================================================

  /**
   * Get list of staff (reviewers) assigned to a project
   */
  async getProjectStaff(projectId: number): Promise<ProjectStaffListResponse> {
    const response = await api.get(`/projects/${projectId}/staff`)
    return response.data
  },

  /**
   * Add a reviewer to a project
   */
  async addProjectStaff(projectId: number, staffUserId: number): Promise<ProjectStaffResponse> {
    const response = await api.post(`/projects/${projectId}/staff`, { staff_user_id: staffUserId })
    return response.data
  },

  /**
   * Remove a reviewer from a project
   */
  async removeProjectStaff(projectId: number, staffUserId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/staff/${staffUserId}`)
  },

  // ============================================================================
  // Test Project Management - SUPER_ADMIN only
  // ============================================================================

  /**
   * Get all test projects (projects starting with '[테스트]')
   */
  async getTestProjects(): Promise<ProjectListItem[]> {
    const response = await api.get('/projects/test-projects')
    return response.data
  },

  /**
   * Bulk delete multiple test projects
   */
  async bulkDeleteProjects(projectIds: number[]): Promise<{ deleted_count: number }> {
    const response = await api.delete('/projects/bulk-delete', { data: projectIds })
    return response.data
  }
}

export default projectService
