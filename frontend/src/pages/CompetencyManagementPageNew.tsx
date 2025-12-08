import { useState, useEffect } from 'react'
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
  DatePicker,
  InputNumber,
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
import certificationService, { CertificationListItem, CertificationType } from '../services/certificationService'
import educationService from '../services/educationService'
import fileService from '../services/fileService'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const { Panel } = Collapse

// 제외할 item_id 목록 (최종학력, 총코칭시간, 강점, 코치자격증, 기타자격증, 상담심리자격증)
const EXCLUDED_ITEM_IDS = [5, 6, 7, 13, 14, 34]

// 카테고리 정의
const BASIC_COMPETENCY_CODES = [
  'DEGREE_COACHING_BACHELOR', 'DEGREE_COACHING_MASTER', 'DEGREE_COACHING_DOCTORATE',
  'DEGREE_OTHER_BACHELOR', 'DEGREE_OTHER_MASTER', 'DEGREE_OTHER_DOCTORATE',
  'EXP_YEARS', 'EXP_HOURS', 'EXP_FIELD', 'EXP_ACHIEVEMENT', 'SPEC_AREA'
]

const COACHING_COMPETENCY_CODES = [
  'FIELD_BUSINESS', 'FIELD_BUSINESS_FILE',
  'FIELD_CAREER', 'FIELD_CAREER_FILE',
  'FIELD_YOUTH', 'FIELD_YOUTH_FILE',
  'FIELD_ADOLESCENT', 'FIELD_ADOLESCENT_FILE',
  'FIELD_FAMILY', 'FIELD_FAMILY_FILE',
  'FIELD_LIFE', 'FIELD_LIFE_FILE',
  'FIELD_MENTORING'
]

interface GroupedItems {
  basic: CompetencyItem[]
  coaching: CompetencyItem[]
  addon: CompetencyItem[]
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

export default function CompetencyManagementPageNew() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [competencies, setCompetencies] = useState<CoachCompetency[]>([])
  const [competencyItems, setCompetencyItems] = useState<CompetencyItem[]>([])
  const [groupedItems, setGroupedItems] = useState<GroupedItems>({ basic: [], coaching: [], addon: [] })
  const [certifications, setCertifications] = useState<CertificationListItem[]>([])
  const [educationHistory, setEducationHistory] = useState<EducationHistory[]>([])

  const [isCompetencyModalVisible, setIsCompetencyModalVisible] = useState(false)
  const [isCertificationModalVisible, setIsCertificationModalVisible] = useState(false)
  const [isEducationModalVisible, setIsEducationModalVisible] = useState(false)

