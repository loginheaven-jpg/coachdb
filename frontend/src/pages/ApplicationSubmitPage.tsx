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
  Modal
} from 'antd'
import { ArrowLeftOutlined, SendOutlined, UploadOutlined, InfoCircleOutlined, UserOutlined, PlusOutlined, MinusCircleOutlined, CheckCircleOutlined, SaveOutlined, DeleteOutlined, LoadingOutlined, EditOutlined, ClockCircleOutlined, DownloadOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import projectService, { ProjectDetail, ProjectItem, ItemTemplate } from '../services/projectService'
import applicationService, { ApplicationSubmitRequest, ApplicationDataSubmit, ApplicationData } from '../services/applicationService'
import authService, { UserUpdateData } from '../services/authService'
import fileService from '../services/fileService'
import profileService, { DetailedProfile } from '../services/profileService'
import competencyService, { CoachCompetency } from '../services/competencyService'
import { useAuthStore } from '../stores/authStore'
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
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [competenciesLoaded, setCompetenciesLoaded] = useState(false)
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
              defaultRepeatableData[item.project_item_id] = [{}]
            }
          })
          setRepeatableData(defaultRepeatableData)
          return
        }

        // 역량 데이터를 item_id로 매핑
        const competencyMap = new Map<number, CoachCompetency>()
        competencies.forEach(c => {
          competencyMap.set(c.item_id, c)
        })

        // 폼 값과 repeatableData 초기화
        const formValues: Record<string, any> = {}
        const newRepeatableData: Record<number, any[]> = {}

        projectItems.forEach(item => {
          const itemId = item.competency_item?.item_id
          if (!itemId) return

          const isRepeatable = item.competency_item?.is_repeatable
          const existingComp = competencyMap.get(itemId)

          if (isRepeatable) {
            // 반복 가능 항목: 기본값 또는 기존 데이터
            if (existingComp && existingComp.value) {
              try {
                const entries = JSON.parse(existingComp.value)
                if (Array.isArray(entries) && entries.length > 0) {
                  newRepeatableData[item.project_item_id] = entries
                  console.log(`[Pre-fill] Repeatable item ${itemId} with ${entries.length} entries`)
                } else {
                  newRepeatableData[item.project_item_id] = [{}] // 기본값
                }
              } catch {
                // JSON 파싱 실패 시 단일 값으로 처리
                newRepeatableData[item.project_item_id] = [{ text: existingComp.value }]
              }
            } else {
              // 기존 데이터 없으면 빈 항목 하나
              newRepeatableData[item.project_item_id] = [{}]
            }
          } else if (existingComp && existingComp.value) {
            // 일반 항목 (기존 데이터 있을 때만)
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
        })

        // 상태 업데이트 - 항상 설정 (신규 지원 시 초기화 역할)
        setRepeatableData(newRepeatableData)
        console.log('[ApplicationSubmitPage] RepeatableData initialized/pre-filled:', Object.keys(newRepeatableData).length, 'items')

        if (Object.keys(formValues).length > 0) {
          form.setFieldsValue(formValues)
          console.log('[ApplicationSubmitPage] Form pre-filled with', Object.keys(formValues).length, 'values')
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
            defaultRepeatableData[item.project_item_id] = [{}]
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
          initialRepeatableData[item.project_item_id] = [{}] // Start with one empty entry
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

          if (isRepeatable && data.submitted_value) {
            try {
              const entries = JSON.parse(data.submitted_value)
              initialRepeatableData[projectItem.project_item_id] = Array.isArray(entries) ? entries : [entries]
            } catch {
              initialRepeatableData[projectItem.project_item_id] = [{}]
            }
          } else if (data.submitted_value) {
            // 일반 항목
            try {
              // JSON인 경우 파싱
              formValues[`item_${projectItem.project_item_id}`] = JSON.parse(data.submitted_value)
            } catch {
              // 일반 문자열
              formValues[`item_${projectItem.project_item_id}`] = data.submitted_value
            }
          }

          // 기존 파일 정보 복원
          if (data.submitted_file_id && data.submitted_file_info) {
            const fileKey = `${projectItem.project_item_id}_0`
            initialUploadedFiles[fileKey] = {
              file_id: data.submitted_file_id,
              filename: data.submitted_file_info.original_filename,
              file_size: data.submitted_file_info.file_size
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

  // 반복 항목 추가
  const addRepeatableEntry = (projectItemId: number, maxEntries?: number) => {
    setRepeatableData(prev => {
      const current = prev[projectItemId] || [{}]
      if (maxEntries && current.length >= maxEntries) {
        message.warning(`최대 ${maxEntries}개까지 추가할 수 있습니다.`)
        return prev
      }
      return { ...prev, [projectItemId]: [...current, {}] }
    })
  }

  // 반복 항목 삭제
  const removeRepeatableEntry = (projectItemId: number, entryIndex: number) => {
    setRepeatableData(prev => {
      const current = prev[projectItemId] || []
      if (current.length <= 1) return prev
      return { ...prev, [projectItemId]: current.filter((_, i) => i !== entryIndex) }
    })
  }

  // 반복 항목 값 업데이트
  const updateRepeatableEntry = (projectItemId: number, entryIndex: number, fieldName: string, value: any) => {
    console.log('[updateRepeatableEntry] Called:', { projectItemId, entryIndex, fieldName, value, valueType: typeof value })

    // Don't update if value is undefined (could be from blur events)
    if (value === undefined) {
      console.log('[updateRepeatableEntry] Skipping undefined value update')
      return
    }

    setRepeatableData(prev => {
      const prevEntries = prev[projectItemId] || [{}]
      const current = prevEntries.map((entry, idx) =>
        idx === entryIndex ? { ...entry, [fieldName]: value } : entry
      )
      const newState = { ...prev, [projectItemId]: current }
      console.log('[updateRepeatableEntry] Previous:', prev[projectItemId])
      console.log('[updateRepeatableEntry] New state for', projectItemId, ':', current)
      return newState
    })
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

  // DB 필드 옵션 파싱
  const parseFieldOptions = (optionsJson: string | null): string[] => {
    if (!optionsJson) return []
    try {
      return JSON.parse(optionsJson)
    } catch {
      return []
    }
  }

  // 단일 필드 렌더링 (DB 기반)
  const renderSingleField = (
    field: { field_name: string; field_label: string; field_type: string; field_options: string | null; placeholder: string | null },
    value: any,
    onChange: (value: any) => void
  ) => {
    const options = parseFieldOptions(field.field_options)

    switch (field.field_type) {
      case 'select':
        console.log('[renderSingleField] Select field:', field.field_name, 'current value:', value, 'type:', typeof value)
        return (
          <Select
            placeholder={field.placeholder || `${field.field_label} 선택`}
            value={value !== undefined && value !== null && value !== '' ? value : undefined}
            onChange={(val) => {
              console.log('[Select onChange]', field.field_name, 'new value:', val, 'previous:', value)
              onChange(val)
            }}
            onBlur={() => {
              console.log('[Select onBlur]', field.field_name, 'value at blur:', value)
            }}
            style={{ width: '100%' }}
            getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
          >
            {options.map(opt => (
              <Select.Option key={opt} value={opt}>{opt}</Select.Option>
            ))}
          </Select>
        )

      case 'number':
        return (
          <InputNumber
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={onChange}
            style={{ width: '100%' }}
          />
        )

      case 'textarea':
        return (
          <TextArea
            rows={3}
            placeholder={field.placeholder || field.field_label}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )

      case 'file':
        // 파일은 별도 Upload 컴포넌트로 처리 (카드 하단에 표시)
        return null

      case 'text':
      default:
        return (
          <Input
            placeholder={field.placeholder || field.field_label}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )
    }
  }

  // DB 필드 기반 동적 렌더링 (repeatable용)
  const renderDynamicFields = (
    fields: { field_name: string; field_label: string; field_type: string; field_options: string | null; placeholder: string | null; display_order: number }[],
    entry: any,
    updateField: (fieldName: string, value: any) => void
  ) => {
    console.log('[renderDynamicFields] entry object:', JSON.stringify(entry))
    console.log('[renderDynamicFields] entry keys:', Object.keys(entry || {}))
    // file 타입 필드 제외하고 정렬
    const sortedFields = [...fields]
      .filter(f => f.field_type !== 'file')
      .sort((a, b) => a.display_order - b.display_order)

    // 기간 필드 예시 표시 여부 확인
    const isPeriodField = (fieldName: string, fieldLabel: string) =>
      fieldName === '기간' || fieldName === '근무기간' ||
      fieldLabel === '기간' || fieldLabel === '근무기간'

    // 2열 그리드로 표시 (textarea는 전체 너비)
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {sortedFields.filter(f => f.field_type !== 'textarea').map(field => (
            <div key={field.field_name}>
              <label className="block text-sm text-gray-600 mb-1">
                {field.field_label}
                {isPeriodField(field.field_name, field.field_label) && (
                  <span className="text-gray-400 ml-2 text-xs">(예시: 2020년1월-2022년12월)</span>
                )}
              </label>
              {renderSingleField(field, entry[field.field_name], (val) => updateField(field.field_name, val))}
            </div>
          ))}
        </div>
        {sortedFields.filter(f => f.field_type === 'textarea').map(field => (
          <div key={field.field_name}>
            <label className="block text-sm text-gray-600 mb-1">
              {field.field_label}
              {isPeriodField(field.field_name, field.field_label) && (
                <span className="text-gray-400 ml-2 text-xs">(예시: 2020년1월-2022년12월)</span>
              )}
            </label>
            {renderSingleField(field, entry[field.field_name], (val) => updateField(field.field_name, val))}
          </div>
        ))}
      </div>
    )
  }

  // Render repeatable input field
  const renderRepeatableInputField = (item: ProjectItem, entryIndex: number, entry: any) => {
    const competencyItem = item.competency_item
    if (!competencyItem) return null

    const template = competencyItem.template
    const config = parseTemplateConfig(competencyItem.template_config)
    const fields = competencyItem.fields || []

    const updateField = (fieldName: string, value: any) => {
      updateRepeatableEntry(item.project_item_id, entryIndex, fieldName, value)
    }

    // DB에 필드가 정의되어 있으면 동적 렌더링 사용
    if (fields.length > 0) {
      return renderDynamicFields(fields, entry, updateField)
    }

    // DB에 필드가 없으면 기존 하드코딩된 로직 (fallback)
    switch (template) {
      case ItemTemplate.TEXT:
        return (
          <TextArea
            rows={3}
            placeholder={competencyItem.description || '답변을 입력해주세요.'}
            value={entry.text || ''}
            onChange={(e) => updateField('text', e.target.value)}
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
            value={entry.number}
            onChange={(val) => updateField('number', val)}
            min={config.min}
            max={config.max}
            addonAfter={config.unit}
          />
        )

      default:
        return (
          <TextArea
            rows={3}
            placeholder={competencyItem.description || '답변을 입력해주세요.'}
            value={entry.text || ''}
            onChange={(e) => updateField('text', e.target.value)}
          />
        )
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
                      : '모든 필수 항목을 입력한 후 제출해주세요.')}
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
              {/* Personal info from user profile - editable */}
              <Card
                size="small"
                title={<><UserOutlined className="mr-2" />개인 정보</>}
                className="mb-4"
                extra={
                  !isViewMode && profileChanged && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<SaveOutlined />}
                      loading={savingProfile}
                      onClick={handleSaveProfile}
                    >
                      기본정보에 반영
                    </Button>
                  )
                }
              >
                {!isViewMode && (
                  <Alert
                    type="info"
                    message="회원정보에서 자동으로 불러옵니다. 수정하면 '기본정보에 반영' 버튼이 활성화됩니다."
                    className="mb-4"
                    showIcon
                  />
                )}
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
              </Card>

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
                    {filteredItems.map((item, itemIndex) => {
                      const competencyItem = item.competency_item
                      if (!competencyItem) return null

                      const isRepeatable = competencyItem.is_repeatable
                      const entries = isRepeatable ? (repeatableData[item.project_item_id] || [{}]) : [{}]
                      const maxEntries = competencyItem.max_entries

                      return (
                        <div key={item.project_item_id}>
                          {entries.map((entry, entryIndex) => {
                            const fileKey = `${item.project_item_id}_${entryIndex}`
                            const hasFile = !!uploadedFiles[fileKey]

                            return (
                              <Card
                                key={entryIndex}
                                size="small"
                                className="mb-2"
                                title={
                                  <Space>
                                    <span className="font-medium">
                                      {itemIndex + 1}.{isRepeatable ? ` ${competencyItem.item_name} #${entryIndex + 1}` : ` ${competencyItem.item_name}`}
                                    </span>
                                    {item.is_required && <Tag color="red">필수</Tag>}
                                    {isRepeatable && <Tag color="blue">복수 입력 가능</Tag>}
                                  </Space>
                                }
                                extra={
                                  !isViewMode && isRepeatable && entries.length > 1 && (
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<MinusCircleOutlined />}
                                      onClick={() => removeRepeatableEntry(item.project_item_id, entryIndex)}
                                    >
                                      삭제
                                    </Button>
                                  )
                                }
                              >
                                {competencyItem.description && (
                                  <Text type="secondary" className="block mb-3 text-sm">
                                    {competencyItem.description}
                                  </Text>
                                )}

                                {/* Input field based on template */}
                                {isRepeatable ? (
                                  <div className="mb-3">
                                    {renderRepeatableInputField(item, entryIndex, entry)}
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
                                  const fileInfo = uploadedFiles[fileKey]
                                  const isUploading = fileInfo?.uploading
                                  return (proofLevel === 'required' || proofLevel === 'optional') && (
                                  <div className="flex items-center gap-2 pt-2 border-t">
                                    {isViewMode ? (
                                      // View mode: just show file info
                                      hasFile ? (
                                        <Tag color="green" icon={<CheckCircleOutlined />}>
                                          {fileInfo?.file?.name || fileInfo?.filename || '첨부파일'}
                                        </Tag>
                                      ) : (
                                        <Text type="secondary">첨부파일 없음</Text>
                                      )
                                    ) : (
                                      // Edit mode: show upload/delete buttons
                                      <>
                                        {!hasFile ? (
                                          <Upload
                                            maxCount={1}
                                            showUploadList={false}
                                            beforeUpload={(file) => {
                                              handleFileUpload(fileKey, file)
                                              return false
                                            }}
                                          >
                                            <Button icon={<UploadOutlined />} size="small">
                                              {proofLevel === 'required' ? '증빙첨부 (필수)' : '증빙첨부 (선택)'}
                                            </Button>
                                          </Upload>
                                        ) : isUploading ? (
                                          <div className="flex items-center gap-2">
                                            <Tag color="processing" icon={<LoadingOutlined />}>
                                              {fileInfo?.file?.name || fileInfo?.filename} 업로드 중...
                                            </Tag>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <Tag color="green" icon={<CheckCircleOutlined />}>
                                              {fileInfo?.file?.name || fileInfo?.filename}
                                            </Tag>
                                            <Button
                                              type="text"
                                              danger
                                              size="small"
                                              icon={<DeleteOutlined />}
                                              onClick={async () => {
                                                // 서버에서도 파일 삭제
                                                if (fileInfo?.file_id) {
                                                  try {
                                                    await fileService.deleteFile(fileInfo.file_id)
                                                  } catch (error) {
                                                    console.error('파일 삭제 실패:', error)
                                                  }
                                                }
                                                setUploadedFiles(prev => {
                                                  const newFiles = { ...prev }
                                                  delete newFiles[fileKey]
                                                  return newFiles
                                                })
                                              }}
                                            >
                                              삭제
                                            </Button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )})()}

                                {/* 역량 지갑 연동 정보 표시 (파일명, 크기, 검토상태) */}
                                {(() => {
                                  const linkedData = linkedCompetencyData[item.project_item_id]
                                  if (!linkedData) return null

                                  // linked_competency 정보 우선, 없으면 submitted 정보 사용
                                  const fileInfo = linkedData.linked_competency_file_info || linkedData.submitted_file_info
                                  const verificationStatus = linkedData.linked_competency_verification_status || linkedData.verification_status

                                  return (
                                    <div className="mt-3 pt-3 border-t border-dashed">
                                      {/* 파일 정보 표시 */}
                                      {fileInfo && (
                                        <div className="flex items-center gap-2 mb-2">
                                          <DownloadOutlined className="text-blue-500" />
                                          <Button
                                            type="link"
                                            size="small"
                                            className="p-0"
                                            onClick={() => handleFileDownload(fileInfo.file_id, fileInfo.original_filename)}
                                          >
                                            {fileInfo.original_filename}
                                          </Button>
                                          <Text type="secondary" className="text-xs">
                                            ({(fileInfo.file_size / 1024).toFixed(1)} KB)
                                          </Text>
                                        </div>
                                      )}

                                      {/* 검토 상태 표시 */}
                                      {verificationStatus && (
                                        <div className="flex items-center gap-2">
                                          <Text type="secondary" className="text-xs">검토상태:</Text>
                                          {getVerificationStatusTag(verificationStatus)}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </Card>
                            )
                          })}

                          {/* 항목 추가 버튼 (repeatable인 경우, view 모드에서는 숨김) */}
                          {!isViewMode && isRepeatable && (
                            <Button
                              type="dashed"
                              onClick={() => addRepeatableEntry(item.project_item_id, maxEntries ?? undefined)}
                              block
                              className="mb-4"
                              disabled={maxEntries ? entries.length >= maxEntries : false}
                            >
                              + {competencyItem.item_name} 추가
                              {maxEntries && ` (${entries.length}/${maxEntries})`}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </Space>
                </Card>
              ) : null
              })()}

              {/* Show message if no survey items (after filtering out user profile items) */}
              {projectItems.filter(item =>
                item.competency_item && !USER_PROFILE_ITEM_CODES.includes(item.competency_item.item_code)
              ).length === 0 && (
                <Alert
                  type="info"
                  message="추가 설문 항목 없음"
                  description="이 과제에는 추가로 입력할 설문 항목이 없습니다. 개인 정보와 기본 정보만 확인 후 제출해주세요."
                  className="mb-4"
                  showIcon
                />
              )}

              <Form.Item className="mb-0">
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
          </Card>
        )}
      </div>
    </div>
  )
}
