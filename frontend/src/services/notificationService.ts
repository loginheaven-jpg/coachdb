import api from './api'

export interface Notification {
  notification_id: number
  user_id: number
  type: string
  title: string
  message: string | null
  related_application_id: number | null
  related_project_id: number | null
  related_data_id: number | null
  related_competency_id: number | null  // 증빙 검증 관련
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface UnreadCountResponse {
  count: number
}

class NotificationService {
  async getMyNotifications(unreadOnly: boolean = false, limit: number = 50): Promise<Notification[]> {
    const response = await api.get<Notification[]>('/notifications/my', {
      params: { unread_only: unreadOnly, limit }
    })
    return response.data
  }

  async getUnreadCount(): Promise<number> {
    const response = await api.get<UnreadCountResponse>('/notifications/unread-count')
    return response.data.count
  }

  async markAsRead(notificationId: number): Promise<Notification> {
    const response = await api.put<Notification>(`/notifications/${notificationId}/read`)
    return response.data
  }

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all')
  }
}

export default new NotificationService()
