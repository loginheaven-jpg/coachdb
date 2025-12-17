import api from './api'

// Types for detailed profile
export interface DegreeItem {
  type: 'coaching' | 'other'
  degreeLevel?: 'bachelor' | 'master' | 'doctorate' | 'none'
  degreeName?: string
  file_id?: number
}

export interface CertificationItem {
  name: string
  type: 'KCA' | 'COUNSELING'
  file_id?: number
}

export interface MentoringExperienceItem {
  description: string
  file_id?: number
}

export interface FieldExperience {
  coaching_history?: string
  certifications?: string
  historyFiles?: number[]
  certFiles?: number[]
}

export interface DetailedProfile {
  profile_id?: number
  user_id: number
  total_coaching_hours?: number
  coaching_years?: number
  specialty?: string
  degrees?: DegreeItem[]
  certifications?: CertificationItem[]
  mentoring_experiences?: MentoringExperienceItem[]
  field_experiences?: Record<string, FieldExperience>
}

export interface DetailedProfileUpdateRequest {
  total_coaching_hours?: number
  coaching_years?: number
  specialty?: string
  degrees?: DegreeItem[]
  certifications?: CertificationItem[]
  mentoring_experiences?: MentoringExperienceItem[]
  field_experiences?: Record<string, FieldExperience>
}

class ProfileService {
  /**
   * Get current user's detailed profile
   */
  async getDetailedProfile(): Promise<DetailedProfile> {
    const response = await api.get<DetailedProfile>('/profile/detailed')
    return response.data
  }

  /**
   * Update current user's detailed profile
   */
  async updateDetailedProfile(data: DetailedProfileUpdateRequest): Promise<DetailedProfile> {
    const response = await api.put<DetailedProfile>('/profile/detailed', data)
    return response.data
  }
}

export default new ProfileService()
