import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Typography,
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Space,
  Radio,
  Alert
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import projectService, { CoachEvaluationCreate } from '../services/projectService'

const { Title, Text } = Typography
const { TextArea } = Input

export default function ProjectEvaluationCreatePage() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: any) => {
    if (!projectId) return
    setLoading(true)
    try {
      const evaluationData: CoachEvaluationCreate = {
        project_id: parseInt(projectId),
        coach_user_id: values.coach_user_id,
        participation_score: values.participation_score,
        feedback_text: values.feedback_text || null,
        special_notes: values.special_notes || null
      }

      await projectService.createCoachEvaluation(parseInt(projectId), evaluationData)
      message.success('평가가 등록되었습니다.')
      navigate(`/admin/projects/${projectId}`)
    } catch (error: any) {
      console.error('평가 생성 실패:', error)
      message.error(error.response?.data?.detail || '평가 등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/admin/projects/${projectId}`)}
          >
            과제 상세로 돌아가기
          </Button>
        </div>

        <Card>
          <div className="mb-6">
            <Title level={2} className="mb-2">코치 평가 등록</Title>
            <Text className="text-gray-600">
              과제에 참여한 코치에 대한 평가를 입력해주세요.
            </Text>
          </div>

          <Alert
            message="평가 기준"
            description={
              <div>
                <p><strong>3점:</strong> 우수 (적극적으로 참여함)</p>
                <p><strong>2점:</strong> 보통 (만족할만한 참여)</p>
                <p><strong>1점:</strong> 미흡 (참여가 부족함)</p>
              </div>
            }
            type="info"
            className="mb-6"
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              participation_score: 3
            }}
          >
            <Form.Item
              name="coach_user_id"
              label="코치 사용자 ID"
              rules={[
                { required: true, message: '코치 사용자 ID를 입력해주세요.' },
                { type: 'number', min: 1, message: '유효한 사용자 ID를 입력해주세요.' }
              ]}
              help="평가할 코치의 사용자 ID를 입력해주세요."
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                size="large"
                placeholder="예: 6"
              />
            </Form.Item>

            <Form.Item
              name="participation_score"
              label="참여 점수"
              rules={[{ required: true, message: '참여 점수를 선택해주세요.' }]}
            >
              <Radio.Group size="large">
                <Space direction="vertical">
                  <Radio value={3}>3점 - 우수</Radio>
                  <Radio value={2}>2점 - 보통</Radio>
                  <Radio value={1}>1점 - 미흡</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="feedback_text"
              label="피드백"
              rules={[{ required: true, message: '피드백을 입력해주세요.' }]}
            >
              <TextArea
                rows={5}
                placeholder="코치의 참여 태도, 기여도, 개선점 등을 구체적으로 작성해주세요."
              />
            </Form.Item>

            <Form.Item
              name="special_notes"
              label="특이사항 (선택)"
            >
              <TextArea
                rows={3}
                placeholder="기타 특이사항이나 추가로 전달할 내용이 있다면 입력해주세요."
              />
            </Form.Item>

            <Form.Item className="mb-0">
              <Space className="w-full justify-end">
                <Button
                  size="large"
                  onClick={() => navigate(`/admin/projects/${projectId}`)}
                >
                  취소
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  icon={<SaveOutlined />}
                >
                  평가 등록
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  )
}
