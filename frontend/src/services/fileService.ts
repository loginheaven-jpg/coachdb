import api from './api'
import { UploadFile } from 'antd'

export interface FileUploadResponse {
  file_id: number
  original_filename: string
  stored_filename: string
  file_size: number
  mime_type: string
  upload_purpose: string
  uploaded_at: string
}

export interface FileInfo {
  file_id: number
  original_filename: string
  file_size: number
  mime_type: string
  uploaded_at: string
  uploaded_by: number
}

class FileService {
  /**
   * Upload a file
   */
  async uploadFile(file: File, purpose: 'proof' | 'profile' | 'other' = 'proof'): Promise<FileUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('purpose', purpose)

    const response = await api.post<FileUploadResponse>('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: number): Promise<Blob> {
    const response = await api.get(`/files/${fileId}`, {
      responseType: 'blob',
    })

    return response.data
  }

  /**
   * Get file info
   */
  async getFileInfo(fileId: number): Promise<FileInfo> {
    const response = await api.get<FileInfo>(`/files/${fileId}/info`)
    return response.data
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: number): Promise<void> {
    await api.delete(`/files/${fileId}`)
  }

  /**
   * Helper: Convert Ant Design UploadFile to actual File for upload
   */
  getFileFromUpload(uploadFile: UploadFile): File | null {
    if (uploadFile.originFileObj) {
      return uploadFile.originFileObj as File
    }
    return null
  }

  /**
   * Helper: Download file and trigger browser download
   */
  async downloadAndSave(fileId: number, filename: string): Promise<void> {
    const blob = await this.downloadFile(fileId)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}

const fileService = new FileService()
export default fileService
