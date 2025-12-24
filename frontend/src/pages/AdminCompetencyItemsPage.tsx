import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Button,
  Table,
  Tag,
  message,
  Space,
  Select,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Popconfirm
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined
} from '@ant-design/icons'
import competencyService, {
  CompetencyItem,
  CompetencyItemCreate,
  CompetencyItemUpdate,
  CompetencyItemField,
  CompetencyItemFieldCreate
} from '../services/competencyService'

const { Title, Text } = Typography

const CATEGORY_OPTIONS = [
  { label: '기본정보', value: 'BASIC' },
  { label: '세부정보', value: 'DETAIL' },
  { label: '학력', value: 'EDUCATION' },
  { label: '추가역량', value: 'ADDON' },
  { label: '코칭이력', value: 'COACHING' }
]

const TEMPLATE_OPTIONS = [
  { label: '텍스트', value: 'text' },
  { label: '숫자', value: 'number' },
  { label: '단일선택', value: 'select' },
  { label: '다중선택', value: 'multiselect' },
  { label: '파일', value: 'file' },
  { label: '텍스트+파일', value: 'text_file' },
  { label: '학위', value: 'degree' },
  { label: '코칭이력', value: 'coaching_history' }
]

const FIELD_TYPE_OPTIONS = [
  { label: '텍스트', value: 'text' },
  { label: '숫자', value: 'number' },
  { label: '선택', value: 'select' },
  { label: '다중선택', value: 'multiselect' },
  { label: '파일', value: 'file' }
]

