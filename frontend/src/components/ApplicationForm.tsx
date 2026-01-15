/**
 * 과제 응모 폼 컴포넌트
 *
 * 동적으로 생성된 설문 항목을 렌더링하여 응모 폼을 구성
 */
import { useState, useEffect } from 'react'
import { Form, Button, Space, Card, Typography, Divider, message } from 'antd'
import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import DynamicFieldRenderer from './DynamicFieldRenderer'
import projectService, { ProjectItem } from '../services/projectService'

const { Title, Text } = Typography

interface ApplicationFormProps {
  projectId: number
  readOnly?: boolean
  onSubmit?: (data: any) => void
}

interface FormValues {
  [itemId: number]: any
}

export default function ApplicationForm({ projectId, readOnly, onSubmit }: ApplicationFormProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([])
  const [formValues, setFormValues] = useState<FormValues>({})

  useEffect(() => {
    loadProjectItems()
  }, [projectId])

  const loadProjectItems = async () => {
    setLoading(true)
    try {
      const items = await projectService.getProjectItems(projectId)
      setProjectItems(items.sort((a, b) => a.display_order - b.display_order))
    } catch (error: any) {
      console.error('설문 항목 로드 실패:', error)
      message.error('설문 항목을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (isDraft: boolean) => {
    try {
      const values = await form.validateFields()

      // Validate required fields
      for (const item of projectItems) {
        if (item.is_required && !values[item.item_id]) {
          message.error(`${item.competency_item?.item_name} 항목은 필수입니다.`)
          return
        }
      }

      const applicationData = {
        project_id: projectId,
        is_draft: isDraft,
        answers: Object.entries(values).map(([itemId, value]) => ({
          project_item_id: parseInt(itemId),
          answer_data: JSON.stringify(value)
        }))
      }

      if (onSubmit) {
        onSubmit(applicationData)
      }

      message.success(isDraft ? '임시저장되었습니다.' : '제출되었습니다.')
    } catch (error: any) {
      console.error('제출 실패:', error)
      message.error('제출에 실패했습니다.')
    }
  }

  // 카테고리를 그룹명으로 변환
  const getCategoryGroup = (item: ProjectItem): string => {
    const itemCode = item.competency_item?.item_code || ''
    const template = item.competency_item?.template || ''
    const category = item.competency_item?.category || ''

    // EXP_COACHING_TRAINING 또는 coaching_time 템플릿은 '코칭연수' 그룹
    if (itemCode === 'EXP_COACHING_TRAINING' || template === 'coaching_time') {
      return '코칭연수'
    }

    // 카테고리별 그룹 매핑
    const categoryGroupMap: Record<string, string> = {
      'CERTIFICATION': '자격증',
      'EDUCATION': '학력',
      'EXPERIENCE': '코칭경력',
      'OTHER': '기타',
      // Legacy categories
      'BASIC': '기본정보',
      'DETAIL': '코칭경력',
      'ADDON': '코칭경력',
      'COACHING': '코칭경력',
      'EVALUATION': '코칭경력'
    }

    return categoryGroupMap[category] || '코칭경력'
  }

  // 그룹별로 항목 분류
  const groupedItems = projectItems.reduce((groups, item) => {
    if (!item.competency_item) return groups

    const groupName = getCategoryGroup(item)
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(item)
    return groups
  }, {} as Record<string, ProjectItem[]>)

  // 그룹 표시 순서
  const groupOrder = ['자격증', '학력', '코칭연수', '코칭경력', '기타']

  const categoryNames: Record<string, string> = {
    '자격증': '자격증',
    '학력': '학력',
    '코칭연수': '코칭연수',
    '코칭경력': '코칭경력',
    '기타': '기타',
    // Legacy - 직접 카테고리명으로 표시되는 경우 대비
    'BASIC': '기본정보',
    'CERTIFICATION': '자격증',
    'EDUCATION': '학력',
    'EXPERIENCE': '코칭경력',
    'OTHER': '기타',
    'DETAIL': '코칭경력',
    'ADDON': '코칭경력',
    'COACHING': '코칭경력',
    'EVALUATION': '코칭경력'
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <Card>
        <Title level={3}>과제 응모</Title>
        <Text type="secondary">
          필수 항목(*)은 반드시 입력해야 합니다. 증빙이 필요한 항목은 관련 파일을 첨부해주세요.
        </Text>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          initialValues={formValues}
          disabled={readOnly}
        >
          {groupOrder.map(groupName => {
            const items = groupedItems[groupName]
            if (!items || items.length === 0) return null

            return (
            <div key={groupName}>
              <Title level={4}>{categoryNames[groupName] || groupName}</Title>
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {items.map((projectItem) => {
                  if (!projectItem.competency_item) return null

                  return (
                    <Form.Item
                      key={projectItem.project_item_id}
                      name={projectItem.item_id}
                      rules={[
                        {
                          required: projectItem.is_required,
                          message: `${projectItem.competency_item.item_name} 항목은 필수입니다.`
                        }
                      ]}
                    >
                      <DynamicFieldRenderer
                        item={projectItem.competency_item}
                        value={formValues[projectItem.item_id]}
                        onChange={(value) => {
                          setFormValues({ ...formValues, [projectItem.item_id]: value })
                          form.setFieldValue(projectItem.item_id, value)
                        }}
                        disabled={readOnly}
                      />
                    </Form.Item>
                  )
                })}
              </Space>
              <Divider />
            </div>
            )
          })}

          {!readOnly && (
            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button
                size="large"
                icon={<SaveOutlined />}
                onClick={() => handleSubmit(true)}
                loading={loading}
              >
                임시저장
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                onClick={() => handleSubmit(false)}
                loading={loading}
              >
                제출
              </Button>
            </Space>
          )}
        </Form>
      </Card>
    </div>
  )
}