  const [editingCompetency, setEditingCompetency] = useState<CoachCompetency | null>(null)
  const [editingCertification, setEditingCertification] = useState<CertificationListItem | null>(null)
  const [editingEducation, setEditingEducation] = useState<EducationHistory | null>(null)

  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null)
  const [selectedItemType, setSelectedItemType] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const [competencyForm] = Form.useForm()
  const [certificationForm] = Form.useForm()
  const [educationForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [competenciesData, itemsData, certificationsData, educationData] = await Promise.all([
        competencyService.getMyCompetencies(),
        competencyService.getCompetencyItems(),
        certificationService.getMyCertifications(),
        educationService.getMyEducationHistory()
      ])

      setCompetencies(competenciesData)
      setCertifications(certificationsData)
      setEducationHistory(educationData)

      // 제외 항목 필터링 및 그룹화
      const filteredItems = itemsData.filter(item => !EXCLUDED_ITEM_IDS.includes(item.item_id))
      const grouped: GroupedItems = { basic: [], coaching: [], addon: [] }

      filteredItems.forEach(item => {
        if (BASIC_COMPETENCY_CODES.includes(item.item_code)) {
          grouped.basic.push(item)
        } else if (COACHING_COMPETENCY_CODES.includes(item.item_code)) {
          grouped.coaching.push(item)
        } else if (item.category === 'ADDON') {
          grouped.addon.push(item)
        }
      })

      setCompetencyItems(filteredItems)
      setGroupedItems(grouped)
    } catch (error: any) {
      console.error('데이터 로드 실패:', error)
      message.error('데이터를 불러오는데 실패했습니다.')
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

  // Competency handlers
  const handleAddCompetency = (category: string, item?: CompetencyItem) => {
    setEditingCompetency(null)
    setFileList([])
    setUploadedFileId(null)
    setSelectedCategory(category)

    if (item) {
      setSelectedItemType(item.input_type)
      competencyForm.setFieldsValue({ item_id: item.item_id })
    } else {
      setSelectedItemType('')
      competencyForm.resetFields()
    }

    setIsCompetencyModalVisible(true)
  }

  const handleEditCompetency = (record: CoachCompetency) => {
    setEditingCompetency(record)
    setFileList([])
    setUploadedFileId(record.file_id)
    setSelectedItemType(record.competency_item?.input_type || '')
    setSelectedCategory('') // Not used in edit
    competencyForm.setFieldsValue({
      item_id: record.item_id,
      value: record.value
    })
    setIsCompetencyModalVisible(true)
  }

  const handleDeleteCompetency = async (competencyId: number) => {
    try {
      await competencyService.deleteCompetency(competencyId)
      message.success('역량이 삭제되었습니다.')
      loadData()
    } catch (error: any) {
      message.error('역량 삭제에 실패했습니다.')
    }
  }

  const handleFileChange = (info: { fileList: UploadFile[] }) => {
    setFileList(info.fileList.slice(-1))
  }

  const beforeFileUpload = (file: File) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png']
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!allowedTypes.includes(fileExt)) {
      message.error(`${fileExt} 파일은 업로드할 수 없습니다.`)
      return Upload.LIST_IGNORE
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      message.error('파일 크기는 10MB를 초과할 수 없습니다.')
      return Upload.LIST_IGNORE
    }

    return false
  }

  const handleFileUpload = async () => {
    if (fileList.length === 0) return null

    const file = fileService.getFileFromUpload(fileList[0])
    if (!file) {
      message.error('파일을 선택해주세요.')
      return null
    }

    try {
      setUploading(true)
      const response = await fileService.uploadFile(file, 'proof')
      message.success('파일이 업로드되었습니다.')
      return response.file_id
    } catch (error: any) {
      message.error('파일 업로드에 실패했습니다.')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleCompetencyModalOk = async () => {
    try {
      const values = await competencyForm.validateFields()

      if (selectedItemType === 'file') {
        if (!editingCompetency && fileList.length === 0) {
          message.error('파일 업로드가 필수입니다.')
          return
        }
      }

      setLoading(true)

      let fileId = uploadedFileId
      if (fileList.length > 0) {
        const newFileId = await handleFileUpload()
        if (newFileId === null) {
          setLoading(false)
          return
        }
        fileId = newFileId
      }

      // Convert number to string if needed
      const valueToSend = values.value !== undefined && values.value !== null
        ? String(values.value)
        : undefined

      if (editingCompetency) {
        await competencyService.updateCompetency(editingCompetency.competency_id, {
          value: valueToSend,
          file_id: fileId || undefined
        })
        message.success('역량이 수정되었습니다.')
      } else {
        await competencyService.createCompetency({
          item_id: values.item_id,
          value: valueToSend,
          file_id: fileId || undefined
        })
        message.success('역량이 추가되었습니다.')
      }

      setIsCompetencyModalVisible(false)
      competencyForm.resetFields()
      setFileList([])
      setUploadedFileId(null)
      loadData()
    } catch (error: any) {
      if (error.errorFields) return
      message.error('처리에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Certification handlers
  const handleAddCertification = () => {
    setEditingCertification(null)
    setFileList([])
    setUploadedFileId(null)
    certificationForm.resetFields()
    setIsCertificationModalVisible(true)
  }

  const handleDeleteCertification = async (certificationId: number) => {
    try {
      await certificationService.deleteCertification(certificationId)
      message.success('자격증이 삭제되었습니다.')
      loadData()
    } catch (error: any) {
      message.error('자격증 삭제에 실패했습니다.')
    }
  }

  const handleCertificationModalOk = async () => {
    try {
      const values = await certificationForm.validateFields()

      setLoading(true)

      let fileId = uploadedFileId
      if (fileList.length > 0) {
        const newFileId = await handleFileUpload()
        if (newFileId === null) {
          setLoading(false)
          return
        }
        fileId = newFileId
      }

      const certData = {
        certification_type: values.certification_type,
        certification_name: values.certification_name,
        issuing_organization: values.issuing_organization,
        issue_date: values.issue_date ? values.issue_date.format('YYYY-MM-DD') : null,
        expiry_date: values.expiry_date ? values.expiry_date.format('YYYY-MM-DD') : null,
        certificate_number: values.certificate_number,
        certificate_file_id: fileId
      }

      await certificationService.createCertification(certData)
      message.success('자격증이 추가되었습니다.')

      setIsCertificationModalVisible(false)
      certificationForm.resetFields()
      setFileList([])
      setUploadedFileId(null)
      loadData()
    } catch (error: any) {
      if (error.errorFields) return
      message.error('자격증 추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Education handlers (similar to existing)
  const handleAddEducation = () => {
    setEditingEducation(null)
    setFileList([])
    setUploadedFileId(null)
    educationForm.resetFields()
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
        if (newFileId === null) {
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

      await educationService.createEducationHistory(educationData)
      message.success('학력이 추가되었습니다.')

      setIsEducationModalVisible(false)
      educationForm.resetFields()
      setFileList([])
      setUploadedFileId(null)
      loadData()
    } catch (error: any) {
      if (error.errorFields) return
      message.error('학력 추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'orange', icon: <ClockCircleOutlined />, text: '검토중' },
      approved: { color: 'green', icon: <CheckCircleOutlined />, text: '승인' },
      rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '반려' }
    }
    const config = statusMap[status] || statusMap.pending
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  const getCompetencyForItem = (itemId: number) => {
    return competencies.find(comp => comp.item_id === itemId)
  }

  const renderCompetencyCard = (comp: CoachCompetency) => (
    <Card size="small" className="mb-2" key={comp.competency_id}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-medium">{comp.competency_item?.item_name}</div>
          {comp.value && <div className="mt-2"><Text>{comp.value}</Text></div>}
          {comp.file_info && (
            <div className="mt-2">
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                className="p-0"
              >
                {comp.file_info.original_filename}
              </Button>
            </div>
          )}
          <div className="mt-2">{getStatusTag(comp.verification_status)}</div>
        </div>
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditCompetency(comp)}
            disabled={comp.verification_status === 'approved'}
            size="small"
          />
          <Popconfirm
            title="삭제하시겠습니까?"
            onConfirm={() => handleDeleteCompetency(comp.competency_id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      </div>
    </Card>
  )

  const renderBasicCompetencySection = () => {
    const items = groupedItems.basic
    const categoryCompetencies = competencies.filter(comp => {
      const itemCode = comp.competency_item?.item_code || ''
      return BASIC_COMPETENCY_CODES.includes(itemCode)
    })

    return (
      <Panel header={`기본역량 (${categoryCompetencies.length}/${items.length})`} key="basic">
        <div className="space-y-4">
          {items.map(item => {
            const existingComp = getCompetencyForItem(item.item_id)
            if (existingComp) {
              return renderCompetencyCard(existingComp)
            } else {
              return (
                <Card size="small" className="mb-2 border-dashed" key={item.item_id}>
                  <div className="flex justify-between items-center">
                    <div>
                      <Text type="secondary">{item.item_name}</Text>
                      {item.input_type === 'file' && <FileOutlined className="ml-2 text-blue-500" />}
                    </div>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddCompetency('basic', item)}
                    >
                      추가
                    </Button>
                  </div>
                </Card>
              )
            }
          })}
        </div>
      </Panel>
    )
  }

  const renderCoachingCompetencySection = () => {
    const items = groupedItems.coaching
    const categoryCompetencies = competencies.filter(comp => {
      const itemCode = comp.competency_item?.item_code || ''
      return COACHING_COMPETENCY_CODES.includes(itemCode)
    })

    return (
      <Panel header={`코칭이력 (${categoryCompetencies.length}/${items.length})`} key="coaching">
        <div className="space-y-4">
          {items.map(item => {
            const existingComp = getCompetencyForItem(item.item_id)
            if (existingComp) {
              return renderCompetencyCard(existingComp)
            } else {
              return (
                <Card size="small" className="mb-2 border-dashed" key={item.item_id}>
                  <div className="flex justify-between items-center">
                    <div>
                      <Text type="secondary">{item.item_name}</Text>
                      {item.input_type === 'file' && <FileOutlined className="ml-2 text-blue-500" />}
                    </div>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddCompetency('coaching', item)}
                    >
                      추가
                    </Button>
                  </div>
                </Card>
              )
            }
          })}
        </div>
      </Panel>
    )
  }

  const renderAddonSection = () => {
    const items = groupedItems.addon
    const categoryCompetencies = competencies.filter(comp => comp.competency_item?.category === 'ADDON')

    return (
      <Panel header={`추가역량 (${categoryCompetencies.length})`} key="addon">
        <div className="space-y-4">
          {categoryCompetencies.length === 0 ? (
            <Text type="secondary">과제관리자가 추가한 역량 항목이 여기에 표시됩니다.</Text>
          ) : (
            categoryCompetencies.map(comp => renderCompetencyCard(comp))
          )}
        </div>
      </Panel>
    )
  }

  const renderCertificationSection = () => {
    const certColumns = [
      {
        title: '자격증 유형',
        dataIndex: 'certification_type',
        key: 'certification_type',
        render: (type: CertificationType) => {
          const typeMap = {
            [CertificationType.COACH]: '코치 자격증',
            [CertificationType.COUNSELING]: '상담/심리치료 자격증',
            [CertificationType.OTHER]: '기타 자격증'
          }
          return typeMap[type]
        }
      },
      {
        title: '자격증명',
        dataIndex: 'certification_name',
        key: 'certification_name',
      },
      {
        title: '발급기관',
        dataIndex: 'issuing_organization',
        key: 'issuing_organization',
        render: (text: string) => text || '-'
      },
      {
        title: '발급일',
        dataIndex: 'issue_date',
        key: 'issue_date',
        render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-'
      },
      {
        title: '증빙',
        dataIndex: 'has_file',
        key: 'has_file',
        render: (hasFile: boolean) => hasFile ? <FileOutlined style={{ color: '#1890ff' }} /> : '-'
      },
      {
        title: '상태',
        dataIndex: 'verification_status',
        key: 'verification_status',
        render: (status: string) => getStatusTag(status)
      },
      {
        title: '작업',
        key: 'action',
        render: (_: any, record: CertificationListItem) => (
          <Popconfirm
            title="삭제하시겠습니까?"
            onConfirm={() => handleDeleteCertification(record.certification_id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        ),
      },
    ]

    return (
      <Panel
        header={`자격증 (${certifications.length})`}
        key="certifications"
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              handleAddCertification()
            }}
          >
            자격증 추가
          </Button>
        }
      >
        <div className="space-y-4">
          {certifications.length === 0 ? (
            <div className="text-center py-4">
              <Text type="secondary">등록된 자격증이 없습니다.</Text>
            </div>
          ) : (
            <Table
              columns={certColumns}
              dataSource={certifications}
              rowKey="certification_id"
              pagination={false}
              size="small"
            />
          )}
        </div>
      </Panel>
    )
  }

  const renderEducationSection = () => {
    const eduColumns = [
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
          <Popconfirm
            title="삭제하시겠습니까?"
            onConfirm={() => handleDeleteEducation(record.education_id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        ),
      },
    ]

    return (
      <Panel
        header={`학력 (${educationHistory.length})`}
        key="education"
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
              columns={eduColumns}
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

  const handleItemChange = (itemId: number) => {
    const selected = competencyItems.find(item => item.item_id === itemId)
    setSelectedItemType(selected?.input_type || '')
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
              내 역량과 세부정보를 등록하고 관리할 수 있습니다.
            </Text>
          </div>

          {loading && !competencyItems.length ? (
            <div className="text-center py-8">데이터를 불러오는 중...</div>
          ) : (
            <Collapse defaultActiveKey={['basic', 'coaching', 'certifications']}>
              {renderBasicCompetencySection()}
              {renderCoachingCompetencySection()}
              {renderAddonSection()}
              {renderCertificationSection()}
              {renderEducationSection()}
            </Collapse>
          )}
        </Card>

        {/* Competency Modal */}
        <Modal
          title={editingCompetency ? '역량 수정' : '역량 추가'}
          open={isCompetencyModalVisible}
          onOk={handleCompetencyModalOk}
          onCancel={() => {
            setIsCompetencyModalVisible(false)
            competencyForm.resetFields()
            setFileList([])
          }}
          confirmLoading={loading || uploading}
          okText={editingCompetency ? '수정' : '추가'}
          cancelText="취소"
          width={600}
        >
          <Form form={competencyForm} layout="vertical">
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
                {selectedCategory === 'basic' && groupedItems.basic.map(item => (
                  <Option key={item.item_id} value={item.item_id}>
                    {item.item_name}
                  </Option>
                ))}
                {selectedCategory === 'coaching' && groupedItems.coaching.map(item => (
                  <Option key={item.item_id} value={item.item_id}>
                    {item.item_name}
                  </Option>
                ))}
                {!selectedCategory && competencyItems.map(item => (
                  <Option key={item.item_id} value={item.item_id}>
                    {item.item_name}
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
                <InputNumber className="w-full" placeholder="숫자를 입력하세요" />
              </Form.Item>
            ) : selectedItemType !== 'file' && (
              <Form.Item
                name="value"
                label="입력값"
                rules={[{ required: selectedItemType !== 'file', message: '값을 입력해주세요!' }]}
              >
                <TextArea rows={4} placeholder="역량 값을 입력하세요" />
              </Form.Item>
            )}

            {selectedItemType === 'file' && (
              <Form.Item name="value" label="설명 (선택사항)">
                <TextArea rows={2} placeholder="파일에 대한 간단한 설명" />
              </Form.Item>
            )}

            <Form.Item
              label={selectedItemType === 'file' ? "증빙서류 (필수)" : "증빙서류 (선택)"}
            >
              <Upload
                fileList={fileList}
                onChange={handleFileChange}
                beforeUpload={beforeFileUpload}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  파일 선택
                </Button>
              </Upload>
            </Form.Item>
          </Form>
        </Modal>

        {/* Certification Modal */}
        <Modal
          title="자격증 추가"
          open={isCertificationModalVisible}
          onOk={handleCertificationModalOk}
          onCancel={() => {
            setIsCertificationModalVisible(false)
            certificationForm.resetFields()
            setFileList([])
          }}
          confirmLoading={loading || uploading}
          okText="추가"
          cancelText="취소"
          width={600}
        >
          <Form form={certificationForm} layout="vertical">
            <Form.Item
              name="certification_type"
              label="자격증 유형"
              rules={[{ required: true, message: '자격증 유형을 선택해주세요!' }]}
            >
              <Select size="large">
                <Option value="coach">코치 자격증</Option>
                <Option value="counseling">상담/심리치료 자격증</Option>
                <Option value="other">기타 자격증</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="certification_name"
              label="자격증명"
              rules={[{ required: true, message: '자격증명을 입력해주세요!' }]}
            >
              <Input placeholder="예: KAC 전문코치" size="large" />
            </Form.Item>

            <Form.Item
              name="issuing_organization"
              label="발급기관"
            >
              <Input placeholder="예: 한국코치협회" size="large" />
            </Form.Item>

            <Form.Item
              name="issue_date"
              label="발급일"
            >
              <DatePicker className="w-full" placeholder="발급일 선택" />
            </Form.Item>

            <Form.Item
              name="expiry_date"
              label="만료일"
            >
              <DatePicker className="w-full" placeholder="만료일 선택" />
            </Form.Item>

            <Form.Item
              name="certificate_number"
              label="자격증 번호"
            >
              <Input placeholder="자격증 번호" size="large" />
            </Form.Item>

            <Form.Item label="증빙서류 (선택)">
              <Upload
                fileList={fileList}
                onChange={handleFileChange}
                beforeUpload={beforeFileUpload}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  파일 선택
                </Button>
              </Upload>
            </Form.Item>
          </Form>
        </Modal>

        {/* Education Modal */}
        <Modal
          title="학력 추가"
          open={isEducationModalVisible}
          onOk={handleEducationModalOk}
          onCancel={() => {
            setIsEducationModalVisible(false)
            educationForm.resetFields()
            setFileList([])
          }}
          confirmLoading={loading || uploading}
          okText="추가"
          cancelText="취소"
          width={600}
        >
          <Form form={educationForm} layout="vertical">
            <Form.Item
              name="education_name"
              label="교육명"
              rules={[{ required: true, message: '교육명을 입력해주세요!' }]}
            >
              <Input placeholder="교육명" />
            </Form.Item>

            <Form.Item name="institution" label="교육기관">
              <Input placeholder="교육기관" />
            </Form.Item>

            <Form.Item name="completion_date" label="이수일">
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="hours" label="교육시간">
              <InputNumber className="w-full" min={0} addonAfter="시간" />
            </Form.Item>

            <Form.Item label="수료증 (선택)">
              <Upload
                fileList={fileList}
                onChange={handleFileChange}
                beforeUpload={beforeFileUpload}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  파일 선택
                </Button>
              </Upload>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  )
}
