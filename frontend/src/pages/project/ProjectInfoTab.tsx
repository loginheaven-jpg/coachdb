import { useState, useEffect, useCallback } from 'react'
import {
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Popconfirm,
  Modal,
  Table,
  message
} from 'antd'
import { useProjectEdit } from '../../contexts/ProjectEditContext'
import projectService, {
  ProjectUpdate,
  ProjectStatus,
  ProjectType,
  PROJECT_TYPE_LABELS,
  StartReviewPreviewResponse
} from '../../services/projectService'
import adminService from '../../services/adminService'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { TextArea } = Input
const { RangePicker } = DatePicker

// 상태별 태그 색상
const STATUS_TAG_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '초안' },
  pending: { color: 'orange', text: '승인대기' },
  approved: { color: 'blue', text: '승인완료' },
  rejected: { color: 'red', text: '반려됨' },
  ready: { color: 'green', text: '모집개시' },
  recruiting: { color: 'green', text: '모집중' },
  reviewing: { color: 'purple', text: '심사중' },
  in_progress: { color: 'cyan', text: '과제진행중' },
  evaluating: { color: 'gold', text: '과제평가중' },
  closed: { color: 'default', text: '종료' }
}

export default function ProjectInfoTab() {
  const [form] = Form.useForm()
  const {
    project,
    isCreateMode,
    projectId,
    saveProject,
    saving,
    loadProject,
    setProject
  } = useProjectEdit()

  const { user } = useAuthStore()
  const [allUsers, setAllUsers] = useState<{ user_id: number; name: string; email: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [localSaving, setLocalSaving] = useState(false)

  // 진행버튼 관련 상태
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [startReviewModalOpen, setStartReviewModalOpen] = useState(false)
  const [startReviewPreview, setStartReviewPreview] = useState<StartReviewPreviewResponse | null>(null)

  // 사용자 목록 로드
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        const users = await adminService.getUsers()
        setAllUsers(users)
      } catch (error) {
        console.error('사용자 목록 로드 실패:', error)
      } finally {
        setLoadingUsers(false)
      }
    }
    loadUsers()
  }, [])

  // 프로젝트 데이터가 로드되면 폼에 설정
  useEffect(() => {
    if (project) {
      form.setFieldsValue({
        project_name: project.project_name,
        project_type: project.project_type || ProjectType.OTHER,
        description: project.description,
        support_program_name: project.support_program_name,
        recruitment_period: [
          dayjs(project.recruitment_start_date),
          dayjs(project.recruitment_end_date)
        ],
        project_period: project.project_start_date && project.project_end_date ? [
          dayjs(project.project_start_date),
          dayjs(project.project_end_date)
        ] : null,
        actual_period: project.actual_start_date && project.actual_end_date ? [
          dayjs(project.actual_start_date),
          dayjs(project.actual_end_date)
        ] : null,
        project_manager_id: project.project_manager_id
      })
    }
  }, [project, form])

  // 폼 데이터를 ProjectUpdate로 변환
  const getUpdateData = (values: any): ProjectUpdate => ({
    project_name: values.project_name,
    project_type: values.project_type || ProjectType.OTHER,
    description: values.description || null,
    support_program_name: values.support_program_name || null,
    recruitment_start_date: values.recruitment_period[0].format('YYYY-MM-DD'),
    recruitment_end_date: values.recruitment_period[1].format('YYYY-MM-DD'),
    project_start_date: values.project_period ? values.project_period[0].format('YYYY-MM-DD') : null,
    project_end_date: values.project_period ? values.project_period[1].format('YYYY-MM-DD') : null,
    actual_start_date: values.actual_period ? values.actual_period[0].format('YYYY-MM-DD') : null,
    actual_end_date: values.actual_period ? values.actual_period[1].format('YYYY-MM-DD') : null,
    project_manager_id: values.project_manager_id || null
  })

  // 임시저장 핸들러
  const handleTempSave = useCallback(async () => {
    if (isCreateMode) {
      // 생성 모드: 새 과제 생성
      try {
        const values = await form.validateFields()
        setLocalSaving(true)
        const createData = {
          project_name: values.project_name,
          project_type: values.project_type || ProjectType.OTHER,
          description: values.description || null,
          support_program_name: values.support_program_name || null,
          recruitment_start_date: values.recruitment_period[0].format('YYYY-MM-DD'),
          recruitment_end_date: values.recruitment_period[1].format('YYYY-MM-DD'),
          project_start_date: values.project_period ? values.project_period[0].format('YYYY-MM-DD') : null,
          project_end_date: values.project_period ? values.project_period[1].format('YYYY-MM-DD') : null,
          project_manager_id: values.project_manager_id || null,
          status: ProjectStatus.DRAFT
        }
        const newProject = await projectService.createProject(createData)
        message.success('과제가 생성되었습니다.')
        // 새 과제 페이지로 리디렉트
        window.location.href = `/projects/manage/${newProject.project_id}?tab=info`
      } catch (error: any) {
        if (error.errorFields) {
          message.error('필수 항목을 입력해주세요.')
        } else {
          message.error(error.response?.data?.detail || '저장에 실패했습니다.')
        }
      } finally {
        setLocalSaving(false)
      }
    } else {
      // 수정 모드: 기존 과제 업데이트
      try {
        const values = await form.validateFields()
        const updateData = getUpdateData(values)
        await saveProject(updateData, true)
      } catch (error: any) {
        if (error.errorFields) {
          message.error('필수 항목을 입력해주세요.')
        }
      }
    }
  }, [form, isCreateMode, saveProject])

  // 전역 이벤트로 임시저장 트리거 받기
  useEffect(() => {
    const handler = () => handleTempSave()
    window.addEventListener('projectTempSave', handler)
    return () => window.removeEventListener('projectTempSave', handler)
  }, [handleTempSave])

  // 현재 상태 표시 (백엔드는 대문자, 프론트엔드 맵은 소문자)
  const currentStatus = (project?.status || 'draft').toLowerCase()
  const statusInfo = STATUS_TAG_MAP[currentStatus] || { color: 'default', text: currentStatus }

  // 권한 확인: 과제관리자 또는 생성자 또는 SUPER_ADMIN
  const isManager = user && project && (
    user.roles?.includes('SUPER_ADMIN') ||
    user.user_id === project.project_manager_id ||
    user.user_id === project.created_by
  )

  // 모집개시 핸들러
  const handleStartRecruitment = async () => {
    if (!projectId) return
    setActionLoading('startRecruitment')
    try {
      await projectService.startRecruitment(projectId)
      message.success('모집이 개시되었습니다.')
      loadProject()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '모집개시에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  // 응모마감 핸들러
  const handleFreezeApplications = async () => {
    if (!projectId) return
    setActionLoading('freeze')
    try {
      const result = await projectService.freezeApplications(projectId)
      message.success(`응모가 마감되었습니다. (${result.frozen_count}건 동결)`)
      loadProject()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '응모마감에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  // 심사개시 미리보기
  const handlePreviewStartReview = async () => {
    if (!projectId) return
    setActionLoading('previewReview')
    try {
      const preview = await projectService.previewStartReview(projectId)
      setStartReviewPreview(preview)
      setStartReviewModalOpen(true)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '심사개시 미리보기에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  // 심사개시 확정
  const handleConfirmStartReview = async () => {
    if (!projectId) return
    setActionLoading('startReview')
    try {
      const result = await projectService.startReview(projectId)
      message.success(`심사가 개시되었습니다. (서류완료: ${result.qualified_count}건, 서류탈락: ${result.disqualified_count}건)`)
      setStartReviewModalOpen(false)
      setStartReviewPreview(null)
      loadProject()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '심사개시에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  // 진행버튼 렌더링
  const renderProgressButton = () => {
    if (!isManager || isCreateMode) return null

    // APPROVED 상태 → 모집개시 버튼
    if (currentStatus === 'approved') {
      return (
        <Popconfirm
          title="모집개시"
          description="모집을 개시하시겠습니까? 코치들이 지원할 수 있게 됩니다."
          onConfirm={handleStartRecruitment}
          okText="모집개시"
          cancelText="취소"
        >
          <Button
            type="primary"
            loading={actionLoading === 'startRecruitment'}
          >
            모집개시
          </Button>
        </Popconfirm>
      )
    }

    // READY 상태 → 응모마감 버튼
    if (currentStatus === 'ready') {
      return (
        <Popconfirm
          title="응모마감"
          description="응모를 마감하시겠습니까? 더 이상 새로운 응모를 받지 않습니다."
          onConfirm={handleFreezeApplications}
          okText="응모마감"
          cancelText="취소"
        >
          <Button
            type="primary"
            danger
            loading={actionLoading === 'freeze'}
          >
            응모마감
          </Button>
        </Popconfirm>
      )
    }

    // REVIEWING 상태 + 심사개시 전 → 심사개시 버튼
    if (currentStatus === 'reviewing' && !project?.review_started_at) {
      return (
        <Button
          type="primary"
          danger
          onClick={handlePreviewStartReview}
          loading={actionLoading === 'previewReview'}
        >
          심사개시
        </Button>
      )
    }

    return null
  }

  return (
    <Form
      form={form}
      layout="vertical"
    >
      {/* 과제 구분 + 상태 */}
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="project_type"
            label="과제 구분"
            rules={[{ required: true, message: '과제 구분을 선택해주세요.' }]}
          >
            <Select size="large" placeholder="과제 구분 선택">
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <Select.Option key={value} value={value}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="과제 상태">
            <Space>
              <Tag color={statusInfo.color} style={{ fontSize: 14, padding: '4px 12px' }}>
                {statusInfo.text}
              </Tag>
              {project?.review_started_at && currentStatus === 'reviewing' && (
                <Tag color="red" style={{ fontSize: 12 }}>심사개시됨</Tag>
              )}
              {renderProgressButton()}
            </Space>
          </Form.Item>
        </Col>
      </Row>

      {/* 과제명 */}
      <Form.Item
        name="project_name"
        label="과제명"
        rules={[{ required: true, message: '과제명을 입력해주세요.' }]}
      >
        <Input placeholder="예: 2025년 상반기 리더코치 양성 과제" size="large" />
      </Form.Item>

      {/* 지원 사업명 */}
      <Form.Item
        name="support_program_name"
        label="지원 사업명 (선택사항)"
        help="이 과제가 특정 지원 사업의 일부인 경우 입력"
      >
        <Input placeholder="예: 한국코치협회 2025 상반기 코치양성 지원사업" size="large" />
      </Form.Item>

      {/* 과제 설명 */}
      <Form.Item
        name="description"
        label="과제 설명"
      >
        <TextArea
          rows={4}
          placeholder="과제에 대한 설명을 입력해주세요."
        />
      </Form.Item>

      {/* 모집 기간 */}
      <Form.Item
        name="recruitment_period"
        label="모집 기간"
        rules={[{ required: true, message: '모집 기간을 선택해주세요.' }]}
      >
        <RangePicker
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
          size="large"
        />
      </Form.Item>

      {/* 과제 기간 (예정) */}
      <Form.Item
        name="project_period"
        label="과제 기간 (예정)"
        help="과제 진행 예정 기간입니다."
      >
        <RangePicker
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
          size="large"
        />
      </Form.Item>

      {/* 과제 기간 (실제) - 수정 모드에서만 표시 */}
      {!isCreateMode && (
        <Form.Item
          name="actual_period"
          label="과제 기간 (실제)"
          help="과제 종료 시 실제 진행 기간을 입력합니다."
        >
          <RangePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            size="large"
          />
        </Form.Item>
      )}

      {/* 과제관리자 */}
      <Form.Item
        name="project_manager_id"
        label="과제관리자 (선택사항)"
        help="다른 사람에게 위임 시 선택, 미선택시 본인이 관리자"
      >
        <Select
          showSearch
          allowClear
          size="large"
          placeholder="위임할 사용자 검색 (미선택 시 본인)"
          loading={loadingUsers}
          optionFilterProp="children"
          filterOption={(input, option) => {
            const user = allUsers.find(u => u.user_id === option?.value)
            if (!user) return false
            const searchText = input.toLowerCase()
            return (
              user.name.toLowerCase().includes(searchText) ||
              user.email.toLowerCase().includes(searchText)
            )
          }}
          options={allUsers.map(user => ({
            value: user.user_id,
            label: `${user.name} (${user.email})`
          }))}
        />
      </Form.Item>

      {/* 심사개시 확인 모달 */}
      <Modal
        title="심사개시 확인"
        open={startReviewModalOpen}
        onOk={handleConfirmStartReview}
        onCancel={() => {
          setStartReviewModalOpen(false)
          setStartReviewPreview(null)
        }}
        okText="심사개시"
        cancelText="취소"
        okButtonProps={{ danger: true, loading: actionLoading === 'startReview' }}
        width={700}
      >
        {startReviewPreview && (
          <div>
            <p style={{ marginBottom: 16 }}>
              <strong>{startReviewPreview.project_name}</strong> 과제의 심사를 개시합니다.
            </p>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold' }}>{startReviewPreview.total_applications}</div>
                  <div>총 응모</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: 16, background: '#f6ffed', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{startReviewPreview.qualified_count}</div>
                  <div>서류완료</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center', padding: 16, background: '#fff2f0', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{startReviewPreview.disqualified_count}</div>
                  <div>서류탈락 예정</div>
                </div>
              </Col>
            </Row>

            {startReviewPreview.disqualified_count > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, color: '#ff4d4f', fontWeight: 'bold' }}>
                  ⚠ 서류탈락 예정 목록 ({startReviewPreview.disqualified_count}건)
                </div>
                <Table
                  size="small"
                  dataSource={startReviewPreview.disqualified_list}
                  rowKey="application_id"
                  pagination={false}
                  scroll={{ y: 200 }}
                  columns={[
                    { title: '이름', dataIndex: 'user_name', width: 100 },
                    { title: '이메일', dataIndex: 'user_email', width: 180 },
                    { title: '미완료 항목', dataIndex: 'pending_items_count', width: 90, render: (v) => `${v}건` },
                    { title: '사유', dataIndex: 'reason', ellipsis: true }
                  ]}
                />
              </div>
            )}

            <div style={{ padding: 12, background: '#fffbe6', borderRadius: 8, color: '#ad8b00' }}>
              <strong>⚠ 주의사항</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>심사개시 후에는 코치의 보완 제출이 차단됩니다.</li>
                <li>서류탈락된 응모건은 심사 대상에서 제외됩니다.</li>
                <li>이 작업은 되돌릴 수 없습니다.</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </Form>
  )
}
