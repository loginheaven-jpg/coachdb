import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfileEditPage from './pages/ProfileEditPage'
import UnifiedCompetencyPage from './pages/UnifiedCompetencyPage'
import MyApplicationsPage from './pages/MyApplicationsPage'
import DashboardPage from './pages/DashboardPage'
import CoachDashboard from './pages/CoachDashboard'
import StaffDashboard from './pages/StaffDashboard'
import AdminDashboard from './pages/AdminDashboard'
import ProjectListPage from './pages/ProjectListPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectManagePage from './pages/ProjectManagePage'
import ProjectUnifiedPage from './pages/ProjectUnifiedPage'
import ProjectWizard from './pages/project/wizard/ProjectWizard'
import EvaluationDashboard from './pages/EvaluationDashboard'
import ProjectEvaluationCreatePage from './pages/ProjectEvaluationCreatePage'
import ApplicationSubmitPage from './pages/ApplicationSubmitPage'
import AdminCompetencyItemsPage from './pages/AdminCompetencyItemsPage'
import UserManagementPage from './pages/UserManagementPage'
import VerificationPage from './pages/VerificationPage'
import SystemSettingsPage from './pages/SystemSettingsPage'
import ProtectedRoute from './components/shared/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import { useAuthStore } from './stores/authStore'
import authService from './services/authService'

// 레거시 라우트 리다이렉트 컴포넌트
function LegacyProjectRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/projects/manage/${projectId}?tab=info`} replace />
}

function LegacyProjectEditRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/projects/manage/${projectId}?tab=info`} replace />
}

function LegacyProjectApplicationsRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/projects/manage/${projectId}?tab=applications`} replace />
}

function LegacyProjectReviewRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/projects/manage/${projectId}?tab=selection`} replace />
}

function LegacyApplyRedirect() {
  const { projectId } = useParams()
  // 쿼리 파라미터 유지를 위해 window.location.search 사용
  const search = typeof window !== 'undefined' ? window.location.search : ''
  return <Navigate to={`/projects/${projectId}/apply${search}`} replace />
}

// 관리자 역할 목록 (새 역할 + 레거시)
const ADMIN_ROLES = ['SUPER_ADMIN', 'PROJECT_MANAGER', 'VERIFIER', 'REVIEWER', 'admin', 'staff']
// 코치 역할 목록
const COACH_ROLES = ['COACH', 'coach']
// 모든 인증된 사용자
const ALL_ROLES = [...ADMIN_ROLES, ...COACH_ROLES]

// Helper function to get default dashboard based on user roles
function getDefaultDashboard(roles: string): string {
  try {
    const userRoles = JSON.parse(roles) as string[]
    // All authenticated users go to unified dashboard
    if (userRoles.length > 0) return '/dashboard'
    return '/login'
  } catch {
    return '/login'
  }
}

