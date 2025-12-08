import api from './api'

export interface EducationHistory {
  education_id: number
  user_id: number
  education_name: string
  institution?: string
  completion_date?: string
  hours?: number
  certificate_file_id?: number
  created_at: string
  updated_at?: string
}

export interface EducationHistoryCreate {
  education_name: string
  institution?: string
  completion_date?: string | null
  hours?: number | null
  certificate_file_id?: number | null
}

export interface EducationHistoryUpdate {
  education_name?: string
  institution?: string
  completion_date?: string | null
  hours?: number | null
  certificate_file_id?: number | null
}

const educationService = {
  /**
   * Get current user's education history
   */
  async getMyEducationHistory(): Promise<EducationHistory[]> {
    const response = await api.get('/education-history/my')
    return response.data
  },

  /**
   * Create a new education history entry
   */
  async createEducationHistory(data: EducationHistoryCreate): Promise<EducationHistory> {
    const response = await api.post('/education-history/', data)
    return response.data
  },

  /**
   * Update an existing education history entry
   */
  async updateEducationHistory(id: number, data: EducationHistoryUpdate): Promise<EducationHistory> {
    const response = await api.put(`/education-history/${id}`, data)
    return response.data
  },

  /**
   * Delete an education history entry
   */
  async deleteEducationHistory(id: number): Promise<void> {
    await api.delete(`/education-history/${id}`)
  }
}

export default educationService
