import { Form, Input, Radio, DatePicker, InputNumber, Space } from 'antd'
import { WizardState, WizardActions } from '../../../../hooks/useWizardState'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { TextArea } = Input

interface Step2Props {
  state: WizardState
  actions: WizardActions
}

export default function Step2BasicInfo({ state, actions }: Step2Props) {
  const [form] = Form.useForm()

  const handleValuesChange = (changedValues: any, allValues: any) => {
    // DatePicker에서 moment/dayjs 객체가 오므로 ISO string으로 변환
    const updates: any = {}

    if (allValues.projectName) updates.projectName = allValues.projectName
    if (allValues.projectType) updates.projectType = allValues.projectType
    if (allValues.supportProgramName) updates.supportProgramName = allValues.supportProgramName
    if (allValues.description) updates.description = allValues.description
    if (allValues.maxParticipants) updates.maxParticipants = allValues.maxParticipants

    if (allValues.recruitmentDates) {
      updates.recruitmentStartDate = allValues.recruitmentDates[0]?.format('YYYY-MM-DD') || ''
      updates.recruitmentEndDate = allValues.recruitmentDates[1]?.format('YYYY-MM-DD') || ''
    }

    if (allValues.projectDates) {
      updates.projectStartDate = allValues.projectDates[0]?.format('YYYY-MM-DD') || ''
      updates.projectEndDate = allValues.projectDates[1]?.format('YYYY-MM-DD') || ''
    }

    actions.updateProjectInfo(updates)
  }

  return (
    <div className="wizard-question">
      <h2 className="wizard-question-title">
        과제의 기본 정보를 입력해주세요
      </h2>

      <div className="wizard-question-hint">
        💡 나중에 수정할 수 있습니다
      </div>

      <Form
        form={form}
        layout="vertical"
        size="large"
        onValuesChange={handleValuesChange}
        initialValues={{
          projectName: state.projectName,
          projectType: state.projectType || 'other',
          supportProgramName: state.supportProgramName,
          description: state.description,
          maxParticipants: state.maxParticipants,
          recruitmentDates: state.recruitmentStartDate && state.recruitmentEndDate
            ? [dayjs(state.recruitmentStartDate), dayjs(state.recruitmentEndDate)]
            : undefined,
          projectDates: state.projectStartDate && state.projectEndDate
            ? [dayjs(state.projectStartDate), dayjs(state.projectEndDate)]
            : undefined
        }}
      >
        <Form.Item
          label="과제명"
          name="projectName"
          rules={[{ required: true, message: '과제명을 입력해주세요' }]}
        >
          <Input placeholder="예: 2024 비즈니스 코칭 지원" />
        </Form.Item>

        <Form.Item
          label="과제 유형"
          name="projectType"
          rules={[{ required: true }]}
        >
          <Radio.Group>
            <Space>
              <Radio value="business_coaching">비즈니스코칭</Radio>
              <Radio value="public_coaching">공익코칭</Radio>
              <Radio value="other">기타</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label="지원 사업명 (선택)"
          name="supportProgramName"
        >
          <Input placeholder="예: 서울시 코칭 지원 사업" />
        </Form.Item>

        <Form.Item
          label="과제 설명 (선택)"
          name="description"
        >
          <TextArea rows={4} placeholder="과제에 대한 간단한 설명을 입력하세요" />
        </Form.Item>

        <Form.Item
          label="모집 인원"
          name="maxParticipants"
          rules={[{ required: true, message: '모집 인원을 입력해주세요' }]}
        >
          <InputNumber min={1} max={1000} addonAfter="명" style={{ width: 200 }} />
        </Form.Item>

        <Form.Item
          label="모집 기간"
          name="recruitmentDates"
          rules={[{ required: true, message: '모집 기간을 선택해주세요' }]}
        >
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="과제 기간 (선택)"
          name="projectDates"
        >
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </div>
  )
}