export default function AdminCompetencyItemsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CompetencyItem[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [showInactive, setShowInactive] = useState(false)

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CompetencyItem | null>(null)
  const [editingField, setEditingField] = useState<CompetencyItemField | null>(null)

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [fieldForm] = Form.useForm()

  useEffect(() => {
    loadItems()
  }, [showInactive])

  // Update editingItem when items change (for field modal updates)
  useEffect(() => {
    if (editingItem && isFieldModalOpen) {
      const updatedItem = items.find(item => item.item_id === editingItem.item_id)
      if (updatedItem) {
        setEditingItem(updatedItem)
      }
    }
  }, [items])

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await competencyService.getAllCompetencyItems(showInactive)
      setItems(data)
    } catch (error: any) {
      console.error('역량항목 로드 실패:', error)
      message.error('역량항목을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryTag = (category: string) => {
    const colorMap: Record<string, string> = {
      BASIC: 'blue',
      DETAIL: 'green',
      EDUCATION: 'orange',
      ADDON: 'purple',
      COACHING: 'cyan'
    }
    const labelMap: Record<string, string> = {
      BASIC: '기본정보',
      DETAIL: '세부정보',
      EDUCATION: '학력',
      ADDON: '추가역량',
      COACHING: '코칭이력'
    }
    return <Tag color={colorMap[category]}>{labelMap[category] || category}</Tag>
  }

  const handleCreate = async (values: CompetencyItemCreate) => {
    try {
      await competencyService.createCompetencyItem({
        ...values,
        input_type: 'text' // Default deprecated field
      })
      message.success('역량항목이 생성되었습니다.')
      setIsCreateModalOpen(false)
      createForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('생성 실패:', error)
      message.error(error.response?.data?.detail || '생성에 실패했습니다.')
    }
  }

  const handleEdit = async (values: CompetencyItemUpdate) => {
    if (!editingItem) return
    try {
      await competencyService.updateCompetencyItem(editingItem.item_id, values)
      message.success('역량항목이 수정되었습니다.')
      setIsEditModalOpen(false)
      setEditingItem(null)
      editForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('수정 실패:', error)
      message.error(error.response?.data?.detail || '수정에 실패했습니다.')
    }
  }

  const handleDelete = async (itemId: number) => {
    try {
      await competencyService.deleteCompetencyItem(itemId)
      message.success('역량항목이 비활성화되었습니다.')
      loadItems()
    } catch (error: any) {
      console.error('삭제 실패:', error)
      message.error(error.response?.data?.detail || '삭제에 실패했습니다.')
    }
  }

  const handleAddField = async (values: CompetencyItemFieldCreate) => {
    if (!editingItem) return
    try {
      await competencyService.createCompetencyItemField(editingItem.item_id, values)
      message.success('필드가 추가되었습니다.')
      setIsFieldModalOpen(false)
      fieldForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('필드 추가 실패:', error)
      message.error(error.response?.data?.detail || '필드 추가에 실패했습니다.')
    }
  }

  const handleDeleteField = async (itemId: number, fieldId: number) => {
    try {
      await competencyService.deleteCompetencyItemField(itemId, fieldId)
      message.success('필드가 삭제되었습니다.')
      loadItems()
    } catch (error: any) {
      console.error('필드 삭제 실패:', error)
      message.error(error.response?.data?.detail || '필드 삭제에 실패했습니다.')
    }
  }

  const openEditModal = (item: CompetencyItem) => {
    setEditingItem(item)
    editForm.setFieldsValue({
      item_name: item.item_name,
      category: item.category,
      template: item.template,
      template_config: item.template_config,
      is_repeatable: item.is_repeatable,
      max_entries: item.max_entries,
      is_active: item.is_active
    })
    setIsEditModalOpen(true)
  }

  const openFieldModal = (item: CompetencyItem) => {
    setEditingItem(item)
    setEditingField(null)
    fieldForm.resetFields()
    setIsFieldModalOpen(true)
  }

  const handleEditField = (field: CompetencyItemField) => {
    setEditingField(field)
    fieldForm.setFieldsValue({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_options: field.field_options,
      is_required: field.is_required,
      display_order: field.display_order,
      placeholder: field.placeholder
    })
  }

  const handleUpdateField = async (values: CompetencyItemFieldCreate) => {
    if (!editingItem || !editingField) return
    try {
      await competencyService.updateCompetencyItemField(editingItem.item_id, editingField.field_id, values)
      message.success('필드가 수정되었습니다.')
      setEditingField(null)
      fieldForm.resetFields()
      loadItems()
    } catch (error: any) {
      console.error('필드 수정 실패:', error)
      message.error(error.response?.data?.detail || '필드 수정에 실패했습니다.')
    }
  }

  const handleFieldSubmit = async (values: CompetencyItemFieldCreate) => {
    if (editingField) {
      await handleUpdateField(values)
    } else {
      await handleAddField(values)
    }
  }

  const cancelFieldEdit = () => {
    setEditingField(null)
    fieldForm.resetFields()
  }

  const filteredItems = categoryFilter
    ? items.filter(item => item.category === categoryFilter)
    : items

  const columns = [
    {
      title: '항목코드',
      dataIndex: 'item_code',
      key: 'item_code',
      width: '15%',
    },
    {
      title: '항목명',
      dataIndex: 'item_name',
      key: 'item_name',
      width: '20%',
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      width: '10%',
      render: (category: string) => getCategoryTag(category),
    },
    {
      title: '템플릿',
      dataIndex: 'template',
      key: 'template',
      width: '10%',
      render: (template: string) => template || '-',
    },
    {
      title: '다중입력',
      dataIndex: 'is_repeatable',
      key: 'is_repeatable',
      width: '8%',
      render: (repeatable: boolean, record: CompetencyItem) => (
        repeatable ? <Tag color="blue">Yes ({record.max_entries || '무제한'})</Tag> : <Tag>No</Tag>
      ),
    },
    {
      title: '필드 수',
      key: 'fields_count',
      width: '8%',
      render: (_: any, record: CompetencyItem) => record.fields?.length || 0,
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '8%',
      render: (active: boolean) => (
        active ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: '21%',
      render: (_: any, record: CompetencyItem) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            수정
          </Button>
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => openFieldModal(record)}
          >
            필드
          </Button>
          {record.is_active && (
            <Popconfirm
              title="이 항목을 비활성화하시겠습니까?"
              onConfirm={() => handleDelete(record.item_id)}
              okText="예"
              cancelText="아니오"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                삭제
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const expandedRowRender = (record: CompetencyItem) => {
    if (!record.fields || record.fields.length === 0) {
      return <Text type="secondary">등록된 필드가 없습니다.</Text>
    }

    const fieldColumns = [
      { title: '필드명', dataIndex: 'field_name', key: 'field_name' },
      { title: '레이블', dataIndex: 'field_label', key: 'field_label' },
      { title: '타입', dataIndex: 'field_type', key: 'field_type' },
      { title: '필수', dataIndex: 'is_required', key: 'is_required', render: (v: boolean) => v ? '예' : '아니오' },
      { title: '순서', dataIndex: 'display_order', key: 'display_order' },
      {
        title: '작업',
        key: 'actions',
        render: (_: any, field: CompetencyItemField) => (
          <Popconfirm
            title="이 필드를 삭제하시겠습니까?"
            onConfirm={() => handleDeleteField(record.item_id, field.field_id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger size="small">삭제</Button>
          </Popconfirm>
        ),
      },
    ]

    return (
      <Table
        columns={fieldColumns}
        dataSource={record.fields}
        rowKey="field_id"
        pagination={false}
        size="small"
      />
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
          >
            대시보드로 돌아가기
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
            size="large"
          >
            새 역량항목 추가
          </Button>
        </div>

        <Card>
          <div className="mb-6">
            <Title level={2} className="mb-2">역량항목 관리</Title>
            <Text className="text-gray-600">
              코칭 역량 항목 마스터 데이터를 관리할 수 있습니다.
            </Text>
          </div>

          <div className="mb-4 flex justify-between">
            <Space>
              <Text>카테고리 필터:</Text>
              <Select
                style={{ width: 150 }}
                placeholder="전체"
                allowClear
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={CATEGORY_OPTIONS}
              />
            </Space>
            <Space>
              <Text>비활성 항목 포함:</Text>
              <Switch checked={showInactive} onChange={setShowInactive} />
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={filteredItems}
            rowKey="item_id"
            loading={loading}
            expandable={{
              expandedRowRender,
              rowExpandable: (record) => (record.fields?.length || 0) > 0,
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`
            }}
            locale={{
              emptyText: '등록된 역량항목이 없습니다.'
            }}
          />
        </Card>

        {/* Create Modal */}
        <Modal
          title="새 역량항목 추가"
          open={isCreateModalOpen}
          onCancel={() => {
            setIsCreateModalOpen(false)
            createForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={handleCreate}
          >
            <Form.Item
              name="item_code"
              label="항목 코드"
              rules={[{ required: true, message: '항목 코드를 입력해주세요' }]}
            >
              <Input placeholder="예: ADDON_NEW_ITEM" />
            </Form.Item>

            <Form.Item
              name="item_name"
              label="항목명"
              rules={[{ required: true, message: '항목명을 입력해주세요' }]}
            >
              <Input placeholder="예: 새로운 역량항목" />
            </Form.Item>

            <Form.Item
              name="category"
              label="카테고리"
              rules={[{ required: true, message: '카테고리를 선택해주세요' }]}
            >
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="template"
              label="템플릿 유형"
            >
              <Select options={TEMPLATE_OPTIONS} allowClear />
            </Form.Item>

            <Form.Item
              name="template_config"
              label="템플릿 설정 (JSON)"
              tooltip={'예: {"options": ["옵션1", "옵션2"]}'}
            >
              <Input.TextArea rows={3} placeholder='{"options": ["옵션1", "옵션2"]}' />
            </Form.Item>

            <Form.Item
              name="is_repeatable"
              label="다중 입력 허용"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="max_entries"
              label="최대 입력 수"
              tooltip="다중 입력 허용 시 최대 개수"
            >
              <InputNumber min={1} max={100} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">생성</Button>
                <Button onClick={() => {
                  setIsCreateModalOpen(false)
                  createForm.resetFields()
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          title="역량항목 수정"
          open={isEditModalOpen}
          onCancel={() => {
            setIsEditModalOpen(false)
            setEditingItem(null)
            editForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEdit}
          >
            <Form.Item
              name="item_name"
              label="항목명"
              rules={[{ required: true, message: '항목명을 입력해주세요' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="category"
              label="카테고리"
            >
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="template"
              label="템플릿 유형"
            >
              <Select options={TEMPLATE_OPTIONS} allowClear />
            </Form.Item>

            <Form.Item
              name="template_config"
              label="템플릿 설정 (JSON)"
            >
              <Input.TextArea rows={3} />
            </Form.Item>

            <Form.Item
              name="is_repeatable"
              label="다중 입력 허용"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="max_entries"
              label="최대 입력 수"
            >
              <InputNumber min={1} max={100} />
            </Form.Item>

            <Form.Item
              name="is_active"
              label="활성 상태"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">저장</Button>
                <Button onClick={() => {
                  setIsEditModalOpen(false)
                  setEditingItem(null)
                  editForm.resetFields()
                }}>취소</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Field Management Modal */}
        <Modal
          title={`필드 관리 - ${editingItem?.item_name}`}
          open={isFieldModalOpen}
          onCancel={() => {
            setIsFieldModalOpen(false)
            setEditingItem(null)
            setEditingField(null)
            fieldForm.resetFields()
          }}
          footer={null}
          width={800}
        >
          {/* Existing Fields List */}
          <div className="mb-6">
            <Title level={5}>등록된 필드 ({editingItem?.fields?.length || 0}개)</Title>
            {editingItem?.fields && editingItem.fields.length > 0 ? (
              <Table
                columns={[
                  { title: '순서', dataIndex: 'display_order', key: 'display_order', width: 60 },
                  { title: '필드명', dataIndex: 'field_name', key: 'field_name', width: 120 },
                  { title: '레이블', dataIndex: 'field_label', key: 'field_label' },
                  { title: '타입', dataIndex: 'field_type', key: 'field_type', width: 80 },
                  {
                    title: '필수',
                    dataIndex: 'is_required',
                    key: 'is_required',
                    width: 60,
                    render: (v: boolean) => v ? <Tag color="red">필수</Tag> : <Tag>선택</Tag>
                  },
                  {
                    title: '작업',
                    key: 'actions',
                    width: 120,
                    render: (_: any, field: CompetencyItemField) => (
                      <Space size="small">
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEditField(field)}
                        >
                          수정
                        </Button>
                        <Popconfirm
                          title="이 필드를 삭제하시겠습니까?"
                          onConfirm={() => {
                            handleDeleteField(editingItem!.item_id, field.field_id)
                          }}
                          okText="예"
                          cancelText="아니오"
                        >
                          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                            삭제
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
                dataSource={editingItem.fields.sort((a, b) => a.display_order - b.display_order)}
                rowKey="field_id"
                pagination={false}
                size="small"
              />
            ) : (
              <Text type="secondary">등록된 필드가 없습니다.</Text>
            )}
          </div>

          {/* Add/Edit Field Form */}
          <div className="border-t pt-4">
            <Title level={5}>
              {editingField ? `필드 수정: ${editingField.field_label}` : '새 필드 추가'}
            </Title>
            <Form
              form={fieldForm}
              layout="vertical"
              onFinish={handleFieldSubmit}
            >
              <div className="grid grid-cols-2 gap-4">
                <Form.Item
                  name="field_name"
                  label="필드명 (영문)"
                  rules={[{ required: true, message: '필드명을 입력해주세요' }]}
                >
                  <Input placeholder="예: cert_name" />
                </Form.Item>

                <Form.Item
                  name="field_label"
                  label="필드 레이블 (표시명)"
                  rules={[{ required: true, message: '레이블을 입력해주세요' }]}
                >
                  <Input placeholder="예: 자격증명" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Form.Item
                  name="field_type"
                  label="필드 타입"
                  rules={[{ required: true, message: '타입을 선택해주세요' }]}
                >
                  <Select options={FIELD_TYPE_OPTIONS} />
                </Form.Item>

                <Form.Item
                  name="is_required"
                  label="필수 여부"
                  valuePropName="checked"
                  initialValue={true}
                >
                  <Switch checkedChildren="필수" unCheckedChildren="선택" />
                </Form.Item>

                <Form.Item
                  name="display_order"
                  label="표시 순서"
                  initialValue={0}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </div>

              <Form.Item
                name="field_options"
                label="옵션 (JSON, select/multiselect용)"
              >
                <Input.TextArea rows={2} placeholder='["옵션1", "옵션2"]' />
              </Form.Item>

              <Form.Item
                name="placeholder"
                label="힌트 텍스트"
              >
                <Input placeholder="입력 힌트" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    {editingField ? '수정' : '추가'}
                  </Button>
                  {editingField && (
                    <Button onClick={cancelFieldEdit}>
                      수정 취소
                    </Button>
                  )}
                  <Button onClick={() => {
                    setIsFieldModalOpen(false)
                    setEditingItem(null)
                    setEditingField(null)
                    fieldForm.resetFields()
                  }}>닫기</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        </Modal>
    </div>
  )
}
