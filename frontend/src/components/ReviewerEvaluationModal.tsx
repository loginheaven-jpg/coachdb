import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Slider,
  Input,
  Radio,
  Space,
  Card,
  Typography,
  Spin,
  message,
  Divider,
  List,
  Avatar,
  Tag,
  Descriptions
} from 'antd'
import {
  UserOutlined,
  StarOutlined,
  CommentOutlined
} from '@ant-design/icons'
import scoringService, {
  ReviewerEvaluationCreate,
  ReviewerEvaluationResponse,
  Recommendation
} from '../services/scoringService'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface ReviewerEvaluationModalProps {
  open: boolean
  applicationId: number
  onClose: () => void
  onSuccess: () => void
}

const recommendationLabels: Record<Recommendation, { label: string; color: string }> = {
  [Recommendation.STRONGLY_RECOMMEND]: { label: '강력 추천', color: 'green' },
  [Recommendation.RECOMMEND]: { label: '추천', color: 'blue' },
  [Recommendation.NEUTRAL]: { label: '보류', color: 'orange' },
  [Recommendation.NOT_RECOMMEND]: { label: '비추천', color: 'red' }
}

export default function ReviewerEvaluationModal({
  open,
  applicationId,
  onClose,
  onSuccess
}: ReviewerEvaluationModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [myEvaluation, setMyEvaluation] = useState<ReviewerEvaluationResponse | null>(null)
  const [allEvaluations, setAllEvaluations] = useState<ReviewerEvaluationResponse[]>([])
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (open && applicationId) {
      loadEvaluations()
    }
  }, [open, applicationId])

  const loadEvaluations = async () => {
    try {
      setLoading(true)
      const [myEval, evalList] = await Promise.all([
        scoringService.getMyEvaluation(applicationId),
        scoringService.getApplicationEvaluations(applicationId)
      ])

      setMyEvaluation(myEval)
      setAllEvaluations(evalList)

      if (myEval) {
        form.setFieldsValue({
          motivation_score: myEval.motivation_score,
          expertise_score: myEval.expertise_score,
          role_fit_score: myEval.role_fit_score,
          comment: myEval.comment,
          recommendation: myEval.recommendation
        })
        setIsEditing(true)
      } else {
        form.resetFields()
        setIsEditing(false)
      }
    } catch (error: any) {
      console.error('Failed to load evaluations:', error)
      message.error('평가 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const data: ReviewerEvaluationCreate = {
        motivation_score: values.motivation_score,
        expertise_score: values.expertise_score,
        role_fit_score: values.role_fit_score,
        comment: values.comment || null,
        recommendation: values.recommendation || null
      }

      if (isEditing && myEvaluation) {
        await scoringService.updateEvaluation(applicationId, myEvaluation.evaluation_id, data)
        message.success('평가가 수정되었습니다.')
      } else {
        await scoringService.createEvaluation(applicationId, data)
        message.success('평가가 등록되었습니다.')
      }

      onSuccess()
    } catch (error: any) {
      console.error('Failed to submit evaluation:', error)
      message.error(error.response?.data?.detail || '평가 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalScore =
    (form.getFieldValue('motivation_score') || 0) +
    (form.getFieldValue('expertise_score') || 0) +
    (form.getFieldValue('role_fit_score') || 0)

  return (
    <Modal
      title={
        <Space>
          <StarOutlined />
          <span>정성평가</span>
          {isEditing && <Tag color="blue">수정 모드</Tag>}
        </Space>
      }
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText={isEditing ? '수정' : '등록'}
      cancelText="닫기"
      confirmLoading={submitting}
      width={700}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Evaluation Form */}
          <Card title="내 평가" size="small">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                motivation_score: 5,
                expertise_score: 5,
                role_fit_score: 5
              }}
            >
              <Form.Item
                name="motivation_score"
                label="지원동기 (0-10점)"
                rules={[{ required: true, message: '점수를 입력해주세요' }]}
              >
                <Slider
                  min={0}
                  max={10}
                  marks={{ 0: '0', 5: '5', 10: '10' }}
                  tooltip={{ formatter: (v) => `${v}점` }}
                />
              </Form.Item>

              <Form.Item
                name="expertise_score"
                label="전문성 (0-10점)"
                rules={[{ required: true, message: '점수를 입력해주세요' }]}
              >
                <Slider
                  min={0}
                  max={10}
                  marks={{ 0: '0', 5: '5', 10: '10' }}
                  tooltip={{ formatter: (v) => `${v}점` }}
                />
              </Form.Item>

              <Form.Item
                name="role_fit_score"
                label="역할적합성 (0-10점)"
                rules={[{ required: true, message: '점수를 입력해주세요' }]}
              >
                <Slider
                  min={0}
                  max={10}
                  marks={{ 0: '0', 5: '5', 10: '10' }}
                  tooltip={{ formatter: (v) => `${v}점` }}
                />
              </Form.Item>

              <Form.Item noStyle shouldUpdate>
                {() => (
                  <div className="bg-gray-50 p-3 rounded mb-4">
                    <Text strong>
                      합계: {totalScore}점 / 30점
                    </Text>
                  </div>
                )}
              </Form.Item>

              <Form.Item
                name="recommendation"
                label="추천 의견"
              >
                <Radio.Group>
                  <Space direction="vertical">
                    <Radio value={Recommendation.STRONGLY_RECOMMEND}>
                      <Tag color="green">강력 추천</Tag>
                    </Radio>
                    <Radio value={Recommendation.RECOMMEND}>
                      <Tag color="blue">추천</Tag>
                    </Radio>
                    <Radio value={Recommendation.NEUTRAL}>
                      <Tag color="orange">보류</Tag>
                    </Radio>
                    <Radio value={Recommendation.NOT_RECOMMEND}>
                      <Tag color="red">비추천</Tag>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="comment"
                label="종합 의견"
              >
                <TextArea
                  rows={4}
                  placeholder="지원자에 대한 종합 의견을 입력해주세요..."
                  maxLength={1000}
                  showCount
                />
              </Form.Item>
            </Form>
          </Card>

          {/* Other Evaluations */}
          {allEvaluations.length > 0 && (
            <>
              <Divider />
              <Card
                title={
                  <Space>
                    <CommentOutlined />
                    <span>다른 심사위원 평가</span>
                    <Tag>{allEvaluations.length}명</Tag>
                  </Space>
                }
                size="small"
              >
                <List
                  itemLayout="horizontal"
                  dataSource={allEvaluations}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={
                          <Space>
                            <Text strong>{item.reviewer?.name || '심사위원'}</Text>
                            <Text type="secondary" className="text-xs">
                              {new Date(item.evaluated_at).toLocaleDateString('ko-KR')}
                            </Text>
                          </Space>
                        }
                        description={
                          <div>
                            <Space className="mb-2">
                              <Tag>지원동기: {item.motivation_score}</Tag>
                              <Tag>전문성: {item.expertise_score}</Tag>
                              <Tag>적합성: {item.role_fit_score}</Tag>
                              <Tag color="blue">합계: {item.total_score}</Tag>
                              {item.recommendation && (
                                <Tag color={recommendationLabels[item.recommendation as Recommendation]?.color}>
                                  {recommendationLabels[item.recommendation as Recommendation]?.label}
                                </Tag>
                              )}
                            </Space>
                            {item.comment && (
                              <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                                {item.comment}
                              </Paragraph>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
