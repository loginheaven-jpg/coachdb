/**
 * 평가 템플릿 관리 페이지
 * 시스템관리 > 평가템플릿 관리
 */
import { useState, useEffect } from 'react'
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select,
  Switch, message, Divider, InputNumber, Popconfirm, Typography
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined
} from '@ant-design/icons'
import scoringTemplateService, {
  ScoringTemplate, GradeMapping
} from '../services/scoringTemplateService'

const { TextArea } = Input
const { Title, Text } = Typography

// 옵션 정의
const GRADE_TYPE_OPTIONS = [
  { value: 'string', label: '문자열' },
  { value: 'numeric', label: '숫자' },
  { value: 'file_exists', label: '파일 유무' },
  { value: 'multi_select', label: '복수 선택' }
]

const MATCHING_TYPE_OPTIONS = [
  { value: 'exact', label: '정확 일치' },
  { value: 'contains', label: '포함 여부' },
  { value: 'range', label: '범위 (이상/이하)' },
  { value: 'grade', label: '등급별 점수' }
]

const VALUE_SOURCE_OPTIONS = [
  { value: 'submitted', label: '제출된 값' },
  { value: 'user_field', label: '사용자 필드' },
  { value: 'json_field', label: 'JSON 필드' }
]

const AGGREGATION_MODE_OPTIONS = [
  { value: 'first', label: '첫 번째 값' },
  { value: 'sum', label: '합계' },
  { value: 'max', label: '최대값' },
  { value: 'count', label: '개수' },
  { value: 'any_match', label: '하나라도 일치' },
  { value: 'best_match', label: '가장 높은 점수' }
]

const PROOF_REQUIRED_OPTIONS = [
  { value: 'not_required', label: '필요 없음' },
  { value: 'optional', label: '선택' },
  { value: 'required', label: '필수' }
]

