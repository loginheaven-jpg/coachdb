import api from './api'

// ============================================================================
// Type Definitions
// ============================================================================
export interface VerificationRecordResponse {
  record_id: number
  competency_id: number
  verifier_id: number
  verifier_name: string | null
  verified_at: string
  is_valid: boolean
}

export interface ActivityRecord {
  activity_type: 'confirm' | 'supplement_request' | 'reset'
  actor_name: string
  message: string | null
  created_at: string
  is_valid: boolean
}

export interface CompetencyVerificationStatus {
  competency_id: number
  user_id: number
  user_name: string | null
  item_id: number
  item_name: string | null
  value: string | null
  file_id: number | null
  file_info?: {
    file_id: number
    original_filename: string
    file_size: number
    mime_type: string
    uploaded_at: string
  } | null
  is_globally_verified: boolean
  globally_verified_at: string | null
  verification_count: number
  required_count: number
  records: VerificationRecordResponse[]
  activities: ActivityRecord[]
  my_verification: VerificationRecordResponse | null
}

export interface PendingVerificationItem {
  competency_id: number
  user_id: number
  user_name: string
  user_email: string
  item_id: number
  item_name: string
  item_code: string
  value: string | null
  file_id: number | null
  file_info?: {
    file_id: number
    original_filename: string
    file_size: number
    mime_type: string
    uploaded_at: string
  } | null
  created_at: string
  verification_count: number
  required_count: number
  my_verification: VerificationRecordResponse | null
  verification_status: string | null  // 'pending' | 'rejected'
  rejection_reason: string | null
}

export interface VerificationConfirmRequest {
  competency_id: number
}

export interface VerificationResetRequest {
  competency_id: number
  reason?: string
}

export interface VerificationSupplementRequest {
  reason: string
}

// ============================================================================
// API Service
// ============================================================================
const verificationService = {
  /**
   * 검증 대기 중인 증빙 목록 조회
   */
  async getPendingVerifications(): Promise<PendingVerificationItem[]> {
    const response = await api.get<PendingVerificationItem[]>('/verifications/pending')
    return response.data
  },

  /**
   * 특정 증빙의 검증 상태 조회
   */
  async getVerificationStatus(competencyId: number): Promise<CompetencyVerificationStatus> {
    const response = await api.get<CompetencyVerificationStatus>(`/verifications/${competencyId}`)
    return response.data
  },

  /**
   * 증빙 컨펌
   */
  async confirmVerification(competencyId: number): Promise<VerificationRecordResponse> {
    const response = await api.post<VerificationRecordResponse>('/verifications/confirm', {
      competency_id: competencyId
    })
    return response.data
  },

  /**
   * 컨펌 취소
   */
  async cancelVerification(recordId: number): Promise<void> {
    await api.delete(`/verifications/${recordId}`)
  },

  /**
   * 증빙 검증 리셋 (관리자 전용)
   */
  async resetVerification(competencyId: number, reason?: string): Promise<void> {
    await api.post(`/verifications/${competencyId}/reset`, {
      competency_id: competencyId,
      reason
    })
  },

  /**
   * 증빙 보완 요청
   * - Verifier가 증빙이 불충분하다고 판단할 때 사용
   * - 기존 컨펌 기록 무효화 + 상태를 REJECTED로 변경
   * - 코치에게 알림 발송
   */
  async requestSupplement(competencyId: number, reason: string): Promise<void> {
    await api.post(`/verifications/${competencyId}/request-supplement`, {
      reason
    })
  }
}

export default verificationService
