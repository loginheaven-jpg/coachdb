import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Popconfirm,
  Space,
  Upload,
  UploadFile,
  Collapse,
  InputNumber,
  DatePicker,
  Table
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
  FileOutlined,
  DownloadOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import authService from '../services/authService'
import competencyService, { CoachCompetency, CompetencyItem } from '../services/competencyService'
import educationService from '../services/educationService'
import fileService from '../services/fileService'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const { Panel } = Collapse

// 학위 레벨 한글 매핑
const DEGREE_LEVEL_LABELS: Record<string, string> = {
  'bachelor': '학사',
  'master': '석사',
  'doctorate': '박사',
  'none': '없음'
}

// 편집된 값을 원래 JSON 형식으로 재구성하는 헬퍼 함수
const rebuildValueWithOriginalFormat = (
  newValue: string,
  originalValue: string | null,
  fileId?: number
): string => {
  if (!originalValue) {
    // 원본이 없으면 그대로 반환
    return newValue
  }

  try {
    const parsed = JSON.parse(originalValue)

    // 배열인 경우 (예: 자격증 목록)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const firstItem = parsed[0]

      // cert_name 형식인 경우
      if ('cert_name' in firstItem) {
        const rebuilt: Record<string, unknown> = { cert_name: newValue }
        if (fileId) rebuilt._file_id = fileId
        return JSON.stringify([rebuilt])
      }

      // text 형식인 경우
      if ('text' in firstItem) {
        const rebuilt: Record<string, unknown> = { text: newValue }
        if (fileId) rebuilt._file_id = fileId
        return JSON.stringify([rebuilt])
      }

      // name 형식인 경우
      if ('name' in firstItem) {
        const rebuilt: Record<string, unknown> = { name: newValue }
        if (fileId) rebuilt._file_id = fileId
        return JSON.stringify([rebuilt])
      }
    }

    // 객체인 경우
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      if ('cert_name' in parsed) {
        const rebuilt: Record<string, unknown> = { cert_name: newValue }
        if (fileId) rebuilt._file_id = fileId
        return JSON.stringify(rebuilt)
      }
      if ('text' in parsed) {
        const rebuilt: Record<string, unknown> = { text: newValue }
        if (fileId) rebuilt._file_id = fileId
        return JSON.stringify(rebuilt)
      }
    }

    // 원본 형식을 알 수 없으면 그대로 반환
    return newValue
  } catch {
    // JSON 파싱 실패 시 그대로 반환
    return newValue
  }
}

// JSON 값에서 편집용 텍스트 추출하는 헬퍼 함수
const extractEditableValue = (value: string | null | undefined): string => {
  if (!value) return ''

  try {
    const parsed = JSON.parse(value)

    // 배열인 경우 (예: 자격증 목록)
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return ''

      // 첫 번째 항목에서 사용자가 입력한 값 추출
      const firstItem = parsed[0]
      if (firstItem.cert_name) return firstItem.cert_name
      if (firstItem.text) return firstItem.text
      if (firstItem.name) return firstItem.name

      // 기타: _로 시작하지 않는 첫 번째 문자열 값 반환
      for (const [key, val] of Object.entries(firstItem)) {
        if (!key.startsWith('_') && typeof val === 'string') {
          return val
        }
      }
    }

    // 객체인 경우
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.cert_name) return parsed.cert_name
      if (parsed.text) return parsed.text
      if (parsed.name) return parsed.name

      // degree_type이 있으면 학위 정보
      if (parsed.degree_type) {
        return parsed.degree_type
      }
    }

    return value
  } catch {
    return value
  }
}

