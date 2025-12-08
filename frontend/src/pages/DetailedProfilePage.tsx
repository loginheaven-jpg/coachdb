import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Select, Upload, InputNumber, Divider } from 'antd'
import { UploadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// 학위 유형
const DEGREE_TYPES = [
  { value: 'coaching', label: '코칭/상담/심리/교육/경영 관련 최종학위' },
  { value: 'other', label: '기타 학위' }
]

// 학위 레벨
const DEGREE_LEVELS = [
  { value: 'bachelor', label: '학사' },
  { value: 'master', label: '석사' },
  { value: 'doctorate', label: '박사' }
]

// 코칭 분야 (관련이력용)
const COACHING_FIELDS = [
  { value: 'business', label: '비즈니스코칭' },
  { value: 'career', label: '진로코칭' },
  { value: 'youth', label: '청년코칭' },
  { value: 'adolescent', label: '청소년코칭' },
  { value: 'family', label: '가족코칭' },
  { value: 'life', label: '그 외 라이프코칭' }
]

interface DegreeUpload {
  type: string
  degreeLevel: string
  degreeName: string
  fileList: UploadFile[]
}

interface FieldExperience {
  field: string
  coaching_history: string
  certifications: string
  historyFiles: UploadFile[]
  certFiles: UploadFile[]
}

export default function DetailedProfilePage() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [degreeUploads, setDegreeUploads] = useState<DegreeUpload[]>([])
  const [fieldExperiences, setFieldExperiences] = useState<FieldExperience[]>([])
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  // 페이지 로드 시 저장된 데이터 불러오기
  useEffect(() => {
    const savedData = localStorage.getItem('detailedProfile')
    if (savedData) {
      try {
        const data = JSON.parse(savedData)

        // 폼 데이터 복원
        form.setFieldsValue({
          total_coaching_hours: data.total_coaching_hours,
          degrees: data.degrees?.map((d: DegreeUpload) => d.type),
          field_experiences: data.field_experiences?.map((f: FieldExperience) => f.field)
        })

        // State 복원
        if (data.degrees) {
          setDegreeUploads(data.degrees)
        }
        if (data.field_experiences) {
          setFieldExperiences(data.field_experiences)
        }
        if (data.savedAt) {
          setLastSavedAt(data.savedAt)
        }

        console.log('저장된 데이터 복원:', data)
      } catch (error) {
        console.error('데이터 복원 실패:', error)
      }
    }
  }, [form])

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      // 세부정보 데이터 구성
      const savedAt = new Date().toISOString()
      const detailedProfileData = {
        total_coaching_hours: values.total_coaching_hours,
        degrees: degreeUploads,
        field_experiences: fieldExperiences,
        savedAt
      }

      // TODO: 추후 API 연동 필요
      // 현재는 localStorage에 임시 저장
      localStorage.setItem('detailedProfile', JSON.stringify(detailedProfileData))
      setLastSavedAt(savedAt)

      console.log('저장된 세부정보:', detailedProfileData)
      message.success('세부정보가 저장되었습니다!')
      navigate('/coach/dashboard')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '세부정보 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDegreeChange = (values: string[]) => {
    const newDegrees: DegreeUpload[] = values.map(type => {
      const existing = degreeUploads.find(d => d.type === type)
      return existing || { type, degreeLevel: '', degreeName: '', fileList: [] }
    })
    setDegreeUploads(newDegrees)
  }

  const handleFieldChange = (values: string[]) => {
    const newExperiences: FieldExperience[] = values.map(field => {
      const existing = fieldExperiences.find(e => e.field === field)
      return existing || {
        field,
        coaching_history: '',
        certifications: '',
        historyFiles: [],
        certFiles: []
      }
    })
    setFieldExperiences(newExperiences)
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <Card className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <Title level={2} className="text-center mb-2">
              세부정보 입력
            </Title>
            <Text className="block text-center text-gray-600">
              선택사항입니다. 나중에 입력하셔도 됩니다.
            </Text>
          </div>
          {lastSavedAt && (
            <div className="text-right text-gray-500 text-sm whitespace-nowrap ml-4">
              <div className="font-semibold">최종 수정일</div>
              <div>{new Date(lastSavedAt).toLocaleString('ko-KR')}</div>
            </div>
          )}
        </div>

        <Form
          form={form}
          name="detailed_profile"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          {/* 누적 코칭 시간 */}
          <Form.Item
            label={
              <span>
                누적 코칭 시간
                <Text type="secondary" className="ml-2 text-sm">
                  (KAC 인증을 위한 교육을 받기 시작한 시점부터의 코칭누적시간)
                </Text>
              </span>
            }
            name="total_coaching_hours"
          >
            <InputNumber
              min={0}
              className="w-full"
              placeholder="시간 단위로 입력"
              addonAfter="시간"
            />
          </Form.Item>

          <Divider />

          {/* 학위 */}
          <Form.Item
            label="학위"
            name="degrees"
          >
            <Select
              mode="multiple"
              placeholder="보유하신 학위를 선택하세요"
              onChange={handleDegreeChange}
            >
              {DEGREE_TYPES.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {degreeUploads.map((degree, index) => (
            <Card key={degree.type} size="small" className="mb-4">
              <Text strong>{DEGREE_TYPES.find(t => t.value === degree.type)?.label}</Text>

              <div className="mt-3">
                <Text>학위 레벨</Text>
                <Select
                  placeholder="학위 레벨을 선택하세요"
                  value={degree.degreeLevel || undefined}
                  onChange={(value) => {
                    const newDegrees = [...degreeUploads]
                    newDegrees[index].degreeLevel = value
                    setDegreeUploads(newDegrees)
                  }}
                  className="w-full mt-1"
                >
                  {DEGREE_LEVELS.map(level => (
                    <Option key={level.value} value={level.value}>
                      {level.label}
                    </Option>
                  ))}
                </Select>
              </div>

              <div className="mt-3">
                <Text>학위명</Text>
                <Input
                  placeholder="학위명을 입력하세요 (예: 경영학, 심리학)"
                  value={degree.degreeName}
                  onChange={(e) => {
                    const newDegrees = [...degreeUploads]
                    newDegrees[index].degreeName = e.target.value
                    setDegreeUploads(newDegrees)
                  }}
                  className="mt-1"
                />
              </div>

              <div className="mt-3">
                <Upload
                  fileList={degree.fileList}
                  onChange={({ fileList }) => {
                    const newDegrees = [...degreeUploads]
                    newDegrees[index].fileList = fileList
                    setDegreeUploads(newDegrees)
                  }}
                  beforeUpload={() => false}
                >
                  <Button icon={<UploadOutlined />}>
                    학위 증빙 파일 업로드
                  </Button>
                </Upload>
              </div>
            </Card>
          ))}

          <Divider />

          {/* 관련 이력 */}
          <Form.Item
            label="관련 이력 (복수 선택 가능)"
            name="field_experiences"
          >
            <Select
              mode="multiple"
              placeholder="관련 이력이 있는 코칭 분야를 선택하세요 (복수 선택 가능)"
              onChange={handleFieldChange}
            >
              {COACHING_FIELDS.map(field => (
                <Option key={field.value} value={field.value}>
                  {field.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {fieldExperiences.map((experience, index) => (
            <Card key={experience.field} className="mb-4">
              <Title level={5}>
                {COACHING_FIELDS.find(f => f.value === experience.field)?.label}
              </Title>

              {/* 코칭 이력 */}
              <div className="mb-4">
                <Text strong className="block mb-2">코칭 이력</Text>
                <TextArea
                  rows={3}
                  placeholder="이 분야의 코칭 이력을 입력하세요"
                  value={experience.coaching_history}
                  onChange={(e) => {
                    const newExperiences = [...fieldExperiences]
                    newExperiences[index].coaching_history = e.target.value
                    setFieldExperiences(newExperiences)
                  }}
                />
                <Upload
                  fileList={experience.historyFiles}
                  onChange={({ fileList }) => {
                    const newExperiences = [...fieldExperiences]
                    newExperiences[index].historyFiles = fileList
                    setFieldExperiences(newExperiences)
                  }}
                  beforeUpload={() => false}
                >
                  <Button icon={<UploadOutlined />} className="mt-2">
                    이력 증빙 파일 업로드
                  </Button>
                </Upload>
              </div>

              {/* 보유 자격 */}
              <div>
                <Text strong className="block mb-2">보유 자격</Text>
                <TextArea
                  rows={3}
                  placeholder="이 분야의 관련 자격을 입력하세요"
                  value={experience.certifications}
                  onChange={(e) => {
                    const newExperiences = [...fieldExperiences]
                    newExperiences[index].certifications = e.target.value
                    setFieldExperiences(newExperiences)
                  }}
                />
                <Upload
                  fileList={experience.certFiles}
                  onChange={({ fileList }) => {
                    const newExperiences = [...fieldExperiences]
                    newExperiences[index].certFiles = fileList
                    setFieldExperiences(newExperiences)
                  }}
                  beforeUpload={() => false}
                >
                  <Button icon={<UploadOutlined />} className="mt-2">
                    자격 증빙 파일 업로드
                  </Button>
                </Upload>
              </div>
            </Card>
          ))}

          <div className="flex gap-4 mt-8">
            <Form.Item className="flex-1 mb-0">
              <Button
                type="primary"
                htmlType="submit"
                className="w-full"
                loading={loading}
                size="large"
              >
                저장하고 완료
              </Button>
            </Form.Item>

            <Form.Item className="flex-1 mb-0">
              <Button
                type="default"
                onClick={() => navigate('/coach/dashboard')}
                className="w-full"
                size="large"
              >
                나중에 입력하기
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Card>
    </div>
  )
}
