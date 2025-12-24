import api from './api'

// ============================================================================
// Type Definitions
// ============================================================================
export interface SystemConfig {
  key: string
  value: string
  description: string | null
  updated_at: string | null
  updated_by: number | null
}

export interface UserListItem {
  user_id: number
  email: string
  name: string
  roles: string[]
  status: string
  created_at: string | null
}

export interface UserDetail {
  user_id: number
  email: string
  name: string
  phone: string | null
  roles: string[]
  status: string
  created_at: string | null
  birth_year: number | null
  gender: string | null
  address: string | null
}

export interface UserRoleUpdate {
  roles: string[]
}

export interface RoleRequest {
  request_id: number
  user_id: number
  user_name: string
  user_email: string
  user_phone: string | null
  requested_role: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requested_at: string | null
  processed_at: string | null
  processed_by: number | null
  processor_name: string | null
  rejection_reason: string | null
}

export interface RoleRequestCount {
  pending_count: number
}

// ============================================================================
// Available Roles
// ============================================================================
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  REVIEWER: 'REVIEWER',
  VERIFIER: 'VERIFIER',
  COACH: 'COACH'
} as const

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '어드민',
  PROJECT_MANAGER: '과제관리자',
  REVIEWER: '심사자',
  VERIFIER: '검토자',
  COACH: '응모자'
}

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'red',
  PROJECT_MANAGER: 'blue',
  REVIEWER: 'orange',
  VERIFIER: 'green',
  COACH: 'default'
}

// ============================================================================
// Config Keys
// ============================================================================
export const CONFIG_KEYS = {
  REQUIRED_VERIFIER_COUNT: 'required_verifier_count'
} as const

// ============================================================================
// API Service
// ============================================================================
const adminService = {
  // System Config
  async getConfigs(): Promise<SystemConfig[]> {
    const response = await api.get<SystemConfig[]>('/admin/config')
    return response.data
  },

  async getConfig(key: string): Promise<SystemConfig> {
    const response = await api.get<SystemConfig>(`/admin/config/${key}`)
    return response.data
  },

  async updateConfig(key: string, value: string): Promise<SystemConfig> {
    const response = await api.put<SystemConfig>(`/admin/config/${key}`, { value })
    return response.data
  },

  async updateConfigsBulk(configs: Record<string, string>): Promise<SystemConfig[]> {
    const response = await api.put<SystemConfig[]>('/admin/config', { configs })
    return response.data
  },

  // User Management
  async getUsers(params?: { role?: string; search?: string }): Promise<UserListItem[]> {
    const response = await api.get<UserListItem[]>('/admin/users', { params })
    return response.data
  },

  async getUser(userId: number): Promise<UserDetail> {
    const response = await api.get<UserDetail>(`/admin/users/${userId}`)
    return response.data
  },

  async updateUserRoles(userId: number, roles: string[]): Promise<UserDetail> {
    const response = await api.put<UserDetail>(`/admin/users/${userId}/roles`, { roles })
    return response.data
  },

  // Role Request Management
  async getRoleRequests(status?: string): Promise<RoleRequest[]> {
    const params = status ? { status_filter: status } : undefined
    const response = await api.get<RoleRequest[]>('/admin/role-requests', { params })
    return response.data
  },

  async getPendingRoleRequestsCount(): Promise<RoleRequestCount> {
    const response = await api.get<RoleRequestCount>('/admin/role-requests/count')
    return response.data
  },

  async approveRoleRequest(requestId: number): Promise<RoleRequest> {
    const response = await api.post<RoleRequest>(`/admin/role-requests/${requestId}/approve`)
    return response.data
  },

  async rejectRoleRequest(requestId: number, reason: string): Promise<RoleRequest> {
    const response = await api.post<RoleRequest>(`/admin/role-requests/${requestId}/reject`, { reason })
    return response.data
  }
}

export default adminService