// JSON 값을 보기 좋게 포맷팅하는 헬퍼 함수
const formatCompetencyValue = (value: string | null | undefined): React.ReactNode => {
  if (!value) return '-'

  try {
    const parsed = JSON.parse(value)

    // 배열인 경우 (예: 자격증 목록)
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return '-'

      return (
        <ul className="list-disc list-inside space-y-1">
          {parsed.map((entry, idx) => {
            // cert_name이 있는 경우 (자격증)
            if (entry.cert_name) {
              return <li key={idx}>{entry.cert_name}</li>
            }
            // text가 있는 경우 (일반 텍스트 항목)
            if (entry.text) {
              return <li key={idx}>{entry.text}</li>
            }
            // 기타 객체
            const displayText = Object.entries(entry)
              .filter(([k]) => !k.startsWith('_') && k !== 'file_id')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
            return displayText ? <li key={idx}>{displayText}</li> : null
          })}
        </ul>
      )
    }

    // 객체인 경우 (예: 학위 정보)
    if (typeof parsed === 'object' && parsed !== null) {
      // degree_type이 있으면 학위 정보
      if (parsed.degree_type) {
        const degreeLevel = DEGREE_LEVEL_LABELS[parsed.degree_type] || parsed.degree_type
        const parts = [degreeLevel]
        // 숫자 키가 있으면 추가 정보 (예: 전공명)
        Object.entries(parsed).forEach(([k, v]) => {
          if (k !== 'degree_type' && !k.startsWith('_') && v) {
            if (typeof v === 'string' && v.trim()) {
              parts.push(v as string)
            }
          }
        })
        return parts.join(' - ')
      }

      // 기타 객체: 키-값 나열
      const displayParts = Object.entries(parsed)
        .filter(([k, v]) => !k.startsWith('_') && k !== 'file_id' && v)
        .map(([k, v]) => `${v}`)
      return displayParts.length > 0 ? displayParts.join(', ') : value
    }

    // 그 외 (문자열로 파싱된 경우)
    return String(parsed)
  } catch {
    // JSON 파싱 실패 시 원본 반환
    return value
  }
}

interface GroupedItems {
  [category: string]: CompetencyItem[]
}

interface EducationHistory {
  education_id: number
  education_name: string
  institution?: string
  completion_date?: string
  hours?: number
  certificate_file_id?: number
  created_at: string
  updated_at?: string
}

