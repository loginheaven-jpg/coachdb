import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  message,
  Space,
  Select,
  Spin,
  InputNumber,
  Upload,
  Alert,
  Tag,
  Descriptions,
  Modal,
  Tabs
} from 'antd'
import { ArrowLeftOutlined, SendOutlined, UploadOutlined, InfoCircleOutlined, UserOutlined, CheckCircleOutlined, SaveOutlined, DeleteOutlined, LoadingOutlined, EditOutlined, ClockCircleOutlined, DownloadOutlined, CloseCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, PlusOutlined, InboxOutlined, EyeOutlined } from '@ant-design/icons'
import projectService, { ProjectDetail, ProjectItem, ItemTemplate } from '../services/projectService'
import applicationService, { ApplicationSubmitRequest, ApplicationDataSubmit, ApplicationData } from '../services/applicationService'
import authService, { UserUpdateData } from '../services/authService'
import fileService from '../services/fileService'
import profileService, { DetailedProfile } from '../services/profileService'
import competencyService, { CoachCompetency } from '../services/competencyService'
import { useAuthStore } from '../stores/authStore'
import FilePreviewModal, { useFilePreview } from '../components/FilePreviewModal'
import dayjs from 'dayjs'

// 프로필 데이터와 매핑되는 설문 항목 코드
const PROFILE_MAPPED_ITEM_CODES = {
  'EXP_COACHING_HOURS': 'total_coaching_hours',
  'EXP_COACHING_YEARS': 'coaching_years',
  'SPECIALTY': 'specialty'
}

const { Title, Text } = Typography
const { TextArea } = Input

// 파일 업로드 설정
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const BLOCKED_FILE_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.com', '.dll', '.scr',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.psm1', '.psd1', '.sh', '.bash', '.bin', '.app',
  '.jar', '.msc', '.reg', '.pif', '.gadget', '.hta', '.inf', '.cpl'
]

// 업로드된 파일 정보 타입
interface UploadedFileInfo {
  file?: File  // 새로 업로드한 경우에만 존재
  file_id?: number
  filename?: string  // 기존 파일의 원본 파일명
  file_size?: number  // 기존 파일의 크기
  uploading?: boolean
  error?: string
}

// 사용자 프로필 항목 코드 (설문에서 제외됨 - 개인정보는 프로필에서 표시)
const USER_PROFILE_ITEM_CODES = [
  'BASIC_NAME', 'BASIC_PHONE', 'BASIC_EMAIL', 'BASIC_ADDRESS',
  'BASIC_GENDER', 'BASIC_BIRTHDATE', 'DETAIL_COACHING_AREA', 'DETAIL_CERT_NUMBER'
]

