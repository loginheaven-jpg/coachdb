import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import projectService, {
  ProjectDetail,
  ProjectUpdate,
  ScoreValidation,
  ProjectStaffResponse,
  ProjectStatus
} from '../services/projectService'
import { message } from 'antd'

// ============================================================================
// Types
// ============================================================================
interface ProjectEditContextValue {
  // 데이터
  project: ProjectDetail | null
  scoreValidation: ScoreValidation | null
  staffList: ProjectStaffResponse[]

  // 로딩 상태
  loading: boolean
  saving: boolean
  finalizing: boolean

  // 모드
  isCreateMode: boolean
  projectId: number | null

  // 유효성
  canFinalize: boolean

  // 액션
  loadProject: () => Promise<void>
  loadScoreValidation: () => Promise<void>
  loadStaffList: () => Promise<void>
  saveProject: (data: ProjectUpdate, asDraft?: boolean) => Promise<boolean>
  submitForApproval: () => Promise<boolean>
  setProject: (project: ProjectDetail | null) => void

  // 탭 상태
  activeTab: string
  setActiveTab: (tab: string) => void

  // 모집 시작 여부 (탭 가시성 결정)
  isRecruitmentStarted: boolean
}

// ============================================================================
// Context
// ============================================================================
const ProjectEditContext = createContext<ProjectEditContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================
interface ProjectEditProviderProps {
  projectId: number | null
  children: ReactNode
}

export function ProjectEditProvider({ projectId, children }: ProjectEditProviderProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [scoreValidation, setScoreValidation] = useState<ScoreValidation | null>(null)
  const [staffList, setStaffList] = useState<ProjectStaffResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [activeTab, setActiveTab] = useState('info')

  const isCreateMode = projectId === null

  // 모집 시작 여부 판단
  const isRecruitmentStarted = useMemo(() => {
    if (!project) return false
    const recruitmentStatuses = ['ready', 'recruiting', 'reviewing', 'in_progress', 'evaluating', 'closed']
    if (recruitmentStatuses.includes(project.status)) return true
    // 날짜 기준 체크 (모집시작일이 지났으면)
    const today = new Date()
    const startDate = new Date(project.recruitment_start_date)
    return startDate <= today
  }, [project])

  // 생성완료 가능 여부
  const canFinalize = useMemo(() => {
    return (scoreValidation?.is_valid === true) && (staffList.length > 0)
  }, [scoreValidation, staffList])

  // 프로젝트 로드
  const loadProject = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await projectService.getProject(projectId)
      setProject(data)
    } catch (error: any) {
      console.error('과제 로드 실패:', error)
      message.error('과제 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 점수 검증 로드
  const loadScoreValidation = useCallback(async () => {
    if (!projectId) return
    try {
      const validation = await projectService.validateProjectScore(projectId)
      setScoreValidation(validation)
    } catch (error) {
      console.error('점수 검증 실패:', error)
    }
  }, [projectId])

  // 심사위원 목록 로드
  const loadStaffList = useCallback(async () => {
    if (!projectId) return
    try {
      const response = await projectService.getProjectStaff(projectId)
      setStaffList(response.staff_list)
    } catch (error) {
      console.error('심사위원 목록 로드 실패:', error)
    }
  }, [projectId])

  // 프로젝트 저장 (임시저장)
  const saveProject = useCallback(async (data: ProjectUpdate, asDraft = true): Promise<boolean> => {
    if (!projectId) return false
    setSaving(true)
    try {
      if (asDraft) {
        data.status = ProjectStatus.DRAFT
      }
      await projectService.updateProject(projectId, data)
      message.success(asDraft ? '임시저장 되었습니다.' : '저장되었습니다.')
      await loadProject()
      return true
    } catch (error: any) {
      console.error('저장 실패:', error)
      message.error(error.response?.data?.detail || '저장에 실패했습니다.')
      return false
    } finally {
      setSaving(false)
    }
  }, [projectId, loadProject])

  // 생성완료 (승인 요청)
  const submitForApproval = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false
    setFinalizing(true)
    try {
      // pending 상태로 변경하여 승인 요청
      await projectService.updateProject(projectId, { status: ProjectStatus.PENDING })
      message.success('생성완료! 관리자 승인을 기다려주세요.')
      await loadProject()
      return true
    } catch (error: any) {
      console.error('승인 요청 실패:', error)
      message.error(error.response?.data?.detail || '승인 요청에 실패했습니다.')
      return false
    } finally {
      setFinalizing(false)
    }
  }, [projectId, loadProject])

  const value: ProjectEditContextValue = {
    project,
    scoreValidation,
    staffList,
    loading,
    saving,
    finalizing,
    isCreateMode,
    projectId,
    canFinalize,
    loadProject,
    loadScoreValidation,
    loadStaffList,
    saveProject,
    submitForApproval,
    setProject,
    activeTab,
    setActiveTab,
    isRecruitmentStarted
  }

  return (
    <ProjectEditContext.Provider value={value}>
      {children}
    </ProjectEditContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================
export function useProjectEdit() {
  const context = useContext(ProjectEditContext)
  if (!context) {
    throw new Error('useProjectEdit must be used within a ProjectEditProvider')
  }
  return context
}

export default ProjectEditContext