export default function AdminScoringTemplatesPage() {
  const [templates, setTemplates] = useState<ScoringTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ScoringTemplate | null>(null)
  const [form] = Form.useForm()
  const [gradeMappings, setGradeMappings] = useState<GradeMapping[]>([])
  const [showInactive, setShowInactive] = useState(false)

  // 데이터 로드
  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await scoringTemplateService.getAll(!showInactive)
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
      message.error('평가 템플릿 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [showInactive])

  // 모달 열기 (새로 만들기)
  const handleAdd = () => {
    setEditingTemplate(null)
    setGradeMappings([{ value: '', score: 0 }])
    form.resetFields()
    form.setFieldsValue({
      grade_type: 'string',
      matching_type: 'grade',
      value_source: 'submitted',
      aggregation_mode: 'best_match',
      proof_required: 'optional',
      fixed_grades: false,
      allow_add_grades: true,
      is_required_default: false,
      allow_multiple: false,
      auto_confirm_across_projects: false,
      is_active: true
    })
    setModalVisible(true)
  }

  // 모달 열기 (수정)
  const handleEdit = (template: ScoringTemplate) => {
    setEditingTemplate(template)
    const mappings = scoringTemplateService.parseMappings(template.default_mappings)
    setGradeMappings(mappings.length > 0 ? mappings : [{ value: '', score: 0 }])

    form.setFieldsValue({
      template_id: template.template_id,
      template_name: template.template_name,
      description: template.description,
      grade_type: template.grade_type,
      matching_type: template.matching_type,
      value_source: template.value_source?.toLowerCase() || 'submitted',
      source_field: template.source_field,
      aggregation_mode: template.aggregation_mode,
      fixed_grades: template.fixed_grades,
      allow_add_grades: template.allow_add_grades,
      proof_required: template.proof_required?.toLowerCase() || 'optional',
      verification_note: template.verification_note,
      is_required_default: template.is_required_default,
      allow_multiple: template.allow_multiple,
      auto_confirm_across_projects: template.auto_confirm_across_projects,
      keywords: scoringTemplateService.parseKeywords(template.keywords).join(', '),
      is_active: template.is_active
    })
    setModalVisible(true)
  }

  // 삭제 (비활성화)
  const handleDelete = async (templateId: string) => {
    try {
      await scoringTemplateService.delete(templateId)
      message.success('평가 템플릿이 비활성화되었습니다')
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete template:', error)
      message.error('평가 템플릿 비활성화에 실패했습니다')
    }
  }

  // 저장
  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      // 등급 매핑 JSON 변환
      const validMappings = gradeMappings.filter(m => m.value !== '' || m.score > 0)
      const mappingsJson = scoringTemplateService.stringifyMappings(validMappings)

      // 키워드 JSON 변환
      const keywords = values.keywords
        ? values.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        : []
      const keywordsJson = scoringTemplateService.stringifyKeywords(keywords)

      const data = {
        ...values,
        default_mappings: mappingsJson,
        keywords: keywordsJson
      }

      if (editingTemplate) {
        // 수정
        delete data.template_id
        await scoringTemplateService.update(editingTemplate.template_id, data)
        message.success('평가 템플릿이 수정되었습니다')
      } else {
        // 생성
        await scoringTemplateService.create(data)
        message.success('평가 템플릿이 생성되었습니다')
      }

      setModalVisible(false)
      loadTemplates()
    } catch (error: any) {
      console.error('Failed to save template:', error)
      message.error(error.response?.data?.detail || '저장에 실패했습니다')
    }
  }

  // 등급 매핑 추가
  const handleAddMapping = () => {
    setGradeMappings([...gradeMappings, { value: '', score: 0 }])
  }

  // 등급 매핑 삭제
  const handleRemoveMapping = (index: number) => {
    setGradeMappings(gradeMappings.filter((_, i) => i !== index))
  }

  // 등급 매핑 수정
  const handleUpdateMapping = (index: number, field: keyof GradeMapping, value: any) => {
    const updated = [...gradeMappings]
    updated[index] = { ...updated[index], [field]: value }
    setGradeMappings(updated)
  }

  // 테이블 컬럼 정의
  const columns = [
    {
      title: '템플릿 ID',
      dataIndex: 'template_id',
      key: 'template_id',
      width: 150,
      render: (text: string) => <code style={{ fontSize: 12 }}>{text}</code>
    },
    {
      title: '템플릿명',
      dataIndex: 'template_name',
      key: 'template_name',
      width: 200
    },
    {
      title: '등급 유형',
      dataIndex: 'grade_type',
      key: 'grade_type',
      width: 100,
      render: (type: string) => (
        <Tag>{scoringTemplateService.getGradeTypeLabel(type)}</Tag>
      )
    },
    {
      title: '매칭 방식',
      dataIndex: 'matching_type',
      key: 'matching_type',
      width: 120,
      render: (type: string) => (
        <Tag color="blue">{scoringTemplateService.getMatchingTypeLabel(type)}</Tag>
      )
    },
    {
      title: '집계 방식',
      dataIndex: 'aggregation_mode',
      key: 'aggregation_mode',
      width: 120,
      render: (type: string) => (
        <Tag color="purple">{scoringTemplateService.getAggregationModeLabel(type)}</Tag>
      )
    },
    {
      title: '등급 수',
      key: 'mappings_count',
      width: 80,
      render: (_: any, record: ScoringTemplate) => {
        const mappings = scoringTemplateService.parseMappings(record.default_mappings)
        return <span>{mappings.length}개</span>
      }
    },
    {
      title: '등급 고정',
      dataIndex: 'fixed_grades',
      key: 'fixed_grades',
      width: 80,
      render: (fixed: boolean) => fixed ? <Tag color="red">고정</Tag> : <Tag>가변</Tag>
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? '활성' : '비활성'}</Tag>
      )
    },
    {
      title: '작업',
      key: 'action',
      width: 120,
      render: (_: any, record: ScoringTemplate) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Popconfirm
            title="이 템플릿을 비활성화하시겠습니까?"
            onConfirm={() => handleDelete(record.template_id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={<Title level={4} style={{ margin: 0 }}>평가 템플릿 관리</Title>}
        extra={
          <Space>
            <Switch
              checked={showInactive}
              onChange={setShowInactive}
              checkedChildren="비활성 포함"
              unCheckedChildren="활성만"
            />
            <Button icon={<ReloadOutlined />} onClick={loadTemplates}>
              새로고침
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              템플릿 추가
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={templates}
          columns={columns}
          rowKey="template_id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
          expandable={{
            expandedRowRender: (record) => {
              const mappings = scoringTemplateService.parseMappings(record.default_mappings)
              return (
                <div style={{ padding: '8px 16px' }}>
                  <Text strong>등급 매핑:</Text>
                  <div style={{ marginTop: 8 }}>
                    {mappings.map((m, idx) => (
                      <Tag key={idx} color="orange" style={{ marginBottom: 4 }}>
                        {m.label || String(m.value)} → {m.score}점
                        {m.fixed && ' (고정)'}
                      </Tag>
                    ))}
                  </div>
                  {record.description && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">{record.description}</Text>
                    </div>
                  )}
                </div>
              )
            }
          }}
        />
      </Card>

      {/* 수정/생성 모달 */}
      <Modal
        title={editingTemplate ? '평가 템플릿 수정' : '평가 템플릿 추가'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={800}
        okText="저장"
        cancelText="취소"
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="template_id"
              label="템플릿 ID"
              rules={[
                { required: true, message: '템플릿 ID를 입력하세요' },
                { pattern: /^[a-z0-9_]+$/, message: '소문자, 숫자, _ 만 사용 가능' }
              ]}
              style={{ flex: 1 }}
            >
              <Input
                placeholder="예: kca_certification"
                disabled={!!editingTemplate}
              />
            </Form.Item>
            <Form.Item
              name="template_name"
              label="템플릿명"
              rules={[{ required: true, message: '템플릿명을 입력하세요' }]}
              style={{ flex: 2 }}
            >
              <Input placeholder="예: 코칭관련자격증 (KCA)" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="설명">
            <TextArea rows={2} placeholder="템플릿 설명" />
          </Form.Item>

          <Divider orientation="left">평가 설정</Divider>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="grade_type"
              label="등급 유형"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Select options={GRADE_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="matching_type"
              label="매칭 방식"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Select options={MATCHING_TYPE_OPTIONS} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="value_source"
              label="값 소스"
              style={{ flex: 1 }}
            >
              <Select options={VALUE_SOURCE_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="source_field"
              label="소스 필드명"
              style={{ flex: 1 }}
            >
              <Input placeholder="예: kca_certification_level" />
            </Form.Item>
            <Form.Item
              name="aggregation_mode"
              label="집계 방식"
              style={{ flex: 1 }}
            >
              <Select options={AGGREGATION_MODE_OPTIONS} />
            </Form.Item>
          </div>

          <Divider orientation="left">등급 매핑 ({gradeMappings.length}개)</Divider>

          <div style={{ marginBottom: 16 }}>
            {gradeMappings.map((mapping, index) => (
              <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <Input
                  style={{ flex: 2 }}
                  placeholder="값 (예: KSC, 박사, 1000)"
                  value={String(mapping.value)}
                  onChange={(e) => handleUpdateMapping(index, 'value', e.target.value)}
                />
                <InputNumber
                  style={{ width: 100 }}
                  placeholder="점수"
                  value={mapping.score}
                  onChange={(value) => handleUpdateMapping(index, 'score', value || 0)}
                  addonAfter="점"
                />
                <Input
                  style={{ flex: 2 }}
                  placeholder="레이블 (선택)"
                  value={mapping.label || ''}
                  onChange={(e) => handleUpdateMapping(index, 'label', e.target.value)}
                />
                <Switch
                  checked={mapping.fixed}
                  onChange={(checked) => handleUpdateMapping(index, 'fixed', checked)}
                  checkedChildren="고정"
                  unCheckedChildren="가변"
                />
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemoveMapping(index)}
                  disabled={gradeMappings.length <= 1}
                />
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddMapping} block>
              등급 추가
            </Button>
          </div>

          <Divider orientation="left">옵션</Divider>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Form.Item name="fixed_grades" label="등급 고정" valuePropName="checked">
              <Switch checkedChildren="고정" unCheckedChildren="가변" />
            </Form.Item>
            <Form.Item name="allow_add_grades" label="등급 추가 허용" valuePropName="checked">
              <Switch checkedChildren="허용" unCheckedChildren="불가" />
            </Form.Item>
            <Form.Item name="proof_required" label="증빙 필수">
              <Select options={PROOF_REQUIRED_OPTIONS} style={{ width: 120 }} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Form.Item name="is_required_default" label="기본 필수" valuePropName="checked">
              <Switch checkedChildren="필수" unCheckedChildren="선택" />
            </Form.Item>
            <Form.Item name="allow_multiple" label="다중 입력" valuePropName="checked">
              <Switch checkedChildren="허용" unCheckedChildren="단일" />
            </Form.Item>
            <Form.Item name="auto_confirm_across_projects" label="자동 컨펌" valuePropName="checked">
              <Switch checkedChildren="켜짐" unCheckedChildren="꺼짐" />
            </Form.Item>
            <Form.Item name="is_active" label="활성 상태" valuePropName="checked">
              <Switch checkedChildren="활성" unCheckedChildren="비활성" />
            </Form.Item>
          </div>

          <Form.Item name="verification_note" label="검증 안내">
            <TextArea rows={2} placeholder="검증 시 참고 안내 메시지" />
          </Form.Item>

          <Form.Item name="keywords" label="키워드 (쉼표 구분)">
            <Input placeholder="예: kca, 자격증, 코칭" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