export default function ApplicationSubmitPage() {
  // Debug: Log when component renders
  console.log('[ApplicationSubmitPage] Component rendering - v2')

  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const applicationIdParam = searchParams.get('applicationId')
  const modeParam = searchParams.get('mode') || 'edit' // 'view' or 'edit'
  const isViewMode = modeParam === 'view'
  const isEditMode = !!applicationIdParam

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([])
  const [profileChanged, setProfileChanged] = useState(false)
  const [repeatableData, setRepeatableData] = useState<Record<number, any[]>>({})
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFileInfo>>({})

  // Debug: Track repeatableData changes
  useEffect(() => {
    console.log('[ApplicationSubmitPage] repeatableData changed:', JSON.stringify(repeatableData))
  }, [repeatableData])
  const [existingApplicationId, setExistingApplicationId] = useState<number | null>(null)
  const [existingApplication, setExistingApplication] = useState<any>(null)
  const [linkedCompetencyData, setLinkedCompetencyData] = useState<Record<number, ApplicationData>>({})
  const [_detailedProfile, setDetailedProfile] = useState<DetailedProfile | null>(null)

  // 모달 상태
  const [isItemModalVisible, setIsItemModalVisible] = useState(false)
  const [editingProjectItemId, setEditingProjectItemId] = useState<number | null>(null)
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null)
  const [modalForm] = Form.useForm()
  const [modalFileList, setModalFileList] = useState<any[]>([])
  const [modalFileId, setModalFileId] = useState<number | null>(null)
  const [modalUploading, setModalUploading] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  // 파일 미리보기 상태
  const { previewState, openPreview, closePreview } = useFilePreview()
  const [competenciesLoaded, setCompetenciesLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const { user, setUser } = useAuthStore()

  // 수정 모드로 전환
  const switchToEditMode = () => {
    const params = new URLSearchParams(searchParams)
    params.set('mode', 'edit')
    setSearchParams(params)
  }

  // 수정 가능 여부 (모집기간 내)
  const canEdit = () => {
    if (!project) return false
    const now = dayjs()
    const endDate = dayjs(project.recruitment_end_date).endOf('day')
    return now.isBefore(endDate) || now.isSame(endDate, 'day')
  }

  useEffect(() => {
    if (projectId) {
      loadProjectData()
    }
  }, [projectId])

  // 사용자 정보로 폼 초기화
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        profile_name: user.name,
        profile_phone: user.phone,
        profile_birth_year: user.birth_year,
        profile_gender: user.gender,
        profile_address: user.address,
        profile_in_person_coaching_area: user.in_person_coaching_area
      })
    }
  }, [user, form])

  // 세부정보 프로필 로드 및 설문 항목에 자동 채움 (한 번만 실행)
  useEffect(() => {
    // 이미 로드했거나, projectItems가 아직 없거나, 수정모드면 스킵
    if (profileLoaded || projectItems.length === 0 || isEditMode) {
      return
    }

    const loadDetailedProfile = async () => {
      try {
        const profile = await profileService.getDetailedProfile()
        setDetailedProfile(profile)
        setProfileLoaded(true)

        // 프로필로 자동 채움
        const formValues: Record<string, any> = {}

        projectItems.forEach(item => {
          const itemCode = item.competency_item?.item_code
          if (!itemCode) return

          // 프로필 매핑된 항목인지 확인
          const profileField = PROFILE_MAPPED_ITEM_CODES[itemCode as keyof typeof PROFILE_MAPPED_ITEM_CODES]
          if (profileField && profile) {
            const profileValue = (profile as any)[profileField]
            if (profileValue !== undefined && profileValue !== null) {
              formValues[`item_${item.project_item_id}`] = profileValue
            }
          }
        })

        if (Object.keys(formValues).length > 0) {
          form.setFieldsValue(formValues)
        }
      } catch (error) {
        console.error('세부정보 프로필 로드 실패:', error)
        setProfileLoaded(true) // 에러 시에도 재시도 방지
      }
    }

    loadDetailedProfile()
  }, [projectItems, isEditMode, profileLoaded])

  // 기존 역량 정보(세부정보)로 설문 항목 자동 채움 (신규 지원 시만)
  useEffect(() => {
    // 이미 로드했거나, projectItems가 아직 없거나, 수정모드면 스킵
    if (competenciesLoaded || projectItems.length === 0 || isEditMode) {
      return
    }

    const loadExistingCompetencies = async () => {
      try {
        console.log('[ApplicationSubmitPage] Loading existing competencies for pre-fill...')
        const competencies = await competencyService.getMyCompetencies()
        setCompetenciesLoaded(true)
        console.log('[ApplicationSubmitPage] Loaded competencies:', competencies.length)

        // 기존 역량이 없어도 repeatableData는 초기화해야 함
        if (competencies.length === 0) {
          console.log('[ApplicationSubmitPage] No existing competencies to pre-fill, initializing defaults')
          const defaultRepeatableData: Record<number, any[]> = {}
          projectItems.forEach(item => {
            if (item.competency_item?.is_repeatable) {
              // 빈 배열로 시작 (세부정보 화면과 동일하게)
              defaultRepeatableData[item.project_item_id] = []
            }
          })
          setRepeatableData(defaultRepeatableData)
          return
        }

        // 역량 데이터를 item_id로 매핑 (복수 항목 지원: 배열로 저장)
        const competencyMap = new Map<number, CoachCompetency[]>()
        competencies.forEach(c => {
          const existing = competencyMap.get(c.item_id) || []
          existing.push(c)
          competencyMap.set(c.item_id, existing)
        })

        // 폼 값과 repeatableData 초기화
        const formValues: Record<string, any> = {}
        const newRepeatableData: Record<number, any[]> = {}
        const newLinkedCompetencyData: Record<number, ApplicationData> = {}

        // 파일 정보도 uploadedFiles에 저장
        const newUploadedFiles: Record<string, UploadedFileInfo> = {}

        projectItems.forEach(item => {
          const itemId = item.competency_item?.item_id
          if (!itemId) return

          const isRepeatable = item.competency_item?.is_repeatable
          const existingComps = competencyMap.get(itemId) || []

          if (isRepeatable) {
            // 반복 가능 항목: 여러 CoachCompetency 레코드를 하나의 배열로 병합
            if (existingComps.length > 0) {
              const allEntries: any[] = []

              // 각 competency에서 entries와 file_info 추출
              existingComps.forEach((comp) => {
                if (comp.value) {
                  try {
                    const parsed = JSON.parse(comp.value)
                    if (Array.isArray(parsed)) {
                      // 배열인 경우 각 항목에 file_info 추가
                      parsed.forEach(entry => {
                        allEntries.push({
                          ...entry,
                          _file_info: comp.file_info ? {
                            file_id: comp.file_info.file_id,
                            original_filename: comp.file_info.original_filename,
                            file_size: comp.file_info.file_size,
                            mime_type: comp.file_info.mime_type
                          } : null
                        })
                      })
                    } else if (typeof parsed === 'object') {
                      allEntries.push({
                        ...parsed,
                        _file_info: comp.file_info ? {
                          file_id: comp.file_info.file_id,
                          original_filename: comp.file_info.original_filename,
                          file_size: comp.file_info.file_size,
                          mime_type: comp.file_info.mime_type
                        } : null
                      })
                    }
                  } catch {
                    // JSON이 아닌 경우 단순 값으로 처리
                    allEntries.push({
                      cert_name: comp.value,
                      _file_id: comp.file_id,
                      _file_info: comp.file_info ? {
                        file_id: comp.file_info.file_id,
                        original_filename: comp.file_info.original_filename,
                        file_size: comp.file_info.file_size,
                        mime_type: comp.file_info.mime_type
                      } : null
                    })
                  }
                }
              })

              if (allEntries.length > 0) {
                newRepeatableData[item.project_item_id] = allEntries
                console.log(`[Pre-fill] Repeatable item ${itemId} with ${allEntries.length} entries from ${existingComps.length} competencies`)

                // 각 entry의 파일 정보를 uploadedFiles에 저장
                allEntries.forEach((entry: any, idx: number) => {
                  const fileKey = `${item.project_item_id}_${idx}`
                  if (entry._file_info && entry._file_info.original_filename) {
                    newUploadedFiles[fileKey] = {
                      file_id: entry._file_info.file_id,
                      filename: entry._file_info.original_filename,
                      uploading: false
                    }
                    console.log(`[Pre-fill] File info for entry ${idx}: ${entry._file_info.original_filename}`)
                  } else if (entry._file_id) {
                    newUploadedFiles[fileKey] = {
                      file_id: entry._file_id,
                      uploading: false
                    }
                  }
                })
              } else {
                // 파싱된 항목이 없으면 빈 배열 (세부정보 화면과 동일)
                newRepeatableData[item.project_item_id] = []
              }
            } else {
              // 기존 데이터 없으면 빈 배열 (세부정보 화면과 동일)
              newRepeatableData[item.project_item_id] = []
            }
          } else if (existingComps.length > 0) {
            const existingComp = existingComps[0]  // 단일 항목은 첫 번째 사용
            // 일반 항목 - value와 file 정보 모두 처리
            if (existingComp.value) {
              try {
                // JSON인 경우 파싱
                const parsedValue = JSON.parse(existingComp.value)
                formValues[`item_${item.project_item_id}`] = parsedValue
                console.log(`[Pre-fill] Item ${itemId} with parsed JSON value`)
              } catch {
                // 일반 문자열
                formValues[`item_${item.project_item_id}`] = existingComp.value
                console.log(`[Pre-fill] Item ${itemId} with string value: ${existingComp.value}`)
              }
            }

            // 파일 정보도 linkedCompetencyData에 저장 (세부정보에서 가져온 파일)
            if (existingComp.file_info || existingComp.file_id) {
              newLinkedCompetencyData[item.project_item_id] = {
                data_id: 0,  // 신규 지원이므로 data_id 없음
                application_id: 0,
                item_id: itemId,
                competency_id: existingComp.competency_id,
                submitted_value: existingComp.value,
                submitted_file_id: null,
                verification_status: 'pending',
                item_score: null,
                reviewed_by: null,
                reviewed_at: null,
                rejection_reason: null,
                supplement_deadline: null,
                supplement_requested_at: null,
                // Linked competency 정보
                linked_competency_value: existingComp.value,
                linked_competency_file_id: existingComp.file_id,
                linked_competency_file_info: existingComp.file_info,
                linked_competency_verification_status: existingComp.verification_status
              }
              console.log(`[Pre-fill] Item ${itemId} file info loaded: file_id=${existingComp.file_id}`)
            }
          }
        })

        // 상태 업데이트 - 항상 설정 (신규 지원 시 초기화 역할)
        setRepeatableData(newRepeatableData)
        console.log('[ApplicationSubmitPage] RepeatableData initialized/pre-filled:', Object.keys(newRepeatableData).length, 'items')

        if (Object.keys(formValues).length > 0) {
          form.setFieldsValue(formValues)
          console.log('[ApplicationSubmitPage] Form pre-filled with', Object.keys(formValues).length, 'values')
        }

        // 파일 정보와 linkedCompetencyData 설정
        if (Object.keys(newLinkedCompetencyData).length > 0) {
          setLinkedCompetencyData(newLinkedCompetencyData)
          console.log('[ApplicationSubmitPage] LinkedCompetencyData pre-filled with', Object.keys(newLinkedCompetencyData).length, 'items')
        }

        // 복수 항목의 파일 정보 설정
        if (Object.keys(newUploadedFiles).length > 0) {
          setUploadedFiles(newUploadedFiles)
          console.log('[ApplicationSubmitPage] UploadedFiles pre-filled with', Object.keys(newUploadedFiles).length, 'files')
        }

        // 기존 데이터가 있을 때만 메시지 표시
        const hasPrefilledData = Object.keys(formValues).length > 0 ||
          Object.values(newRepeatableData).some(entries => entries.some(e => Object.keys(e).length > 0))
        if (hasPrefilledData) {
          message.info('기존에 입력한 세부정보를 불러왔습니다.')
        }
      } catch (error) {
        console.error('기존 역량 정보 로드 실패:', error)
        // 에러 시에도 기본 repeatableData 초기화 (UI가 제대로 작동하도록)
        const defaultRepeatableData: Record<number, any[]> = {}
        projectItems.forEach(item => {
          if (item.competency_item?.is_repeatable) {
            defaultRepeatableData[item.project_item_id] = []
          }
        })
        setRepeatableData(defaultRepeatableData)
        setCompetenciesLoaded(true) // 에러 시에도 재시도 방지
      }
    }

    loadExistingCompetencies()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectItems, isEditMode, competenciesLoaded])

  // 개인정보 필드 변경 감지
  const handleProfileFieldChange = () => {
    const currentValues = form.getFieldsValue([
      'profile_name', 'profile_phone', 'profile_birth_year',
      'profile_gender', 'profile_address', 'profile_in_person_coaching_area'
    ])

    const changed =
      currentValues.profile_name !== user?.name ||
      currentValues.profile_phone !== user?.phone ||
      currentValues.profile_birth_year !== user?.birth_year ||
      currentValues.profile_gender !== user?.gender ||
      currentValues.profile_address !== user?.address ||
      currentValues.profile_in_person_coaching_area !== user?.in_person_coaching_area

    setProfileChanged(changed)
  }

  // 기본정보에 반영
  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const values = form.getFieldsValue([
        'profile_name', 'profile_phone', 'profile_birth_year',
        'profile_gender', 'profile_address', 'profile_in_person_coaching_area'
      ])

      const updateData: UserUpdateData = {
        name: values.profile_name,
        phone: values.profile_phone,
        birth_year: values.profile_birth_year,
        gender: values.profile_gender,
        address: values.profile_address,
        in_person_coaching_area: values.profile_in_person_coaching_area
      }

      const updatedUser = await authService.updateProfile(updateData)
      setUser(updatedUser as any)
      setProfileChanged(false)
      message.success('기본정보가 업데이트되었습니다!')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '기본정보 업데이트에 실패했습니다.')
    } finally {
      setSavingProfile(false)
    }
  }

  const loadProjectData = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [projectData, itemsData] = await Promise.all([
        projectService.getProject(parseInt(projectId)),
        projectService.getProjectItems(parseInt(projectId))
      ])
      setProject(projectData)
      // Sort by display_order
      const sortedItems = itemsData.sort((a, b) => a.display_order - b.display_order)
      setProjectItems(sortedItems)

      // Initialize repeatable data for is_repeatable items
      const initialRepeatableData: Record<number, any[]> = {}
      sortedItems.forEach(item => {
        if (item.competency_item?.is_repeatable) {
          initialRepeatableData[item.project_item_id] = [] // Start empty, user adds entries via "추가" button
        }
      })

      // 신규 지원 시 중복 체크
      if (!isEditMode) {
        const myApplications = await applicationService.getMyApplications()
        const existingApp = myApplications.find(app => app.project_id === parseInt(projectId))
        if (existingApp) {
          message.info('이미 지원한 과제입니다. 기존 지원서를 불러옵니다.')
          navigate(`/coach/projects/${projectId}/apply?applicationId=${existingApp.application_id}`, { replace: true })
          return
        }
      }

      // 수정 모드인 경우 기존 데이터 로드
      if (isEditMode && applicationIdParam) {
        const appId = parseInt(applicationIdParam)
        setExistingApplicationId(appId)

        const [existingApp, existingData] = await Promise.all([
          applicationService.getApplication(appId),
          applicationService.getApplicationData(appId)
        ])

        setExistingApplication(existingApp)

        // motivation, applied_role 설정
        form.setFieldsValue({
          motivation: existingApp.motivation,
          applied_role: existingApp.applied_role
        })

        // 기존 응답 데이터를 폼에 설정
        const formValues: Record<string, any> = {}
        const initialUploadedFiles: Record<string, UploadedFileInfo> = {}
        const linkedData: Record<number, ApplicationData> = {}

        existingData.forEach(data => {
          // item_id로 project_item 찾기
          const projectItem = sortedItems.find(
            item => item.competency_item?.item_id === data.item_id
          )
          if (!projectItem) return

          const isRepeatable = projectItem.competency_item?.is_repeatable

          // 하이브리드 구조: 마감 전에는 linked_competency_value 우선 사용 (실시간 동기화)
          // 마감 후(is_frozen=true)에는 submitted_value 사용 (스냅샷)
          const valueToUse = existingApp.is_frozen
            ? data.submitted_value
            : (data.linked_competency_value || data.submitted_value)

          // 파일도 동일하게 처리
          const fileIdToUse = existingApp.is_frozen
            ? data.submitted_file_id
            : (data.linked_competency_file_id || data.submitted_file_id)
          const fileInfoToUse = existingApp.is_frozen
            ? data.submitted_file_info
            : (data.linked_competency_file_info || data.submitted_file_info)

          if (isRepeatable && valueToUse) {
            try {
              const entries = JSON.parse(valueToUse)
              const entriesArray = Array.isArray(entries) ? entries : [entries]
              initialRepeatableData[projectItem.project_item_id] = entriesArray

              // 각 entry의 _file_info를 uploadedFiles에 저장
              entriesArray.forEach((entry: any, idx: number) => {
                const fileKey = `${projectItem.project_item_id}_${idx}`
                if (entry._file_info && entry._file_info.original_filename) {
                  initialUploadedFiles[fileKey] = {
                    file_id: entry._file_info.file_id,
                    filename: entry._file_info.original_filename,
                    file_size: entry._file_info.file_size
                  }
                  console.log(`[LoadApp] Repeatable entry ${idx} file: ${entry._file_info.original_filename}`)
                } else if (entry._file_id) {
                  initialUploadedFiles[fileKey] = {
                    file_id: entry._file_id,
                    uploading: false
                  }
                }
              })
            } catch {
              initialRepeatableData[projectItem.project_item_id] = []
            }
          } else if (valueToUse) {
            // 일반 항목
            try {
              // JSON인 경우 파싱
              formValues[`item_${projectItem.project_item_id}`] = JSON.parse(valueToUse)
            } catch {
              // 일반 문자열
              formValues[`item_${projectItem.project_item_id}`] = valueToUse
            }
          }

          // 기존 파일 정보 복원 (비반복 항목만 - 반복 항목은 위에서 각 entry별로 처리)
          if (!isRepeatable && fileIdToUse && fileInfoToUse) {
            const fileKey = `${projectItem.project_item_id}_0`
            initialUploadedFiles[fileKey] = {
              file_id: fileIdToUse,
              filename: fileInfoToUse.original_filename,
              file_size: fileInfoToUse.file_size
            }
          }

          // linked competency 데이터 저장 (역량 지갑에서 가져온 실시간 데이터)
          linkedData[projectItem.project_item_id] = data
        })

        form.setFieldsValue(formValues)
        setUploadedFiles(initialUploadedFiles)
        setLinkedCompetencyData(linkedData)
        // 수정 모드에서만 repeatableData 설정 (신규는 loadExistingCompetencies에서 처리)
        setRepeatableData(initialRepeatableData)
      }
      // 신규 지원 시에는 loadExistingCompetencies useEffect에서 repeatableData 초기화
    } catch (error: any) {
      console.error('과제 정보 로드 실패:', error)
      message.error('과제 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 반복 항목 삭제
  const removeRepeatableEntry = (projectItemId: number, entryIndex: number) => {
    setRepeatableData(prev => {
      const current = prev[projectItemId] || []
      if (current.length <= 1) return prev
      return { ...prev, [projectItemId]: current.filter((_, i) => i !== entryIndex) }
    })
  }

  // 모달 열기 (새 항목 추가)
  const openAddModal = (projectItemId: number) => {
    const projectItem = projectItems.find(i => i.project_item_id === projectItemId)
    if (!projectItem) return

    setEditingProjectItemId(projectItemId)
    setEditingEntryIndex(null) // null = 새 항목 추가
    modalForm.resetFields()
    setModalFileList([])
    setModalFileId(null)
    setIsItemModalVisible(true)
  }

  // 모달 열기 (기존 항목 편집)
  const openEditModal = (projectItemId: number, entryIndex: number, entry: any) => {
    setEditingProjectItemId(projectItemId)
    setEditingEntryIndex(entryIndex)
    modalForm.setFieldsValue(entry)

    // 기존 파일 정보 로드
    const fileKey = `${projectItemId}_${entryIndex}`
    const existingFile = uploadedFiles[fileKey]
    if (existingFile?.file_id) {
      setModalFileId(existingFile.file_id)
      setModalFileList([{
        uid: '-1',
        name: existingFile.filename || existingFile.file?.name || '기존 파일',
        status: 'done',
      }])
    } else {
      setModalFileList([])
      setModalFileId(null)
    }

    setIsItemModalVisible(true)
  }

  // 모달 닫기
  const closeItemModal = () => {
    setIsItemModalVisible(false)
    setEditingProjectItemId(null)
    setEditingEntryIndex(null)
    modalForm.resetFields()
    setModalFileList([])
    setModalFileId(null)
  }

  // 모달 파일 업로드 핸들러
  const handleModalFileUpload = async (file: File) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      message.error(validation.message)
      return false
    }

    setModalUploading(true)
    try {
      const response = await fileService.uploadFile(file, 'proof')
      setModalFileId(response.file_id)
      setModalFileList([{
        uid: '-1',
        name: file.name,
        status: 'done',
      }])
      message.success(`${file.name} 파일이 업로드되었습니다.`)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '파일 업로드에 실패했습니다.')
    } finally {
      setModalUploading(false)
    }
    return false
  }

  // 모달 파일 삭제 핸들러
  const handleModalFileRemove = async () => {
    if (modalFileId) {
      try {
        await fileService.deleteFile(modalFileId)
      } catch (error) {
        console.error('파일 삭제 실패:', error)
      }
    }
    setModalFileList([])
    setModalFileId(null)
  }

  // 모달 확인 (저장)
  const handleItemModalOk = async () => {
    try {
      const values = await modalForm.validateFields()
      if (editingProjectItemId === null) return

      // 증빙 필수 항목인데 파일 없으면 경고
      const projectItem = projectItems.find(i => i.project_item_id === editingProjectItemId)
      const proofLevel = (projectItem?.proof_required_level || '').toLowerCase()
      if (proofLevel === 'required' && !modalFileId) {
        message.error('증빙서류 첨부가 필수입니다.')
        return
      }

      let newEntryIndex: number

      if (editingEntryIndex === null) {
        // 새 항목 추가
        setRepeatableData(prev => {
          const current = prev[editingProjectItemId] || []
          newEntryIndex = current.length
          return { ...prev, [editingProjectItemId]: [...current, values] }
        })
        newEntryIndex = (repeatableData[editingProjectItemId] || []).length
        message.success('항목이 추가되었습니다.')
      } else {
        // 기존 항목 수정
        newEntryIndex = editingEntryIndex
        setRepeatableData(prev => {
          const current = prev[editingProjectItemId] || []
          const updated = current.map((entry, idx) =>
            idx === editingEntryIndex ? { ...entry, ...values } : entry
          )
          return { ...prev, [editingProjectItemId]: updated }
        })
        message.success('항목이 수정되었습니다.')
      }

      // 파일 정보를 uploadedFiles에 저장
      const fileKey = `${editingProjectItemId}_${newEntryIndex}`
      if (modalFileId) {
        setUploadedFiles(prev => ({
          ...prev,
          [fileKey]: {
            file_id: modalFileId,
            filename: modalFileList[0]?.name || '첨부파일',
            uploading: false
          }
        }))
      } else {
        // 파일이 없으면 해당 키 제거
        setUploadedFiles(prev => {
          const newFiles = { ...prev }
          delete newFiles[fileKey]
          return newFiles
        })
      }

      closeItemModal()
    } catch (error) {
      console.error('모달 저장 실패:', error)
    }
  }

  // 파일 검증
  const validateFile = (file: File): { valid: boolean; message?: string } => {
    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        message: `파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과합니다. 최대 ${MAX_FILE_SIZE_MB}MB까지 업로드 가능합니다.`
      }
    }

    // 실행 파일 확장자 검증
    const fileName = file.name.toLowerCase()
    const ext = fileName.substring(fileName.lastIndexOf('.'))
    if (BLOCKED_FILE_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        message: `실행 파일(${ext})은 업로드할 수 없습니다. 보안상의 이유로 실행 파일은 허용되지 않습니다.`
      }
    }

    return { valid: true }
  }

  // 파일 업로드 처리
  const handleFileUpload = async (key: string, file: File) => {
    // 파일 검증
    const validation = validateFile(file)
    if (!validation.valid) {
      message.error(validation.message)
      return
    }

    // 업로드 중 상태 표시
    setUploadedFiles(prev => ({
      ...prev,
      [key]: { file, uploading: true }
    }))

    try {
      // 서버에 파일 업로드
      const response = await fileService.uploadFile(file, 'proof')

      // 업로드 성공 - file_id 저장
      setUploadedFiles(prev => ({
        ...prev,
        [key]: { file, file_id: response.file_id, uploading: false }
      }))
      message.success(`${file.name} 파일이 업로드되었습니다.`)
    } catch (error: any) {
      console.error('파일 업로드 실패:', error)
      // 업로드 실패 시 상태에서 제거
      setUploadedFiles(prev => {
        const newFiles = { ...prev }
        delete newFiles[key]
        return newFiles
      })
      message.error(error.response?.data?.detail || '파일 업로드에 실패했습니다.')
    }
  }

  // 파일 다운로드 핸들러
  const handleFileDownload = async (fileId: number, filename: string) => {
    try {
      await fileService.downloadAndSave(fileId, filename)
      message.success('파일 다운로드가 시작되었습니다.')
    } catch (error: any) {
      message.error('파일 다운로드에 실패했습니다.')
    }
  }

  // 검토 상태 태그 렌더링
  const getVerificationStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '검토중' },
      approved: { color: 'green', icon: <CheckCircleOutlined />, text: '승인' },
      rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '반려' },
      supplemented: { color: 'blue', icon: <ClockCircleOutlined />, text: '보완완료' },
      supplement_requested: { color: 'red', icon: <ExclamationCircleOutlined />, text: '보충필요' }
    }
    const config = statusMap[status] || statusMap.pending
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  // Parse template config JSON safely
  const parseTemplateConfig = (configJson: string | null): any => {
    if (!configJson) return {}
    try {
      return JSON.parse(configJson)
    } catch {
      return {}
    }
  }

  // Render input field based on template type
  const renderInputField = (item: ProjectItem) => {
    const competencyItem = item.competency_item
    if (!competencyItem) return <Input placeholder="항목 정보를 불러올 수 없습니다." disabled />

    const template = competencyItem.template
    const config = parseTemplateConfig(competencyItem.template_config)

    switch (template) {
      case ItemTemplate.TEXT:
        return (
          <TextArea
            rows={4}
            placeholder={competencyItem.description || '답변을 입력해주세요.'}
            maxLength={config.maxLength}
            showCount={!!config.maxLength}
          />
        )

      case ItemTemplate.NUMBER:
        return (
          <InputNumber
            size="large"
            style={{ width: '100%' }}
            placeholder={competencyItem.description || '숫자를 입력해주세요.'}
            min={config.min}
            max={config.max}
            addonAfter={config.unit}
          />
        )

      case ItemTemplate.SELECT:
        const selectOptions = config.options || []
        return (
          <Select
            size="large"
            placeholder={competencyItem.description || '선택해주세요.'}
            style={{ width: '100%' }}
          >
            {selectOptions.map((opt: { value: string; label: string }) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        )

      case ItemTemplate.MULTISELECT:
        const multiOptions = config.options || []
        return (
          <Select
            mode="multiple"
            size="large"
            placeholder={competencyItem.description || '선택해주세요 (복수 선택 가능).'}
            style={{ width: '100%' }}
          >
            {multiOptions.map((opt: { value: string; label: string }) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        )

      case ItemTemplate.FILE:
        return (
          <Upload maxCount={1} beforeUpload={() => false}>
            <Button icon={<UploadOutlined />}>파일 업로드</Button>
          </Upload>
        )

      case ItemTemplate.TEXT_FILE:
        return (
          <div className="space-y-2">
            <TextArea
              rows={3}
              placeholder={competencyItem.description || '답변을 입력해주세요.'}
            />
            <Upload maxCount={1} beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>증빙 파일 첨부</Button>
            </Upload>
          </div>
        )

      case ItemTemplate.DEGREE:
        return (
          <div className="grid grid-cols-2 gap-4">
            <Form.Item noStyle name={[`item_${item.project_item_id}`, 'degree_type']}>
              <Select placeholder="학위 유형">
                <Select.Option value="associate">전문학사</Select.Option>
                <Select.Option value="bachelor">학사</Select.Option>
                <Select.Option value="master">석사</Select.Option>
                <Select.Option value="doctorate">박사</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item noStyle name={[`item_${item.project_item_id}`, 'major']}>
              <Input placeholder="전공" />
            </Form.Item>
            <Form.Item noStyle name={[`item_${item.project_item_id}`, 'school']}>
              <Input placeholder="학교명" />
            </Form.Item>
            <Form.Item noStyle name={[`item_${item.project_item_id}`, 'graduation_year']}>
              <InputNumber placeholder="졸업년도" style={{ width: '100%' }} />
            </Form.Item>
          </div>
        )

      case ItemTemplate.COACHING_HISTORY:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Form.Item noStyle name={[`item_${item.project_item_id}`, 'project_name']}>
                <Input placeholder="과제명/프로그램명" />
              </Form.Item>
              <Form.Item noStyle name={[`item_${item.project_item_id}`, 'organization']}>
                <Input placeholder="기관명" />
              </Form.Item>
              <Form.Item noStyle name={[`item_${item.project_item_id}`, 'period']}>
                <Input placeholder="활동기간 (예: 2023.01 ~ 2023.12)" />
              </Form.Item>
              <Form.Item noStyle name={[`item_${item.project_item_id}`, 'role']}>
                <Select placeholder="역할">
                  <Select.Option value="leader">리더코치</Select.Option>
                  <Select.Option value="participant">참여코치</Select.Option>
                  <Select.Option value="supervisor">수퍼바이저</Select.Option>
                </Select>
              </Form.Item>
            </div>
            <Form.Item noStyle name={[`item_${item.project_item_id}`, 'description']}>
              <TextArea rows={2} placeholder="활동 내용 (선택)" />
            </Form.Item>
          </div>
        )

      default:
        // Fallback to text input
        return (
          <TextArea
            rows={3}
            placeholder={competencyItem.description || '답변을 입력해주세요.'}
          />
        )
    }
  }

  // 제출 전 동기화 확인창 표시
  const handleSubmitWithConfirmation = (values: any) => {
    Modal.confirm({
      title: '변경사항 동기화',
      content: '이 변경사항이 "세부정보" 화면에도 반영됩니다. 계속하시겠습니까?',
      okText: '반영',
      cancelText: '취소',
      onOk: () => handleSubmit(values)
    })
  }

  const handleSubmit = async (values: any) => {
    if (!projectId) return
    setSubmitting(true)
    try {
      let applicationId: number

      // 수정 모드면 기존 지원서 사용, 아니면 새로 생성
      if (isEditMode && existingApplicationId) {
        applicationId = existingApplicationId
        // 기본 정보 업데이트
        await applicationService.updateApplication(applicationId, {
          motivation: values.motivation || null,
          applied_role: values.applied_role || null
        })
      } else {
        // 새 지원서 생성
        const application = await applicationService.createApplication({
          project_id: parseInt(projectId),
          motivation: values.motivation || null,
          applied_role: values.applied_role || null
        })
        applicationId = application.application_id
      }

      // 2. Prepare application data (survey item responses)
      const applicationData: ApplicationDataSubmit[] = projectItems.map(item => {
        const competencyItem = item.competency_item
        const isRepeatable = competencyItem?.is_repeatable

        let submittedValue: string | null = null
        let submittedFileId: number | null = null

        if (isRepeatable) {
          // 반복 가능 항목은 repeatableData에서 가져옴
          const entries = repeatableData[item.project_item_id] || []
          if (entries.length > 0) {
            // 각 entry에 대해 업로드된 파일 ID도 포함
            const entriesWithFiles = entries.map((entry, idx) => {
              const fileKey = `${item.project_item_id}_${idx}`
              const fileInfo = uploadedFiles[fileKey]
              return {
                ...entry,
                _file_id: fileInfo?.file_id || null
              }
            })
            submittedValue = JSON.stringify(entriesWithFiles)
          }
        } else {
          // 일반 항목은 form values에서 가져옴
          const fieldValue = values[`item_${item.project_item_id}`]
          if (fieldValue !== undefined && fieldValue !== null) {
            if (typeof fieldValue === 'object') {
              submittedValue = JSON.stringify(fieldValue)
            } else if (Array.isArray(fieldValue)) {
              submittedValue = JSON.stringify(fieldValue)
            } else {
              submittedValue = String(fieldValue)
            }
          }
          // 단일 항목의 경우 첫 번째 파일 키 사용
          const fileKey = `${item.project_item_id}_0`
          const fileInfo = uploadedFiles[fileKey]
          submittedFileId = fileInfo?.file_id || null
        }

        return {
          item_id: competencyItem?.item_id || 0,
          submitted_value: submittedValue,
          submitted_file_id: submittedFileId
        }
      }).filter(data => data.item_id > 0)

      console.log('[ApplicationSubmitPage] Prepared applicationData for sync:',
        applicationData.map(d => ({ item_id: d.item_id, has_value: !!d.submitted_value, value_preview: d.submitted_value?.substring(0, 50) }))
      )

      // 3. Submit application with all data
      const submitData: ApplicationSubmitRequest = {
        motivation: values.motivation || null,
        applied_role: values.applied_role || null,
        custom_answers: [], // Legacy - no longer used
        application_data: applicationData
      }

      await applicationService.submitApplication(applicationId, submitData)

      // 제출 성공 후 프로필 자동 업데이트
      try {
        const profileUpdateData: Record<string, any> = {}

        projectItems.forEach(item => {
          const itemCode = item.competency_item?.item_code
          if (!itemCode) return

          const profileField = PROFILE_MAPPED_ITEM_CODES[itemCode as keyof typeof PROFILE_MAPPED_ITEM_CODES]
          if (profileField) {
            const fieldValue = values[`item_${item.project_item_id}`]
            if (fieldValue !== undefined && fieldValue !== null) {
              profileUpdateData[profileField] = fieldValue
            }
          }
        })

        if (Object.keys(profileUpdateData).length > 0) {
          await profileService.updateDetailedProfile(profileUpdateData)
          console.log('프로필 자동 업데이트 완료:', profileUpdateData)
        }
      } catch (profileError) {
        console.error('프로필 자동 업데이트 실패:', profileError)
        // 프로필 업데이트 실패해도 지원서는 이미 제출됐으므로 에러 표시 안 함
      }

      message.success(isEditMode ? '지원서가 수정되었습니다.' : '지원서가 제출되었습니다.')
      navigate('/coach/my-applications')
    } catch (error: any) {
      console.error('지원서 제출 실패:', error)
      message.error(error.response?.data?.detail || '지원서 제출에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  // Check if deadline has passed
  const isDeadlinePassed = dayjs().isAfter(dayjs(project.recruitment_end_date).endOf('day'))

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/coach/projects')}
          >
            과제 목록으로 돌아가기
          </Button>
        </div>

        <Card className="mb-4">
          <Title level={2} className="mb-4">{project.project_name}</Title>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="모집 시작일">
              {dayjs(project.recruitment_start_date).format('YYYY-MM-DD')}
            </Descriptions.Item>
            <Descriptions.Item label="모집 종료일">
              {dayjs(project.recruitment_end_date).format('YYYY-MM-DD')}
            </Descriptions.Item>
            <Descriptions.Item label="과제 기간" span={2}>
              {project.project_start_date && project.project_end_date
                ? `${dayjs(project.project_start_date).format('YYYY-MM-DD')} ~ ${dayjs(project.project_end_date).format('YYYY-MM-DD')}`
                : '미정'}
            </Descriptions.Item>
            {project.description && (
              <Descriptions.Item label="설명" span={2}>
                {project.description}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {isDeadlinePassed ? (
          <Card>
            <Alert
              type="error"
              message="모집 마감"
              description="모집 기간이 종료되어 지원서를 제출할 수 없습니다."
              showIcon
            />
          </Card>
        ) : (
          <Card>
            <div className="mb-6 flex justify-between items-start">
              <div>
                <Title level={3} className="mb-2">
                  {isViewMode ? '지원서 내용' : (isEditMode ? '지원서 수정' : '지원서 작성')}
                </Title>
                <Text className="text-gray-600">
                  {isViewMode
                    ? '제출한 지원서 내용입니다.'
                    : (isEditMode
                      ? '제출한 지원서를 수정할 수 있습니다. 수정 후 다시 제출해주세요.'
                      : <span><Text style={{ color: '#1890ff', fontWeight: 500 }}>'개인정보와 역량정보'</Text> 모두 입력한 후 제출해주세요.</span>)}
                </Text>
                {isViewMode && existingApplication && (
                  <div className="mt-2">
                    <Tag color="green">제출일: {dayjs(existingApplication.submitted_at).format('YYYY-MM-DD HH:mm')}</Tag>
                  </div>
                )}
              </div>
              {isViewMode && canEdit() && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={switchToEditMode}
                >
                  수정하기
                </Button>
              )}
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitWithConfirmation}
              scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
              disabled={isViewMode}
            >
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                type="card"
                className="application-tabs"
                items={[
                  {
                    key: 'personal',
                    label: (
                      <span>
                        <UserOutlined />
                        개인정보
                      </span>
                    ),
                    children: (
                      <Card size="small" className="mb-4">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-gray-600">회원정보에서 자동으로 불러옵니다.</span>
                          {!isViewMode && profileChanged && (
                            <Button
                              type="primary"
                              size="small"
                              icon={<SaveOutlined />}
                              loading={savingProfile}
                              onClick={handleSaveProfile}
                            >
                              기본정보에 반영
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Form.Item label="이름" name="profile_name">
                            <Input onChange={handleProfileFieldChange} />
                          </Form.Item>
                          <Form.Item label="이메일">
                            <Input value={user?.email || ''} disabled />
                          </Form.Item>
                          <Form.Item label="전화번호" name="profile_phone">
                            <Input onChange={handleProfileFieldChange} />
                          </Form.Item>
                          <Form.Item label="생년" name="profile_birth_year">
                            <InputNumber
                              className="w-full"
                              min={1900}
                              max={new Date().getFullYear()}
                              onChange={handleProfileFieldChange}
                            />
                          </Form.Item>
                          <Form.Item label="성별" name="profile_gender">
                            <Select onChange={handleProfileFieldChange}>
                              <Select.Option value="남성">남성</Select.Option>
                              <Select.Option value="여성">여성</Select.Option>
                              <Select.Option value="기타">기타</Select.Option>
                            </Select>
                          </Form.Item>
                          <Form.Item label="주소" name="profile_address">
                            <Input onChange={handleProfileFieldChange} />
                          </Form.Item>
                          <Form.Item label="대면코칭 가능지역" name="profile_in_person_coaching_area" className="md:col-span-2">
                            <Input onChange={handleProfileFieldChange} placeholder="예: 서울 전지역, 경기 남부" />
                          </Form.Item>
                        </div>
                        {!isViewMode && (
                          <Alert
                            type="info"
                            showIcon
                            message="다음 단계"
                            description="개인정보 입력 후 '역량 정보' 탭에서 자격 및 경력을 입력해주세요."
                            className="mt-4"
                          />
                        )}
                      </Card>
                    )
                  },
                  {
                    key: 'survey',
                    label: (
                      <span>
                        <FileTextOutlined />
                        역량 정보
                      </span>
                    ),
                    children: (
                      <>
                        {/* Basic application info */}
                        <Card size="small" title="기본 정보" className="mb-4">
                <Form.Item
                  name="applied_role"
                  label="신청 역할"
                  rules={[{ required: true, message: '신청 역할을 선택해주세요.' }]}
                >
                  <Select size="large" placeholder="역할을 선택하세요">
                    <Select.Option value="leader">리더코치</Select.Option>
                    <Select.Option value="participant">참여코치</Select.Option>
                    <Select.Option value="supervisor">수퍼비전 코치</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="motivation"
                  label="지원 동기 및 기여점"
                  rules={[{ required: true, message: '지원 동기를 입력해주세요.' }]}
                >
                  <TextArea
                    rows={6}
                    placeholder="본 과제에 지원하게 된 동기와 본인이 기여할 수 있는 점을 구체적으로 작성해주세요."
                  />
                </Form.Item>
              </Card>

              {/* Survey items (project_items) - Card UI with repeatable support */}
              {(() => {
                // Filter out user profile items (personal info is shown from user profile)
                const filteredItems = projectItems.filter(item =>
                  item.competency_item && !USER_PROFILE_ITEM_CODES.includes(item.competency_item.item_code)
                )
                return filteredItems.length > 0 ? (
                <Card size="small" title="설문 항목" className="mb-4">
                  {!isViewMode && (
                    <Alert
                      type="info"
                      message="아래 항목들은 과제 관리자가 취합하고자 하는 정보입니다. 정확하게 입력해주세요."
                      className="mb-4"
                      showIcon
                      icon={<InfoCircleOutlined />}
                    />
                  )}
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {filteredItems.map((item) => {
                      const competencyItem = item.competency_item
                      if (!competencyItem) return null

                      const isRepeatable = competencyItem.is_repeatable
                      // 반복 가능 항목은 빈 배열로 시작 (세부정보 화면과 동일)
                      const entries = isRepeatable ? (repeatableData[item.project_item_id] || []) : [{}]
                      const maxEntries = competencyItem.max_entries
                      const canAddMore = !maxEntries || entries.length < maxEntries

                      // 반복 가능 항목: 그룹 헤더 + 내부 항목들
                      if (isRepeatable) {
                        return (
                          <div key={item.project_item_id} className="mb-4">
                            {/* 그룹 헤더 */}
                            <div className="flex justify-between items-center mb-2 pb-2 border-b">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{competencyItem.item_name}</span>
                                {item.is_required && <Tag color="red">필수</Tag>}
                                <Tag color="blue">복수 입력 가능</Tag>
                                <Text type="secondary">({entries.length}개)</Text>
                              </div>
                              {!isViewMode && canAddMore && (
                                <Button
                                  type="dashed"
                                  size="small"
                                  onClick={() => openAddModal(item.project_item_id)}
                                >
                                  + 항목 추가
                                </Button>
                              )}
                            </div>

                            {competencyItem.description && (
                              <Text type="secondary" className="block mb-3 text-sm">
                                {competencyItem.description}
                              </Text>
                            )}

                            {/* 각 항목 카드 */}
                            {entries.map((entry, entryIndex) => {
                              const fileKey = `${item.project_item_id}_${entryIndex}`
                              const fileInfo = uploadedFiles[fileKey]
                              const hasFile = !!fileInfo
                              // 증빙첨부 레벨 확인 (IIFE 밖에서 미리 계산)
                              const proofLevel = (item.proof_required_level || '').toLowerCase()
                              const showProofUpload = proofLevel === 'required' || proofLevel === 'optional'

                              return (
                                <Card
                                  key={`${item.project_item_id}_${entryIndex}_${Object.keys(entry).length}`}
                                  size="small"
                                  className="mb-2"
                                  title={
                                    <span className="font-medium">#{entryIndex + 1}</span>
                                  }
                                  extra={
                                    !isViewMode && (
                                      <Space size="small">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<EditOutlined />}
                                          onClick={() => openEditModal(item.project_item_id, entryIndex, entry)}
                                        />
                                        {entries.length > 1 && (
                                          <Button
                                            type="text"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={() => removeRepeatableEntry(item.project_item_id, entryIndex)}
                                          />
                                        )}
                                      </Space>
                                    )
                                  }
                                >
                                  {/* 데이터 요약 표시 (읽기 전용) */}
                                  <div className="mb-3">
                                    {competencyItem.fields && competencyItem.fields.length > 0 ? (
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        {competencyItem.fields
                                          .filter(f => f.field_type !== 'file')
                                          .sort((a, b) => a.display_order - b.display_order)
                                          .map(field => (
                                            <div key={field.field_name}>
                                              <Text type="secondary">{field.field_label}: </Text>
                                              <Text>{entry[field.field_name] || '-'}</Text>
                                            </div>
                                          ))
                                        }
                                      </div>
                                    ) : (
                                      <Text>{entry.text || entry.number || '-'}</Text>
                                    )}
                                  </div>

                                  {/* 증빙첨부 상태 표시 (파일 업로드는 모달에서 처리) */}
                                  {showProofUpload && (
                                    <div className="flex items-center gap-2 pt-2 border-t">
                                      {hasFile ? (
                                        <Button
                                          type="link"
                                          size="small"
                                          className="p-0"
                                          onClick={() => fileInfo?.file_id && openPreview(fileInfo.file_id, fileInfo.filename || fileInfo?.file?.name || '파일')}
                                        >
                                          {fileInfo?.file?.name || fileInfo?.filename || '첨부파일'}
                                        </Button>
                                      ) : (
                                        <Tag color={proofLevel === 'required' ? 'orange' : 'default'} icon={<UploadOutlined />}>
                                          {proofLevel === 'required' ? '증빙첨부 (필수)' : '증빙첨부 (선택)'}
                                        </Tag>
                                      )}
                                    </div>
                                  )}

                                  {/* 검토상태 표시 */}
                                  {(() => {
                                    const linkedData = linkedCompetencyData[item.project_item_id]
                                    if (!linkedData) return null
                                    const verificationStatus = linkedData.linked_competency_verification_status || linkedData.verification_status
                                    return verificationStatus && (
                                      <div className="mt-2">
                                        {getVerificationStatusTag(verificationStatus)}
                                      </div>
                                    )
                                  })()}
                                </Card>
                              )
                            })}

                            {/* 항목이 없을 때 - 명확한 빈 상태 표시 */}
                            {entries.length === 0 && (
                              <Card size="small" className="border-dashed border-2 border-gray-300 bg-gray-50">
                                <div className="text-center py-4">
                                  <Text type="secondary" className="text-base">등록된 항목이 없습니다.</Text>
                                  {!isViewMode && (
                                    <div className="mt-2">
                                      <Button
                                        type="primary"
                                        ghost
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={() => openAddModal(item.project_item_id)}
                                      >
                                        첫 번째 항목 추가
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            )}
                          </div>
                        )
                      }

                      // 단일 항목 (non-repeatable)
                      const singleFileKey = `${item.project_item_id}_0`
                      const uploadedFileInfo = uploadedFiles[singleFileKey]
                      const singleLinkedData = linkedCompetencyData[item.project_item_id]
                      const singleLinkedFileInfo = singleLinkedData?.linked_competency_file_info

                      // 새로 업로드한 파일 우선, 없으면 세부정보에서 가져온 파일 사용
                      const singleFileInfo = uploadedFileInfo || (singleLinkedFileInfo ? {
                        file_id: singleLinkedData?.linked_competency_file_id,
                        filename: singleLinkedFileInfo.original_filename,
                        file_size: singleLinkedFileInfo.file_size
                      } : null)
                      const singleHasFile = !!singleFileInfo

                      return (
                        <div key={item.project_item_id} className="mb-4">
                          {/* 그룹 헤더 (단일 항목용) */}
                          <div className="flex justify-between items-center mb-2 pb-2 border-b">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{competencyItem.item_name}</span>
                              {item.is_required && <Tag color="red">필수</Tag>}
                            </div>
                          </div>

                          {competencyItem.description && (
                            <Text type="secondary" className="block mb-3 text-sm">
                              {competencyItem.description}
                            </Text>
                          )}

                          {/* Input field based on template */}
                          <Card size="small" className="mb-2">
                            {/* DEGREE, COACHING_HISTORY 등 복합 템플릿은 내부에 자체 Form.Item을 가지므로 부모에 name 없이 렌더링 */}
                            {(competencyItem.template === ItemTemplate.DEGREE || competencyItem.template === ItemTemplate.COACHING_HISTORY) ? (
                              <div className="mb-3">
                                {renderInputField(item)}
                              </div>
                            ) : (
                              <Form.Item
                                name={`item_${item.project_item_id}`}
                                className="mb-3"
                                rules={[
                                  {
                                    required: item.is_required,
                                    message: '이 항목은 필수입니다.'
                                  }
                                ]}
                              >
                                {renderInputField(item)}
                              </Form.Item>
                            )}

                            {/* 증빙첨부 버튼 - proof_required_level이 required 또는 optional인 경우에만 표시 */}
                            {(() => {
                              const proofLevel = (item.proof_required_level || '').toLowerCase()
                              const isUploading = uploadedFileInfo?.uploading
                              const hasUploadedFile = !!uploadedFileInfo
                              const hasLinkedFile = !!singleLinkedFileInfo

                              return (proofLevel === 'required' || proofLevel === 'optional') && (
                              <div className="flex items-center gap-2 pt-2 border-t">
                                {isViewMode ? (
                                  singleHasFile ? (
                                    <Button
                                      type="link"
                                      size="small"
                                      className="p-0"
                                      onClick={() => singleFileInfo?.file_id && openPreview(singleFileInfo.file_id, singleFileInfo.filename || '파일')}
                                    >
                                      {singleFileInfo?.filename || '첨부파일'}
                                    </Button>
                                  ) : (
                                    <Text type="secondary">첨부파일 없음</Text>
                                  )
                                ) : isUploading ? (
                                  <Tag color="processing" icon={<LoadingOutlined />}>
                                    {uploadedFileInfo?.file?.name || uploadedFileInfo?.filename} 업로드 중...
                                  </Tag>
                                ) : hasUploadedFile ? (
                                  // 새로 업로드한 파일 표시
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="link"
                                      size="small"
                                      className="p-0"
                                      onClick={() => uploadedFileInfo?.file_id && openPreview(uploadedFileInfo.file_id, uploadedFileInfo.filename || uploadedFileInfo?.file?.name || '파일')}
                                    >
                                      {uploadedFileInfo?.file?.name || uploadedFileInfo?.filename}
                                    </Button>
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      onClick={async () => {
                                        if (uploadedFileInfo?.file_id) {
                                          try {
                                            await fileService.deleteFile(uploadedFileInfo.file_id)
                                          } catch (error) {
                                            console.error('파일 삭제 실패:', error)
                                          }
                                        }
                                        setUploadedFiles(prev => {
                                          const newFiles = { ...prev }
                                          delete newFiles[singleFileKey]
                                          return newFiles
                                        })
                                      }}
                                    />
                                  </div>
                                ) : hasLinkedFile ? (
                                  // 세부정보에서 가져온 파일 표시 (삭제 불가, 대체만 가능)
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="link"
                                      size="small"
                                      className="p-0"
                                      onClick={() => singleLinkedData?.linked_competency_file_id && openPreview(singleLinkedData.linked_competency_file_id, singleLinkedFileInfo.original_filename)}
                                    >
                                      {singleLinkedFileInfo.original_filename}
                                    </Button>
                                    <Upload
                                      maxCount={1}
                                      showUploadList={false}
                                      beforeUpload={(file) => {
                                        handleFileUpload(singleFileKey, file)
                                        return false
                                      }}
                                    >
                                      <Button type="text" size="small" icon={<UploadOutlined />}>
                                        파일 대체
                                      </Button>
                                    </Upload>
                                  </div>
                                ) : (
                                  // 파일 없음 - 업로드 버튼 표시
                                  <Upload
                                    maxCount={1}
                                    showUploadList={false}
                                    beforeUpload={(file) => {
                                      handleFileUpload(singleFileKey, file)
                                      return false
                                    }}
                                  >
                                    <Button icon={<UploadOutlined />} size="small">
                                      {proofLevel === 'required' ? '증빙첨부 (필수)' : '증빙첨부 (선택)'}
                                    </Button>
                                  </Upload>
                                )}
                              </div>
                            )})()}

                            {/* 검토상태 표시 */}
                            {(() => {
                              const linkedData = linkedCompetencyData[item.project_item_id]
                              if (!linkedData) return null
                              const verificationStatus = linkedData.linked_competency_verification_status || linkedData.verification_status
                              return verificationStatus && (
                                <div className="mt-2">
                                  {getVerificationStatusTag(verificationStatus)}
                                </div>
                              )
                            })()}
                          </Card>
                        </div>
                      )
                    })}
                  </Space>
                </Card>
              ) : null
              })()}

                        {/* Show message if no survey items */}
                        {projectItems.filter(item =>
                          item.competency_item && !USER_PROFILE_ITEM_CODES.includes(item.competency_item.item_code)
                        ).length === 0 && (
                          <Alert
                            type="info"
                            message="추가 설문 항목 없음"
                            description="이 과제에는 추가로 입력할 설문 항목이 없습니다. 기본 정보만 확인 후 제출해주세요."
                            className="mb-4"
                            showIcon
                          />
                        )}
                      </>
                    )
                  }
                ]}
              />

              <Form.Item className="mb-0 mt-4">
                <Space className="w-full justify-end">
                  <Button
                    size="large"
                    onClick={() => navigate('/projects')}
                  >
                    {isViewMode ? '목록으로' : '취소'}
                  </Button>
                  {!isViewMode && (
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={submitting}
                      icon={<SendOutlined />}
                    >
                      {isEditMode ? '수정사항 제출' : '지원서 제출'}
                    </Button>
                  )}
                  {isViewMode && canEdit() && (
                    <Button
                      type="primary"
                      size="large"
                      icon={<EditOutlined />}
                      onClick={switchToEditMode}
                    >
                      수정하기
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Form>

            {/* 항목 편집 모달 */}
            <Modal
              title={editingEntryIndex === null ? '항목 추가' : '항목 수정'}
              open={isItemModalVisible}
              onOk={handleItemModalOk}
              onCancel={closeItemModal}
              okText={editingEntryIndex === null ? '등록' : '수정'}
              cancelText="취소"
              width={600}
            >
              <Form
                form={modalForm}
                layout="vertical"
                name="item_modal_form"
              >
                {(() => {
                  if (!editingProjectItemId) return null
                  const projectItem = projectItems.find(i => i.project_item_id === editingProjectItemId)
                  if (!projectItem?.competency_item) return null

                  const competencyItem = projectItem.competency_item
                  const fields = competencyItem.fields || []

                  if (fields.length > 0) {
                    return fields
                      .filter(f => f.field_type !== 'file')
                      .sort((a, b) => a.display_order - b.display_order)
                      .map(field => {
                        const options = field.field_options ? JSON.parse(field.field_options) : []
                        return (
                          <Form.Item
                            key={field.field_name}
                            name={field.field_name}
                            label={field.field_label}
                            rules={[{ required: field.is_required, message: `${field.field_label}을(를) 입력해주세요` }]}
                          >
                            {field.field_type === 'select' ? (
                              <Select placeholder={field.placeholder || `${field.field_label} 선택`}>
                                {options.map((opt: string) => (
                                  <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                                ))}
                              </Select>
                            ) : field.field_type === 'number' ? (
                              <InputNumber
                                className="w-full"
                                placeholder={field.placeholder || field.field_label}
                              />
                            ) : field.field_type === 'textarea' ? (
                              <Input.TextArea
                                rows={3}
                                placeholder={field.placeholder || field.field_label}
                              />
                            ) : (
                              <Input placeholder={field.placeholder || field.field_label} />
                            )}
                          </Form.Item>
                        )
                      })
                  }

                  // 필드 정의가 없으면 기본 텍스트 입력
                  return (
                    <Form.Item
                      name="text"
                      label={competencyItem.item_name || '상세 내용'}
                      rules={[{ required: true, message: `${competencyItem.item_name || '내용'}을(를) 입력해주세요` }]}
                    >
                      <Input.TextArea
                        rows={4}
                        placeholder={`${competencyItem.item_name || '내용'}을(를) 입력해주세요`}
                      />
                    </Form.Item>
                  )
                })()}

                {/* 증빙서류 업로드 - proof_required_level에 따라 표시 */}
                {(() => {
                  if (!editingProjectItemId) return null
                  const projectItem = projectItems.find(i => i.project_item_id === editingProjectItemId)
                  const proofLevel = (projectItem?.proof_required_level || '').toLowerCase()
                  const showProofUpload = proofLevel === 'required' || proofLevel === 'optional'

                  if (!showProofUpload) return null

                  return (
                    <Form.Item
                      label={proofLevel === 'required' ? '증빙서류 (필수)' : '증빙서류 (선택사항)'}
                    >
                      <Upload.Dragger
                        fileList={modalFileList}
                        beforeUpload={handleModalFileUpload}
                        onRemove={handleModalFileRemove}
                        maxCount={1}
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={modalUploading}
                        style={{ padding: '20px' }}
                      >
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">
                          {modalFileList.length > 0 ? '파일을 드래그하여 변경' : '클릭 또는 파일을 드래그하세요'}
                        </p>
                        <p className="ant-upload-hint">
                          PDF, JPG, PNG (최대 10MB)
                        </p>
                      </Upload.Dragger>
                    </Form.Item>
                  )
                })()}
              </Form>
            </Modal>
          </Card>
        )}

        {/* 파일 미리보기 모달 */}
        <FilePreviewModal
          visible={previewState.visible}
          fileId={previewState.fileId}
          filename={previewState.filename}
          onClose={closePreview}
        />
      </div>
    </div>
  )
}
