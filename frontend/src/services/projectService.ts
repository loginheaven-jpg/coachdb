import api from './api'

// ============================================================================
// Enums
// ============================================================================
export enum ProjectStatus {
  DRAFT = 'draft',              // 준비중
  RECRUITING = 'recruiting',    // 접수중
  REVIEWING = 'reviewing',      // 심사중
  IN_PROGRESS = 'in_progress',  // 과제진행중
  EVALUATING = 'evaluating',    // 과제평가중
  COMPLETED = 'completed',      // (레거시)
  CLOSED = 'closed'             // 종료
}

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
  RANGE = 'range'
}

export enum ItemTemplate {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  FILE = 'file',
  TEXT_FILE = 'text_file',
  DEGREE = 'degree',
  COACHING_HISTORY = 'coaching_history'
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
}

export interface ProjectListItem {
  project_id: number
  project_name: string
  recruitment_start_date: string
  recruitment_end_date: string
  project_start_date: string | null
  project_end_date: string | null
  status: ProjectStatus
  max_participants: number
  application_count: number | null
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
  expected_value: string
  score: number
}

export interface ScoringCriteria extends ScoringCriteriaCreate {
  criteria_id: number
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
   * Get list of projects with optional filters
   */
  async listProjects(params?: {
    status?: ProjectStatus
    manager_id?: number
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
  }
}

export default projectService
