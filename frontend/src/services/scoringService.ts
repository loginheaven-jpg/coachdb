import api from './api'

// ============================================================================
// Enums
// ============================================================================
export enum Recommendation {
  STRONGLY_RECOMMEND = 'strongly_recommend',
  RECOMMEND = 'recommend',
  NEUTRAL = 'neutral',
  NOT_RECOMMEND = 'not_recommend'
}

export enum SelectionResult {
  PENDING = 'pending',
  SELECTED = 'selected',
  REJECTED = 'rejected'
}

// ============================================================================
// Type Definitions
// ============================================================================
export interface UserBasicInfo {
  user_id: number
  username: string
  full_name: string | null
  name: string  // Added for convenience (same as full_name)
  email: string
}

// Reviewer Evaluation Types
export interface ReviewerEvaluationCreate {
  motivation_score: number  // 0-10
  expertise_score: number   // 0-10
  role_fit_score: number    // 0-10
  comment?: string | null
  recommendation?: Recommendation | null
}

export interface ReviewerEvaluationUpdate extends ReviewerEvaluationCreate {}

export interface ReviewerEvaluationResponse {
  evaluation_id: number
  application_id: number
  reviewer_id: number
  motivation_score: number
  expertise_score: number
  role_fit_score: number
  total_score: number
  comment: string | null
  recommendation: Recommendation | null
  evaluated_at: string
  updated_at: string | null
  reviewer?: UserBasicInfo
}

// Score Calculation Types
export interface ScoreCalculationResult {
  application_id: number
  auto_score: number
  item_scores: Record<string, number>
}

export interface ProjectScoreCalculationResult {
  project_id: number
  total_applications: number
  calculated_count: number
  error_count: number
  errors: Array<{ application_id: number; error: string }>
}

export interface ProjectFinalizeResult {
  project_id: number
  total_applications: number
  finalized_count: number
  no_evaluation_count: number
}

// Selection Types
export interface SelectionRecommendation {
  application_id: number
  user_id: number
  user_name: string
  applicant_name: string  // Backend field name
  applicant_email: string  // Backend field name
  applied_role: string | null
  auto_score: number | null
  qualitative_score: number | null  // Backend uses qualitative_score
  qualitative_avg: number | null  // Alias
  final_score: number | null
  evaluation_count: number
  is_recommended: boolean
  recommended: boolean  // Backend field name
  current_selection_result: string
  rank: number
}

export interface SelectionRecommendationResult {
  project_id: number
  max_participants: number
  recommendations: SelectionRecommendation[]
  cutoff_score: number | null
}

export interface SelectionDecision {
  selection_result: SelectionResult
  selection_reason?: string | null
}

export interface BulkSelectionRequest {
  application_ids: number[]
  selection_result: SelectionResult
  selection_reason?: string | null
}

export interface BulkSelectionResult {
  project_id: number
  updated_count: number
  selected_count: number
  rejected_count: number
  errors: Array<{ application_id: number; error: string }>
}

// Weight Update Types
export interface ProjectWeightUpdate {
  quantitative_weight: number
  qualitative_weight: number
}

export interface ProjectWeightResponse {
  project_id: number
  quantitative_weight: number
  qualitative_weight: number
}

// Review Dashboard Stats
export interface ReviewDashboardStats {
  total_applications: number
  submitted_count: number
  evaluations_complete: number
  evaluations_pending: number
  selected_count: number
  rejected_count: number
  pending_count: number
  average_auto_score: number | null
  average_final_score: number | null
}

// Application with scores for review dashboard
export interface ApplicationWithScores {
  application_id: number
  user_id: number
  user_name: string
  user_email: string
  applied_role: string | null
  status: string
  auto_score: number | null
  qualitative_avg: number | null
  final_score: number | null
  selection_result: SelectionResult
  selection_reason: string | null
  submitted_at: string | null
  evaluation_count: number
  rank: number | null
}

