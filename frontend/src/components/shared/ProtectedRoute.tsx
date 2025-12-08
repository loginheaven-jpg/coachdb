import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { UserRole } from '../../types'
import { Spin } from 'antd'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore()

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Check role if specified
  if (allowedRoles) {
    try {
      const userRoles = JSON.parse(user.roles)
      const hasAllowedRole = allowedRoles.some(allowedRole =>
        userRoles.includes(allowedRole)
      )
      if (!hasAllowedRole) {
        return <Navigate to="/unauthorized" replace />
      }
    } catch {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <>{children}</>
}
