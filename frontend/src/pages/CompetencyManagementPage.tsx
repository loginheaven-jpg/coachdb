import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Table,
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
  UploadFile
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, UploadOutlined, FileOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons'
import competencyService, { CoachCompetency, CompetencyItem } from '../services/competencyService'
import fileService from '../services/fileService'
import FilePreviewModal, { useFilePreview } from '../components/FilePreviewModal'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

export default function CompetencyManagementPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [competencies, setCompetencies] = useState<CoachCompetency[]>([])
  const [competencyItems, setCompetencyItems] = useState<CompetencyItem[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingCompetency, setEditingCompetency] = useState<CoachCompetency | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null)
  const [selectedItemType, setSelectedItemType] = useState<string>('')
  const [form] = Form.useForm()
  // 파일 미리보기
  const { previewState, openPreview, closePreview } = useFilePreview()

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

  const handleAdd = () => {
    setEditingCompetency(null)
    setFileList([])
    setUploadedFileId(null)
    setSelectedItemType('')
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEdit = (record: CoachCompetency) => {
    setEditingCompetency(record)
    setFileList([])
    setUploadedFileId(record.file_id)
    setSelectedItemType(record.competency_item?.input_type || '')
    form.setFieldsValue({
      item_id: record.item_id,
      value: record.value
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
    setFileList(info.fileList.slice(-1)) // Only keep the last file
  }

  const beforeFileUpload = (file: File) => {
    // Validate file type
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png']
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!allowedTypes.includes(fileExt)) {
      message.error(`${fileExt} 파일은 업로드할 수 없습니다. PDF, JPG, PNG 파일만 가능합니다.`)
      return Upload.LIST_IGNORE
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      message.error('파일 크기는 10MB를 초과할 수 없습니다.')
      return Upload.LIST_IGNORE
    }

    return false // Prevent auto upload
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
      message.error('파일 업로드에 실패했습니다: ' + (error.response?.data?.detail || error.message))
      return null
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

      // Validate file requirement for file-type items
      if (selectedItemType === 'file') {
        if (!editingCompetency && fileList.length === 0) {
          message.error('파일 타입 역량 항목은 파일 업로드가 필수입니다.')
          return
        }
        // For editing, check if there's either an existing file or a new file
        if (editingCompetency && !uploadedFileId && fileList.length === 0) {
          message.error('파일 타입 역량 항목은 파일 업로드가 필수입니다.')
          return
        }
      }

      setLoading(true)

      // Upload file if exists
      let fileId = uploadedFileId
      if (fileList.length > 0) {
        const newFileId = await handleFileUpload()
        if (newFileId === null) {
          // Upload failed, handleFileUpload already showed error message
          setLoading(false)
          return
        }
        fileId = newFileId
      }

      if (editingCompetency) {
        // Update
        await competencyService.updateCompetency(editingCompetency.competency_id, {
          value: values.value,
          file_id: fileId ?? undefined  // Convert null to undefined
        })
        message.success('역량이 수정되었습니다.')
      } else {
        // Create
        await competencyService.createCompetency({
          item_id: values.item_id,
          value: values.value,
          file_id: fileId ?? undefined  // Convert null to undefined
        })
        message.success('역량이 추가되었습니다.')
      }

      setIsModalVisible(false)
      form.resetFields()
      setFileList([])
      setUploadedFileId(null)
      loadData()
    } catch (error: any) {
      if (error.errorFields) {
        // Validation error
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
    setUploadedFileId(null)
    setEditingCompetency(null)
    setSelectedItemType('')
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

  const columns = [
    {
      title: '역량 항목',
      dataIndex: ['competency_item', 'item_name'],
      key: 'item_name',
      render: (text: string, record: CoachCompetency) => (
        <div>
          <div>{record.competency_item?.item_name || '알 수 없음'}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.competency_item?.item_code}
          </Text>
        </div>
      )
    },
    {
      title: '입력값',
      dataIndex: 'value',
      key: 'value',
      render: (value: string) => value || '-'
    },
    {
      title: '첨부파일',
      dataIndex: 'file_id',
      key: 'file_id',
      render: (file_id: number | null, record: CoachCompetency) => {
        if (!file_id || !record.file_info) return '-'
        const fileInfo = record.file_info
        const fileSizeKB = (fileInfo.file_size / 1024).toFixed(1)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleFileDownload(file_id, fileInfo.original_filename)}
            >
              {fileInfo.original_filename}
            </Button>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              ({fileSizeKB} KB)
            </Text>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openPreview(file_id, fileInfo.original_filename)}
              title="미리보기"
            />
          </div>
        )
      }
    },
    {
      title: '검증상태',
      dataIndex: 'verification_status',
      key: 'verification_status',
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '등록일',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString('ko-KR')
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: CoachCompetency) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.verification_status === 'approved'}
          >
            수정
          </Button>
          <Popconfirm
            title="이 역량을 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.competency_id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              삭제
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          대시보드로 돌아가기
        </Button>

        <Card>
          <div className="flex justify-between items-center mb-6">
            <div>
              <Title level={2} className="mb-2">역량 관리</Title>
              <Text className="text-gray-600">
                내 역량을 등록하고 관리할 수 있습니다. 필요한 경우 증빙서류를 업로드하세요.
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              size="large"
            >
              역량 추가
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={competencies}
            rowKey="competency_id"
            loading={loading}
            locale={{ emptyText: '등록된 역량이 없습니다.' }}
          />
        </Card>

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
                {competencyItems.map(item => (
                  <Option key={item.item_id} value={item.item_id}>
                    {item.item_name} ({item.item_code})
                    {item.input_type === 'file' && <FileOutlined style={{ marginLeft: 8, color: '#1890ff' }} />}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {selectedItemType !== 'file' && (
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

        {/* File Preview Modal */}
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
