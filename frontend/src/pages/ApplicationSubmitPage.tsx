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
  Descriptions
} from 'antd'
import { ArrowLeftOutlined, SendOutlined, UploadOutlined, InfoCircleOutlined, UserOutlined, PlusOutlined, MinusCircleOutlined, CheckCircleOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import projectService, { ProjectDetail, ProjectItem, ItemTemplate } from '../services/projectService'
import applicationService, { ApplicationSubmitRequest, ApplicationDataSubmit } from '../services/applicationService'
import authService, { UserUpdateData } from '../services/authService'
import { useAuthStore } from '../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

// 사용자 프로필 항목 코드 (설문에서 제외됨 - 개인정보는 프로필에서 표시)
const USER_PROFILE_ITEM_CODES = [
  'BASIC_NAME', 'BASIC_PHONE', 'BASIC_EMAIL', 'BASIC_ADDRESS',
  'BASIC_GENDER', 'BASIC_BIRTHDATE', 'DETAIL_COACHING_AREA', 'DETAIL_CERT_NUMBER'
]

export default function ApplicationSubmitPage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const applicationIdParam = searchParams.get('applicationId')
  const isEditMode = !!applicationIdParam

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([])
  const [profileChanged, setProfileChanged] = useState(false)
  const [repeatableData, setRepeatableData] = useState<Record<number, any[]>>({})
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, any>>({})
  const [existingApplicationId, setExistingApplicationId] = useState<number | null>(null)
  const { user, setUser } = useAuthStore()

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

        // motivation, applied_role 설정
        form.setFieldsValue({
          motivation: existingApp.motivation,
          applied_role: existingApp.applied_role
        })

        // 기존 응답 데이터를 폼에 설정
        const formValues: Record<string, any> = {}
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
        })

        form.setFieldsValue(formValues)
      }

      setRepeatableData(initialRepeatableData)
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
    setRepeatableData(prev => {
      const current = [...(prev[projectItemId] || [{}])]
      current[entryIndex] = { ...current[entryIndex], [fieldName]: value }
      return { ...prev, [projectItemId]: current }
    })
  }

  // 파일 업로드 상태 업데이트
  const handleFileUpload = (key: string, file: any) => {
    setUploadedFiles(prev => ({ ...prev, [key]: file }))
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
        return (
          <Select
            placeholder={field.placeholder || `${field.field_label} 선택`}
            value={value}
            onChange={onChange}
            style={{ width: '100%' }}
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

        if (isRepeatable) {
          // 반복 가능 항목은 repeatableData에서 가져옴
          const entries = repeatableData[item.project_item_id] || []
          if (entries.length > 0) {
            submittedValue = JSON.stringify(entries)
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
        }

        return {
          item_id: competencyItem?.item_id || 0,
          submitted_value: submittedValue,
          submitted_file_id: null // TODO: Handle file uploads
        }
      }).filter(data => data.item_id > 0)

      // 3. Submit application with all data
      const submitData: ApplicationSubmitRequest = {
        motivation: values.motivation || null,
        applied_role: values.applied_role || null,
        custom_answers: [], // Legacy - no longer used
        application_data: applicationData
      }

      await applicationService.submitApplication(applicationId, submitData)
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
            <div className="mb-6">
              <Title level={3} className="mb-2">{isEditMode ? '지원서 수정' : '지원서 작성'}</Title>
              <Text className="text-gray-600">
                {isEditMode
                  ? '제출한 지원서를 수정할 수 있습니다. 수정 후 다시 제출해주세요.'
                  : '모든 필수 항목을 입력한 후 제출해주세요.'}
              </Text>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
            >
              {/* Personal info from user profile - editable */}
              <Card
                size="small"
                title={<><UserOutlined className="mr-2" />개인 정보</>}
                className="mb-4"
                extra={
                  profileChanged && (
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
                <Alert
                  type="info"
                  message="회원정보에서 자동으로 불러옵니다. 수정하면 '기본정보에 반영' 버튼이 활성화됩니다."
                  className="mb-4"
                  showIcon
                />
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
                  <Alert
                    type="info"
                    message="아래 항목들은 과제 관리자가 취합하고자 하는 정보입니다. 정확하게 입력해주세요."
                    className="mb-4"
                    showIcon
                    icon={<InfoCircleOutlined />}
                  />
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
                                  isRepeatable && entries.length > 1 && (
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
                                  return (proofLevel === 'required' || proofLevel === 'optional') && (
                                  <div className="flex items-center gap-2 pt-2 border-t">
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
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <Tag color="green" icon={<CheckCircleOutlined />}>
                                          {uploadedFiles[fileKey]?.name}
                                        </Tag>
                                        <Button
                                          type="text"
                                          danger
                                          size="small"
                                          icon={<DeleteOutlined />}
                                          onClick={() => {
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
                                  </div>
                                )})()}
                              </Card>
                            )
                          })}

                          {/* 항목 추가 버튼 (repeatable인 경우) */}
                          {isRepeatable && (
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => addRepeatableEntry(item.project_item_id, maxEntries)}
                              block
                              className="mb-4"
                              disabled={maxEntries ? entries.length >= maxEntries : false}
                            >
                              {competencyItem.item_name} 추가
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
                    onClick={() => navigate('/coach/projects')}
                  >
                    취소
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={submitting}
                    icon={<SendOutlined />}
                  >
                    {isEditMode ? '수정사항 제출' : '지원서 제출'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}
      </div>
    </div>
  )
}