function App() {
  const { setUser, setLoading, isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    // Check if user is already logged in
    const loadUser = async () => {
      try {
        // isAuthenticated가 이미 true면 사용자가 이미 로드된 것이므로 스킵
        if (isAuthenticated) {
          console.log('[App] 사용자가 이미 인증됨, 로드 건너뜀')
          setLoading(false)
          return
        }

        console.log('[App] 토큰 존재 여부:', authService.isAuthenticated())
        console.log('[App] access_token:', localStorage.getItem('access_token'))
        if (authService.isAuthenticated()) {
          const user = await authService.getCurrentUser()
          console.log('[App] 로드된 사용자:', user)
          setUser(user)
        } else {
          console.log('[App] 토큰이 없어 사용자 로드를 건너뜁니다')
        }
      } catch (error) {
        console.error('[App] Failed to load user:', error)
        authService.clearTokens()
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [setUser, setLoading, isAuthenticated])

  return (
    <AppLayout>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Profile management - Protected (requires authentication) */}
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <ProfileEditPage />
            </ProtectedRoute>
          }
        />

        {/* Unified Dashboard - accessible to all authenticated users */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Protected routes - Coach */}
        <Route
          path="/coach/dashboard"
          element={
            <ProtectedRoute allowedRoles={COACH_ROLES}>
              <CoachDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach/competencies"
          element={
            <ProtectedRoute allowedRoles={COACH_ROLES}>
              <UnifiedCompetencyPage />
            </ProtectedRoute>
          }
        />
        {/* Legacy routes - redirect to new paths */}
        <Route
          path="/coach/my-applications"
          element={<Navigate to="/my-applications" replace />}
        />
        <Route
          path="/coach/projects"
          element={<Navigate to="/projects" replace />}
        />
        <Route
          path="/coach/projects/:projectId/apply"
          element={<LegacyApplyRedirect />}
        />
        <Route
          path="/profile/detailed"
          element={<Navigate to="/coach/competencies" replace />}
        />

        {/* ===== 과제참여 (Participate) ===== */}
        {/* 과제참여 목록 - 모집중 과제 */}
        <Route
          path="/projects"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <ProjectListPage />
            </ProtectedRoute>
          }
        />
        {/* 과제 상세보기 (복사 버튼 포함) */}
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
        {/* 과제 지원 페이지 */}
        <Route
          path="/projects/:projectId/apply"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <ApplicationSubmitPage />
            </ProtectedRoute>
          }
        />

        {/* ===== 내 지원서 ===== */}
        <Route
          path="/my-applications"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <MyApplicationsPage />
            </ProtectedRoute>
          }
        />

        {/* ===== 과제심사 (Evaluations) ===== */}
        {/* 심사자로 배정된 과제 목록 */}
        <Route
          path="/evaluations"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'REVIEWER']}>
              <EvaluationDashboard />
            </ProtectedRoute>
          }
        />

        {/* ===== 과제관리 (Manage) ===== */}
        {/* 과제관리 목록 - 본인 과제 (수퍼어드민은 전체) */}
        <Route
          path="/projects/manage"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <ProjectManagePage />
            </ProtectedRoute>
          }
        />
        {/* 새 과제 생성 - ProjectUnifiedPage (create mode) */}
        <Route
          path="/projects/create"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <ProjectUnifiedPage />
            </ProtectedRoute>
          }
        />
        {/* 과제 생성 위저드 */}
        <Route
          path="/projects/wizard"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <ProjectWizard />
            </ProtectedRoute>
          }
        />
        {/* 과제 상세/수정 - ProjectUnifiedPage (edit mode) */}
        <Route
          path="/projects/manage/:projectId"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <ProjectUnifiedPage />
            </ProtectedRoute>
          }
        />
        {/* 레거시 라우트 리다이렉트 */}
        <Route
          path="/projects/manage/:projectId/edit"
          element={<LegacyProjectEditRedirect />}
        />
        <Route
          path="/projects/manage/:projectId/applications"
          element={<LegacyProjectApplicationsRedirect />}
        />
        <Route
          path="/projects/manage/:projectId/review"
          element={<LegacyProjectReviewRedirect />}
        />

        {/* Protected routes - Staff */}
        <Route
          path="/staff/dashboard"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected routes - Admin */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        {/* Legacy admin projects routes - redirect to new paths */}
        <Route
          path="/admin/projects"
          element={<Navigate to="/projects/manage" replace />}
        />
        <Route
          path="/admin/projects/create"
          element={<Navigate to="/projects/create" replace />}
        />
        <Route
          path="/admin/projects/:projectId"
          element={<LegacyProjectRedirect />}
        />
        <Route
          path="/admin/projects/:projectId/edit"
          element={<LegacyProjectEditRedirect />}
        />
        <Route
          path="/admin/projects/:projectId/applications"
          element={<LegacyProjectApplicationsRedirect />}
        />
        {/* 평가 생성 - 새 경로 */}
        <Route
          path="/projects/manage/:projectId/evaluations/create"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <ProjectEvaluationCreatePage />
            </ProtectedRoute>
          }
        />
        {/* Legacy 평가 생성 */}
        <Route
          path="/admin/projects/:projectId/evaluations/create"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <ProjectEvaluationCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/competency-items"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <AdminCompetencyItemsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/verifications"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'PROJECT_MANAGER', 'VERIFIER']}>
              <VerificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <SystemSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Default route */}
        <Route
          path="/"
          element={
            isAuthenticated && user ? (
              <Navigate to={getDefaultDashboard(user.roles)} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Unauthorized */}
        <Route
          path="/unauthorized"
          element={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-red-600 mb-4">403</h1>
                <p className="text-xl">권한이 없습니다</p>
              </div>
            </div>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <Navigate to={isAuthenticated && user ? getDefaultDashboard(user.roles) : "/login"} replace />
          }
        />
      </Routes>
    </AppLayout>
  )
}

export default App
