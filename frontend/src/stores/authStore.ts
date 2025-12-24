import { create } from 'zustand'
import { User } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  hasRole: (role: string | string[]) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (loading) => set({ isLoading: loading }),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  hasRole: (role) => {
    const { user } = get()
    if (!user) return false
    const userRoles = JSON.parse(user.roles) as string[]
    if (Array.isArray(role)) {
      return role.some(r => userRoles.includes(r))
    }
    return userRoles.includes(role)
  },
}))
