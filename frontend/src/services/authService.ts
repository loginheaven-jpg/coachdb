import api from './api'
import { UserRole } from '../types'

export interface RegisterData {
  email: string
  password: string
  name: string
  phone?: string
  birth_year?: number  // 4-digit year
  gender?: string
  address: string  // Required now
  in_person_coaching_area?: string  // 대면코칭 가능지역
  roles?: string[]  // Multiple roles
  coach_certification_number?: string
  coaching_fields?: string[]  // Multiple coaching fields
}

export interface LoginData {
  email: string
  password: string
}

export interface UserResponse {
  user_id: number
  email: string
  name: string
  phone?: string
  birth_year?: number  // 4-digit year
  gender?: string
  address: string
  in_person_coaching_area?: string  // 대면코칭 가능지역
  roles: string  // JSON string of roles array
  status: string
  coach_certification_number?: string
  coaching_fields?: string  // JSON string of coaching fields
  created_at: string
  updated_at?: string
}

export interface UserUpdateData {
  name?: string
  phone?: string
  birth_year?: number
  gender?: string
  address?: string
  organization?: string  // 소속
  in_person_coaching_area?: string
  coach_certification_number?: string
  coaching_fields?: string[]
}

export interface AuthResponse {
  user: UserResponse
  access_token: string
  refresh_token: string
  token_type: string
  pending_roles?: string[]  // Roles awaiting admin approval
  profile_complete: boolean  // False if required profile fields (name) are missing
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

class AuthService {
  async register(data: RegisterData): Promise<AuthResponse> {
    console.log('[AuthService] Registering with data:', data)
    try {
      const response = await api.post<AuthResponse>('/auth/register', data)
      console.log('[AuthService] Registration response:', response.data)
      this.setTokens(response.data.access_token, response.data.refresh_token)
      return response.data
    } catch (error: any) {
      console.error('[AuthService] Registration error:', error)
      console.error('[AuthService] Error response:', error.response?.data)
      throw error
    }
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data)
    this.setTokens(response.data.access_token, response.data.refresh_token)
    return response.data
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } finally {
      this.clearTokens()
    }
  }

  async getCurrentUser(): Promise<UserResponse> {
    const response = await api.get<UserResponse>('/auth/me')
    return response.data
  }

  async changePassword(newPassword: string): Promise<{ message: string }> {
    const response = await api.put<{ message: string }>('/auth/change-password', {
      new_password: newPassword
    })
    return response.data
  }

  async updateProfile(data: UserUpdateData): Promise<UserResponse> {
    const response = await api.put<UserResponse>('/auth/profile', data)
    return response.data
  }

  async refreshToken(): Promise<TokenResponse> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await api.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken
    })

    this.setTokens(response.data.access_token, response.data.refresh_token)
    return response.data
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token')
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token')
  }

  clearTokens(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken()
  }
}

export default new AuthService()
