import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography, Select, Upload, InputNumber, Divider, Spin } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import profileService, { DetailedProfile, DegreeItem, CertificationItem, MentoringExperienceItem, FieldExperience } from '../services/profileService'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// Degree types
const DEGREE_TYPES = [
  { value: 'coaching', label: '코칭/상담/심리/교육/경영 관련 최종학위' },
  { value: 'other', label: '기타 학위' }
]

// Degree levels
const DEGREE_LEVELS = [
  { value: '박사', label: '박사' },
  { value: '박사수료', label: '박사수료' },
  { value: '석사', label: '석사' },
  { value: '학사', label: '학사' }
]

// Coaching fields
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
  file_id?: number
}

interface FieldExperienceUI {
  field: string
  coaching_history: string
  certifications: string
  historyFiles: UploadFile[]
  certFiles: UploadFile[]
}

export default function DetailedProfilePage() {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [degreeUploads, setDegreeUploads] = useState<DegreeUpload[]>([])
  const [fieldExperiences, setFieldExperiences] = useState<FieldExperienceUI[]>([])
  const [coachingYears, setCoachingYears] = useState<number | null>(null)
  const [specialty, setSpecialty] = useState<string>('')

  // Load profile data from API on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setInitialLoading(true)
        const profile = await profileService.getDetailedProfile()

        // Set form values
        form.setFieldsValue({
          total_coaching_hours: profile.total_coaching_hours,
          coaching_years: profile.coaching_years,
          specialty: profile.specialty,
          degrees: profile.degrees?.map((d: DegreeItem) => d.type) || [],
          field_experiences: Object.keys(profile.field_experiences || {})
        })

        setCoachingYears(profile.coaching_years || null)
        setSpecialty(profile.specialty || '')

        // Convert degrees from API format to UI format
        if (profile.degrees && profile.degrees.length > 0) {
          const degrees: DegreeUpload[] = profile.degrees.map((d: DegreeItem) => ({
            type: d.type,
            degreeLevel: d.degreeLevel || '',
            degreeName: d.degreeName || '',
            fileList: [],
            file_id: d.file_id
          }))
          setDegreeUploads(degrees)
        }

        // Convert field_experiences from API format to UI format
        if (profile.field_experiences && Object.keys(profile.field_experiences).length > 0) {
          const experiences: FieldExperienceUI[] = Object.entries(profile.field_experiences).map(
            ([field, exp]: [string, any]) => ({
              field,
              coaching_history: exp.coaching_history || '',
              certifications: exp.certifications || '',
              historyFiles: [],
              certFiles: []
            })
          )
          setFieldExperiences(experiences)
        }

        console.log('Profile loaded from API:', profile)
      } catch (error) {
        console.error('Failed to load profile:', error)
        message.error('프로필 정보를 불러오는데 실패했습니다.')
      } finally {
        setInitialLoading(false)
      }
    }

    loadProfile()
  }, [form])

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      // Convert UI data to API format
      const degreesForApi: DegreeItem[] = degreeUploads.map(d => ({
        type: d.type as 'coaching' | 'other',
        degreeLevel: d.degreeLevel as any,
        degreeName: d.degreeName,
        file_id: d.file_id
      }))

      // Convert field experiences to API format
      const fieldExpForApi: Record<string, FieldExperience> = {}
      fieldExperiences.forEach(exp => {
        fieldExpForApi[exp.field] = {
          coaching_history: exp.coaching_history,
          certifications: exp.certifications,
          historyFiles: [],
          certFiles: []
        }
      })

      // Call API to save
      await profileService.updateDetailedProfile({
        total_coaching_hours: values.total_coaching_hours,
        coaching_years: values.coaching_years,
        specialty: values.specialty,
        degrees: degreesForApi,
        field_experiences: fieldExpForApi
      })

      message.success('역량 정보가 저장되었습니다!')
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Save failed:', error)
      message.error(error.response?.data?.detail || '역량 정보 저장에 실패했습니다.')
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
    const newExperiences: FieldExperienceUI[] = values.map(field => {
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

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 flex items-center justify-center">
        <Spin size="large" tip="프로필 로딩 중..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <Card className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <Title level={2} className="text-center mb-2">
              역량 정보 관리
            </Title>
            <Text className="block text-center text-gray-600">
              입력된 정보는 과제 지원 시 자동으로 활용됩니다.
            </Text>
          </div>
        </div>

        <Form
          form={form}
          name="detailed_profile"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          {/* Coaching years */}
          <Form.Item
            label="총 코칭 경력 (년)"
            name="coaching_years"
          >
            <InputNumber
              min={0}
              max={50}
              className="w-full"
              placeholder="년 단위로 입력"
              addonAfter="년"
            />
          </Form.Item>

          {/* Total coaching hours */}
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

          {/* Specialty */}
          <Form.Item
            label="전문 분야"
            name="specialty"
          >
            <Input
              placeholder="예: 리더십 코칭, 커리어 전환, 팀 코칭 등"
            />
          </Form.Item>

          <Divider />

          {/* Degrees */}
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

          {/* Field experiences */}
          <Form.Item
            label="코칭 분야별 이력 (복수 선택 가능)"
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

              {/* Coaching history */}
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

              {/* Certifications */}
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
                저장하기
              </Button>
            </Form.Item>

            <Form.Item className="flex-1 mb-0">
              <Button
                type="default"
                onClick={() => navigate('/dashboard')}
                className="w-full"
                size="large"
              >
                취소
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Card>
    </div>
  )
}
