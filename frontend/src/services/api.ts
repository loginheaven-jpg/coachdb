import axios, { AxiosInstance, AxiosError } from 'axios'

// Determine API base URL - use direct backend URL for better reliability
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    console.log('[API Interceptor] Success response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      data: response.data
    })
    return response
  },
  async (error: AxiosError) => {
    console.error('[API Interceptor] Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data,
      headers: error.response?.headers
    })

    const originalRequest = error.config as any

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          })

          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens but don't auto-redirect
        // Let individual pages handle the 401 error appropriately
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        // Only redirect to login if we're not already on login/register pages
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
          console.warn('인증 토큰이 만료되었습니다. 로그인 페이지로 이동합니다.')
          setTimeout(() => {
            window.location.href = '/login'
          }, 1000) // Give time for error messages to display
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