// ============================================================================
// API Service
// ============================================================================
const scoringService = {
  // ============================================================================
  // Score Calculation
  // ============================================================================

  /**
   * Calculate auto scores for all applications in a project
   */
  async calculateProjectScores(projectId: number): Promise<ProjectScoreCalculationResult> {
    const response = await api.post(`/scoring/projects/${projectId}/calculate-scores`)
    return response.data
  },

  /**
   * Calculate auto score for a single application
   */
  async calculateApplicationScore(applicationId: number): Promise<ScoreCalculationResult> {
    const response = await api.post(`/scoring/applications/${applicationId}/calculate-score`)
    return response.data
  },

  /**
   * Finalize scores for all applications in a project
   * (Calculate weighted final scores)
   */
  async finalizeProjectScores(projectId: number): Promise<ProjectFinalizeResult> {
    const response = await api.post(`/scoring/projects/${projectId}/finalize-scores`)
    return response.data
  },

  // ============================================================================
  // Project Weights
  // ============================================================================

  /**
   * Get project evaluation weights
   */
  async getProjectWeights(projectId: number): Promise<ProjectWeightResponse> {
    const response = await api.get(`/scoring/projects/${projectId}/weights`)
    return response.data
  },

  /**
   * Update project evaluation weights
   */
  async updateProjectWeights(projectId: number, data: ProjectWeightUpdate): Promise<ProjectWeightResponse> {
    const response = await api.put(`/scoring/projects/${projectId}/weights`, data)
    return response.data
  },

  // ============================================================================
  // Reviewer Evaluations
  // ============================================================================

  /**
   * Get all reviewer evaluations for an application
   */
  async getApplicationEvaluations(applicationId: number): Promise<ReviewerEvaluationResponse[]> {
    const response = await api.get(`/scoring/applications/${applicationId}/evaluations`)
    return response.data
  },

  /**
   * Get my evaluation for an application (current user)
   */
  async getMyEvaluation(applicationId: number): Promise<ReviewerEvaluationResponse | null> {
    try {
      const response = await api.get(`/scoring/applications/${applicationId}/evaluations/my`)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Create a new reviewer evaluation
   */
  async createEvaluation(applicationId: number, data: ReviewerEvaluationCreate): Promise<ReviewerEvaluationResponse> {
    const response = await api.post(`/scoring/applications/${applicationId}/evaluations`, data)
    return response.data
  },

  /**
   * Update an existing reviewer evaluation
   */
  async updateEvaluation(applicationId: number, evaluationId: number, data: ReviewerEvaluationUpdate): Promise<ReviewerEvaluationResponse> {
    const response = await api.put(`/scoring/applications/${applicationId}/evaluations/${evaluationId}`, data)
    return response.data
  },

  /**
   * Delete a reviewer evaluation
   */
  async deleteEvaluation(applicationId: number, evaluationId: number): Promise<void> {
    await api.delete(`/scoring/applications/${applicationId}/evaluations/${evaluationId}`)
  },

  // ============================================================================
  // Selection
  // ============================================================================

  /**
   * Get selection recommendations for a project
   */
  async getSelectionRecommendations(projectId: number): Promise<SelectionRecommendationResult> {
    const response = await api.post(`/scoring/projects/${projectId}/recommend-selection`)
    return response.data
  },

  /**
   * Update selection result for a single application
   */
  async updateSelectionResult(applicationId: number, data: SelectionDecision): Promise<any> {
    const response = await api.put(`/scoring/applications/${applicationId}/selection`, data)
    return response.data
  },

  /**
   * Bulk confirm selection for multiple applications
   */
  async confirmBulkSelection(projectId: number, data: BulkSelectionRequest): Promise<BulkSelectionResult> {
    const response = await api.post(`/scoring/projects/${projectId}/confirm-selection`, data)
    return response.data
  },

  // ============================================================================
  // Dashboard Data
  // ============================================================================

  /**
   * Get review dashboard statistics for a project
   */
  async getReviewDashboardStats(projectId: number): Promise<ReviewDashboardStats> {
    const response = await api.get(`/scoring/projects/${projectId}/dashboard-stats`)
    return response.data
  },

  /**
   * Get all applications with scores for review dashboard
   */
  async getApplicationsWithScores(projectId: number): Promise<ApplicationWithScores[]> {
    const response = await api.get(`/scoring/projects/${projectId}/applications-with-scores`)
    return response.data
  }
}

export default scoringService
