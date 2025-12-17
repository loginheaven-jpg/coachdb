import api from './api'

// Types
export enum CertificationType {
  COACH = 'coach',
  COUNSELING = 'counseling',
  OTHER = 'other'
}

export interface CertificationBase {
  certification_type: CertificationType
  certification_name: string
  issuing_organization?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  certificate_number?: string | null
  certificate_file_id?: number | null
}

export interface CertificationCreate extends CertificationBase {}

export interface CertificationUpdate {
  certification_name?: string
  issuing_organization?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  certificate_number?: string | null
  certificate_file_id?: number | null
}

export interface Certification extends CertificationBase {
  certification_id: number
  user_id: number
  verification_status: string
  created_at: string
  updated_at?: string | null
  certificate_file?: any
}

export interface CertificationListItem {
  certification_id: number
  certification_type: CertificationType
  certification_name: string
  issuing_organization?: string | null
  issue_date?: string | null
  verification_status: string
  has_file: boolean
}

// Service
const certificationService = {
  async createCertification(data: CertificationCreate): Promise<Certification> {
    const response = await api.post('/certifications', data)
    return response.data
  },

  async getMyCertifications(): Promise<CertificationListItem[]> {
    const response = await api.get('/certifications/me')
    return response.data
  },

  async getCertification(certificationId: number): Promise<Certification> {
    const response = await api.get(`/certifications/${certificationId}`)
    return response.data
  },

  async updateCertification(certificationId: number, data: CertificationUpdate): Promise<Certification> {
    const response = await api.put(`/certifications/${certificationId}`, data)
    return response.data
  },

  async deleteCertification(certificationId: number): Promise<void> {
    await api.delete(`/certifications/${certificationId}`)
  }
}

export default certificationService