export default function UnifiedCompetencyPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [competencies, setCompetencies] = useState<CoachCompetency[]>([])
  const [competencyItems, setCompetencyItems] = useState<CompetencyItem[]>([])
  const [groupedItems, setGroupedItems] = useState<GroupedItems>({})
  const [educationHistory, setEducationHistory] = useState<EducationHistory[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEducationModalVisible, setIsEducationModalVisible] = useState(false)
  const [editingCompetency, setEditingCompetency] = useState<CoachCompetency | null>(null)
  const [editingEducation, setEditingEducation] = useState<EducationHistory | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploadedFileId, setUploadedFileId] = useState<number | undefined>(undefined)
  const [selectedItemType, setSelectedItemType] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [originalValue, setOriginalValue] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [educationForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [competenciesData, itemsData] = await Promise.all([
        competencyService.getMyCompetencies(),
        competencyService.getCompetencyItems()
      ])
      setCompetencies(competenciesData)
      setCompetencyItems(itemsData)

      // 역량 항목을 카테고리별로 그룹화
      const grouped: GroupedItems = {}
      itemsData.forEach(item => {
        const category = item.category || 'DETAIL'
        if (!grouped[category]) {
          grouped[category] = []
        }
        grouped[category].push(item)
      })
      setGroupedItems(grouped)

      // Load education history
      const educationData = await educationService.getMyEducationHistory()
      setEducationHistory(educationData)
    } catch (error: any) {
      console.error('역량 데이터 로드 실패:', error)
      if (error.response?.status === 401) {
        message.error('인증이 만료되었습니다. 잠시 후 로그인 페이지로 이동합니다.')
      } else {
        message.error('데이터를 불러오는데 실패했습니다. ' + (error.response?.data?.detail || error.message))
      }
      setCompetencies([])
      setCompetencyItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    authService.logout()
    logout()
    message.success('로그아웃되었습니다.')
    navigate('/login')
  }

  const handleAdd = (category: string, item?: CompetencyItem) => {
    setEditingCompetency(null)
    setFileList([])
    setUploadedFileId(undefined)
    setSelectedCategory(category)
    setOriginalValue(null)

    if (item) {
      setSelectedItemType(item.input_type)
      form.setFieldsValue({ item_id: item.item_id })
    } else {
      setSelectedItemType('')
      form.resetFields()
    }

    setIsModalVisible(true)
  }

  const handleEdit = (record: CoachCompetency) => {
    setEditingCompetency(record)
    setFileList([])
    setUploadedFileId(record.file_id)
    setSelectedItemType(record.competency_item?.input_type || '')
    setSelectedCategory(record.competency_item?.category || 'DETAIL')
    setOriginalValue(record.value || null)
    form.setFieldsValue({
      item_id: record.item_id,
      value: extractEditableValue(record.value)
    })
    setIsModalVisible(true)
  }

  const handleDelete = async (competencyId: number) => {
    try {
      await competencyService.deleteCompetency(competencyId)
      message.success('역량이 삭제되었습니다.')
      loadData()
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || '알 수 없는 오류가 발생했습니다.'
      message.error('역량 삭제에 실패했습니다: ' + errorMsg)
    }
  }

  const handleItemChange = (itemId: number) => {
    const selected = competencyItems.find(item => item.item_id === itemId)
    setSelectedItemType(selected?.input_type || '')
  }

  const handleFileChange = (info: { fileList: UploadFile[] }) => {
    setFileList(info.fileList.slice(-1))
  }

  const beforeFileUpload = (file: File) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png']
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!allowedTypes.includes(fileExt)) {
      message.error(`${fileExt} 파일은 업로드할 수 없습니다. PDF, JPG, PNG 파일만 가능합니다.`)
      return Upload.LIST_IGNORE
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      message.error('파일 크기는 10MB를 초과할 수 없습니다.')
      return Upload.LIST_IGNORE
    }

    return false
  }

  const handleFileUpload = async (): Promise<number | undefined> => {
    if (fileList.length === 0) return undefined

    const file = fileService.getFileFromUpload(fileList[0])
    if (!file) {
      message.error('파일을 선택해주세요.')
      return undefined
    }

    try {
      setUploading(true)
      const response = await fileService.uploadFile(file, 'proof')
      message.success('파일이 업로드되었습니다.')
      return response.file_id
    } catch (error: any) {
      message.error('파일 업로드에 실패했습니다: ' + (error.response?.data?.detail || error.message))
      return undefined
    } finally {
      setUploading(false)
    }
  }

  const handleFileDownload = async (fileId: number, filename: string) => {
    try {
      await fileService.downloadAndSave(fileId, filename)
      message.success('파일 다운로드가 시작되었습니다.')
    } catch (error: any) {
      message.error('파일 다운로드에 실패했습니다.')
    }
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      if (selectedItemType === 'file') {
        if (!editingCompetency && fileList.length === 0) {
          message.error('파일 타입 역량 항목은 파일 업로드가 필수입니다.')
          return
        }
        if (editingCompetency && !uploadedFileId && fileList.length === 0) {
          message.error('파일 타입 역량 항목은 파일 업로드가 필수입니다.')
          return
        }
      }

      setLoading(true)

      let fileId = uploadedFileId
      if (fileList.length > 0) {
        const newFileId = await handleFileUpload()
        if (newFileId === undefined) {
          setLoading(false)
          return
        }
        fileId = newFileId
      }

      if (editingCompetency) {
        // 원래 JSON 형식으로 재구성하여 저장
        const valueToSave = rebuildValueWithOriginalFormat(values.value, originalValue, fileId)
        await competencyService.updateCompetency(editingCompetency.competency_id, {
          value: valueToSave,
          file_id: fileId
        })
        message.success('역량이 수정되었습니다.')
      } else {
        await competencyService.createCompetency({
          item_id: values.item_id,
          value: values.value,
          file_id: fileId
        })
        message.success('역량이 추가되었습니다.')
      }

      setIsModalVisible(false)
      form.resetFields()
      setFileList([])
      setUploadedFileId(undefined)
      setOriginalValue(null)
      loadData()
    } catch (error: any) {
      if (error.errorFields) {
        return
      }
      const errorMsg = error.response?.data?.detail || error.message || '알 수 없는 오류가 발생했습니다.'
      message.error((editingCompetency ? '역량 수정에 실패했습니다: ' : '역량 추가에 실패했습니다: ') + errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
    form.resetFields()
    setFileList([])
    setUploadedFileId(undefined)
    setEditingCompetency(null)
    setSelectedItemType('')
    setOriginalValue(null)
  }

  const handleAddEducation = () => {
    setEditingEducation(null)
    setFileList([])
    setUploadedFileId(undefined)
    educationForm.resetFields()
    setIsEducationModalVisible(true)
  }

  const handleEditEducation = (record: EducationHistory) => {
    setEditingEducation(record)
    setFileList([])
    setUploadedFileId(record.certificate_file_id || undefined)
    educationForm.setFieldsValue({
      education_name: record.education_name,
      institution: record.institution,
      completion_date: record.completion_date ? dayjs(record.completion_date) : null,
      hours: record.hours
    })
    setIsEducationModalVisible(true)
  }

  const handleDeleteEducation = async (educationId: number) => {
    try {
      await educationService.deleteEducationHistory(educationId)
      message.success('학력이 삭제되었습니다.')
      loadData()
    } catch (error: any) {
      message.error('학력 삭제에 실패했습니다.')
    }
  }

  const handleEducationModalOk = async () => {
    try {
      const values = await educationForm.validateFields()

      setLoading(true)

      let fileId = uploadedFileId
      if (fileList.length > 0) {
        const newFileId = await handleFileUpload()
        if (newFileId === undefined) {
          setLoading(false)
          return
        }
        fileId = newFileId
      }

      const educationData = {
        education_name: values.education_name,
        institution: values.institution,
        completion_date: values.completion_date ? values.completion_date.format('YYYY-MM-DD') : null,
        hours: values.hours,
        certificate_file_id: fileId
      }

      if (editingEducation) {
        await educationService.updateEducationHistory(editingEducation.education_id, educationData)
        message.success('학력이 수정되었습니다.')
      } else {
        await educationService.createEducationHistory(educationData)
        message.success('학력이 추가되었습니다.')
      }

      setIsEducationModalVisible(false)
      educationForm.resetFields()
      setFileList([])
      setUploadedFileId(undefined)
      loadData()
    } catch (error: any) {
      if (error.errorFields) {
        return
      }
      const errorMsg = error.response?.data?.detail || error.message || '알 수 없는 오류가 발생했습니다.'
      message.error((editingEducation ? '학력 수정에 실패했습니다: ' : '학력 추가에 실패했습니다: ') + errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleEducationModalCancel = () => {
    setIsEducationModalVisible(false)
    educationForm.resetFields()
    setFileList([])
    setUploadedFileId(undefined)
    setEditingEducation(null)
  }

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '검토중' },
      approved: { color: 'green', icon: <CheckCircleOutlined />, text: '승인' },
      rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '반려' },
      supplemented: { color: 'blue', icon: <ClockCircleOutlined />, text: '보완요청' }
    }
    const config = statusMap[status] || statusMap.pending
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  // 카테고리별로 역량 데이터 필터링
  const getCompetenciesForCategory = (category: string) => {
    return competencies.filter(comp => {
      const itemCategory = comp.competency_item?.category || 'DETAIL'
      return itemCategory === category
    })
  }

  // 특정 항목에 대한 모든 역량 찾기 (repeatable 항목용)
  const getCompetenciesForItem = (itemId: number): CoachCompetency[] => {
    return competencies.filter(comp => comp.item_id === itemId)
  }

  const renderCompetencyCard = (comp: CoachCompetency, entryIndex?: number, showItemName: boolean = true) => (
    <Card size="small" className="mb-2" key={comp.competency_id}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {showItemName && (
            <div className="font-medium">
              {comp.competency_item?.item_name}
              {entryIndex !== undefined && (
                <span className="text-gray-500 ml-1">#{entryIndex + 1}</span>
              )}
            </div>
          )}
          {!showItemName && entryIndex !== undefined && (
            <div className="font-medium text-gray-500">#{entryIndex + 1}</div>
          )}

          {comp.value && (
            <div className="mt-2">
              {formatCompetencyValue(comp.value)}
            </div>
          )}

          {comp.file_info && (
            <div className="mt-2">
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleFileDownload(comp.file_id!, comp.file_info!.original_filename)}
                className="p-0"
              >
                {comp.file_info.original_filename}
              </Button>
              <Text type="secondary" className="text-xs ml-2">
                ({(comp.file_info.file_size / 1024).toFixed(1)} KB)
              </Text>
            </div>
          )}

          <div className="mt-2">
            {getStatusTag(comp.verification_status)}
          </div>
        </div>

        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(comp)}
            disabled={comp.verification_status === 'approved'}
            size="small"
          />
          <Popconfirm
            title="이 역량을 삭제하시겠습니까?"
            onConfirm={() => handleDelete(comp.competency_id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      </div>
    </Card>
  )

  const renderBasicInfoSection = () => {
    return (
      <Panel header="기본정보 (평가 대상 아님)" key="BASIC">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Text strong>이름</Text>
              <div><Text>{user?.name || '-'}</Text></div>
            </div>
            <div>
              <Text strong>이메일</Text>
              <div><Text>{user?.email || '-'}</Text></div>
            </div>
            <div>
              <Text strong>전화번호</Text>
              <div><Text>{user?.phone || '-'}</Text></div>
            </div>
            <div>
              <Text strong>주소</Text>
              <div><Text>{user?.address || '-'}</Text></div>
            </div>
            <div className="col-span-2">
              <Text strong>주소</Text>
              <div><Text>{user?.address || '-'}</Text></div>
              <Text type="secondary" className="text-xs">※ 주소 정보</Text>
            </div>
          </div>
        </div>
      </Panel>
    )
  }

  // 공통 섹션 렌더링 함수
  const renderCategorySection = (category: string, title: string, description?: string) => {
    const items = groupedItems[category] || []
    const categoryCompetencies = getCompetenciesForCategory(category)
    // 진행률: 고유 item_id 개수 기준으로 계산
    const itemsWithData = new Set(categoryCompetencies.map(c => c.item_id)).size

    return (
      <Panel header={`${title} (${itemsWithData}/${items.length})`} key={category}>
        <div className="space-y-4">
          {description && (
            <Text type="secondary" className="block mb-4">{description}</Text>
          )}
          {items.map(item => {
            const isRepeatable = item.is_repeatable
            const existingComps = getCompetenciesForItem(item.item_id)
            const maxEntries = item.max_entries
            const canAddMore = isRepeatable
              ? (!maxEntries || existingComps.length < maxEntries)
              : existingComps.length === 0

            // Repeatable 항목: 헤더 + 모든 엔트리 표시
            if (isRepeatable) {
              return (
                <div key={item.item_id} className="mb-4">
                  {/* Repeatable 항목 헤더 */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Text strong>{item.item_name}</Text>
                      <Tag color="blue">복수 입력 가능</Tag>
                      {maxEntries && (
                        <Text type="secondary">({existingComps.length}/{maxEntries})</Text>
                      )}
                      {!maxEntries && existingComps.length > 0 && (
                        <Text type="secondary">({existingComps.length}개)</Text>
                      )}
                    </div>
                    {canAddMore && (
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => handleAdd(category, item)}
                      >
                        추가
                      </Button>
                    )}
                  </div>

                  {/* 모든 기존 항목 표시 */}
                  {existingComps.map((comp, idx) =>
                    renderCompetencyCard(comp, idx, false)
                  )}

                  {/* 항목 없을 때 안내 */}
                  {existingComps.length === 0 && (
                    <Card size="small" className="border-dashed">
                      <div className="text-center py-2">
                        <Text type="secondary">등록된 항목이 없습니다.</Text>
                      </div>
                    </Card>
                  )}
                </div>
              )
            }

            // Non-repeatable 항목: 기존 동작 유지
            if (existingComps.length > 0) {
              return renderCompetencyCard(existingComps[0])
            } else {
              return (
                <Card size="small" className="mb-2 border-dashed" key={item.item_id}>
                  <div className="flex justify-between items-center">
                    <div>
                      <Text type="secondary">{item.item_name}</Text>
                      {item.input_type === 'file' && (
                        <FileOutlined className="ml-2 text-blue-500" />
                      )}
                    </div>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleAdd(category, item)}
                    >
                      추가
                    </Button>
                  </div>
                </Card>
              )
            }
          })}
          {items.length === 0 && (
            <Text type="secondary">등록된 항목이 없습니다.</Text>
          )}
        </div>
      </Panel>
    )
  }

  const renderCertificationSection = () => {
    return renderCategorySection('CERTIFICATION', '자격증', '코칭 관련 자격증, 상담/심리치료 자격 등을 등록하세요.')
  }

  const renderExperienceSection = () => {
    return renderCategorySection('EXPERIENCE', '역량이력', '코칭 경력, 누적 코칭 시간, 멘토링 경험 등을 등록하세요.')
  }

  const renderOtherSection = () => {
    return renderCategorySection('OTHER', '기타', '전문 분야, 자기소개 등을 등록하세요.')
  }

  const renderEducationSection = () => {
    const educationColumns = [
      {
        title: '교육명',
        dataIndex: 'education_name',
        key: 'education_name',
      },
      {
        title: '교육기관',
        dataIndex: 'institution',
        key: 'institution',
        render: (text: string) => text || '-'
      },
      {
        title: '이수일',
        dataIndex: 'completion_date',
        key: 'completion_date',
        render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-'
      },
      {
        title: '교육시간',
        dataIndex: 'hours',
        key: 'hours',
        render: (hours: number) => hours ? `${hours}시간` : '-'
      },
      {
        title: '수료증',
        dataIndex: 'certificate_file_id',
        key: 'certificate_file_id',
        render: (fileId: number) => fileId ? <FileOutlined style={{ color: '#1890ff' }} /> : '-'
      },
      {
        title: '작업',
        key: 'action',
        render: (_: any, record: EducationHistory) => (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditEducation(record)}
              size="small"
            />
            <Popconfirm
              title="이 학력을 삭제하시겠습니까?"
              onConfirm={() => handleDeleteEducation(record.education_id)}
              okText="삭제"
              cancelText="취소"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Popconfirm>
          </Space>
        ),
      },
    ]

    return (
      <Panel
        header={`학력 (${educationHistory.length})`}
        key="EDUCATION"
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              handleAddEducation()
            }}
          >
            학력 추가
          </Button>
        }
      >
        <div className="space-y-4">
          {educationHistory.length === 0 ? (
            <div className="text-center py-4">
              <Text type="secondary">등록된 학력이 없습니다.</Text>
            </div>
          ) : (
            <Table
              columns={educationColumns}
              dataSource={educationHistory}
              rowKey="education_id"
              pagination={false}
              size="small"
            />
          )}
        </div>
      </Panel>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/coach/dashboard')}
          >
            대시보드로 돌아가기
          </Button>
          <Button
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            size="large"
          >
            로그아웃
          </Button>
        </div>

        <Card>
          <div className="mb-6">
            <Title level={2} className="mb-2">역량 및 세부정보 관리</Title>
            <Text className="text-gray-600">
              내 역량과 세부정보를 등록하고 관리할 수 있습니다. 필요한 경우 증빙서류를 업로드하세요.
            </Text>
          </div>

          {loading && !competencyItems.length ? (
            <div className="text-center py-8">데이터를 불러오는 중...</div>
          ) : (
            <Collapse defaultActiveKey={['BASIC', 'CERTIFICATION']}>
              {renderBasicInfoSection()}
              {renderCertificationSection()}
              {renderEducationSection()}
              {renderExperienceSection()}
              {renderOtherSection()}
            </Collapse>
          )}
        </Card>

        {/* Competency Modal */}
        <Modal
          title={editingCompetency ? '역량 수정' : '역량 추가'}
          open={isModalVisible}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          confirmLoading={loading || uploading}
          okText={editingCompetency ? '수정' : '추가'}
          cancelText="취소"
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            name="competency_form"
          >
            <Form.Item
              name="item_id"
              label="역량 항목"
              rules={[{ required: true, message: '역량 항목을 선택해주세요!' }]}
            >
              <Select
                placeholder="역량 항목 선택"
                disabled={!!editingCompetency}
                onChange={handleItemChange}
              >
                {selectedCategory && groupedItems[selectedCategory]?.map(item => (
                  <Option key={item.item_id} value={item.item_id}>
                    {item.item_name}
                    {item.input_type === 'file' && <FileOutlined style={{ marginLeft: 8, color: '#1890ff' }} />}
                  </Option>
                ))}
                {!selectedCategory && competencyItems.map(item => (
                  <Option key={item.item_id} value={item.item_id}>
                    {item.item_name}
                    {item.input_type === 'file' && <FileOutlined style={{ marginLeft: 8, color: '#1890ff' }} />}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {selectedItemType === 'number' ? (
              <Form.Item
                name="value"
                label="값"
                rules={[{ required: true, message: '값을 입력해주세요!' }]}
              >
                <InputNumber
                  className="w-full"
                  placeholder="숫자를 입력하세요"
                />
              </Form.Item>
            ) : selectedItemType !== 'file' && (
              <Form.Item
                name="value"
                label="입력값"
                rules={[{ required: selectedItemType !== 'file', message: '값을 입력해주세요!' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="역량 값을 입력하세요"
                />
              </Form.Item>
            )}

            {selectedItemType === 'file' && (
              <Form.Item
                name="value"
                label="설명 (선택사항)"
              >
                <TextArea
                  rows={2}
                  placeholder="파일에 대한 간단한 설명을 입력하세요 (선택사항)"
                />
              </Form.Item>
            )}

            <Form.Item
              label={selectedItemType === 'file' ? "증빙서류 (필수)" : "증빙서류 (선택사항)"}
              help={selectedItemType === 'file' ? "PDF, JPG, JPEG, PNG 파일만 가능 (최대 10MB)" : "증빙서류가 있다면 업로드하세요"}
            >
              <Upload
                fileList={fileList}
                onChange={handleFileChange}
                beforeUpload={beforeFileUpload}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {fileList.length > 0 ? '다른 파일 선택' : '파일 선택'}
                </Button>
              </Upload>
              {fileList.length > 0 && (
                <div className="mt-2">
                  <Text type="secondary">
                    선택된 파일: {fileList[0].name} ({(fileList[0].size! / 1024).toFixed(1)} KB)
                  </Text>
                </div>
              )}
              {uploadedFileId && fileList.length === 0 && (
                <div className="mt-2">
                  <Text type="secondary">
                    <FileOutlined /> 기존 파일이 업로드되어 있습니다. 새 파일을 선택하면 교체됩니다.
                  </Text>
                </div>
              )}
            </Form.Item>
          </Form>
        </Modal>

        {/* Education History Modal */}
        <Modal
          title={editingEducation ? '학력 수정' : '학력 추가'}
          open={isEducationModalVisible}
          onOk={handleEducationModalOk}
          onCancel={handleEducationModalCancel}
          confirmLoading={loading || uploading}
          okText={editingEducation ? '수정' : '추가'}
          cancelText="취소"
          width={600}
        >
          <Form
            form={educationForm}
            layout="vertical"
            name="education_form"
          >
            <Form.Item
              name="education_name"
              label="교육명"
              rules={[{ required: true, message: '교육명을 입력해주세요!' }]}
            >
              <Input placeholder="교육명을 입력하세요" />
            </Form.Item>

            <Form.Item
              name="institution"
              label="교육기관"
            >
              <Input placeholder="교육기관을 입력하세요" />
            </Form.Item>

            <Form.Item
              name="completion_date"
              label="이수일"
            >
              <DatePicker className="w-full" placeholder="이수일을 선택하세요" />
            </Form.Item>

            <Form.Item
              name="hours"
              label="교육시간"
            >
              <InputNumber
                className="w-full"
                placeholder="교육시간을 입력하세요"
                min={0}
                addonAfter="시간"
              />
            </Form.Item>

            <Form.Item
              label="수료증 (선택사항)"
              help="PDF, JPG, JPEG, PNG 파일만 가능 (최대 10MB)"
            >
              <Upload
                fileList={fileList}
                onChange={handleFileChange}
                beforeUpload={beforeFileUpload}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {fileList.length > 0 ? '다른 파일 선택' : '파일 선택'}
                </Button>
              </Upload>
              {fileList.length > 0 && (
                <div className="mt-2">
                  <Text type="secondary">
                    선택된 파일: {fileList[0].name} ({(fileList[0].size! / 1024).toFixed(1)} KB)
                  </Text>
                </div>
              )}
              {uploadedFileId && fileList.length === 0 && (
                <div className="mt-2">
                  <Text type="secondary">
                    <FileOutlined /> 기존 파일이 업로드되어 있습니다. 새 파일을 선택하면 교체됩니다.
                  </Text>
                </div>
              )}
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  )
}
