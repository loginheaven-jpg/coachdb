import { useState, useEffect } from 'react'
import { Card, Typography, InputNumber, Button, Space, message, Spin, Descriptions, Alert } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import adminService, { SystemConfig, CONFIG_KEYS } from '../services/adminService'

const { Title, Text } = Typography

export default function SystemSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifierCount, setVerifierCount] = useState<number>(2)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // 설정 불러오기
  const loadSettings = async () => {
    setLoading(true)
    try {
      const config = await adminService.getConfig(CONFIG_KEYS.REQUIRED_VERIFIER_COUNT)
      setVerifierCount(parseInt(config.value, 10) || 2)
      setLastUpdated(config.updated_at)
    } catch (error: any) {
      // 설정이 없으면 기본값 사용
      if (error.response?.status === 404) {
        setVerifierCount(2)
        setLastUpdated(null)
      } else {
        console.error('설정 로드 실패:', error)
        message.error('설정을 불러오는데 실패했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // 설정 저장
  const handleSave = async () => {
    if (verifierCount < 1 || verifierCount > 10) {
      message.error('Verifier 인원수는 1~10 사이여야 합니다.')
      return
    }

    setSaving(true)
    try {
      await adminService.updateConfig(CONFIG_KEYS.REQUIRED_VERIFIER_COUNT, verifierCount.toString())
      message.success('설정이 저장되었습니다.')
      await loadSettings() // 최신 정보 다시 로드
    } catch (error) {
      console.error('설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-64">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className={embedded ? 'p-2' : 'p-6'}>
      {!embedded && <Title level={3} className="mb-6">시스템 설정</Title>}

      <Card title="증빙검토 설정" className="mb-4">
        <Alert
          message="증빙 확정에 필요한 Verifier 인원수"
          description="코치의 역량정보(증빙) 또는 지원서 항목이 승인되려면 몇 명의 Verifier가 컨펌해야 하는지 설정합니다. 기본값은 2명입니다."
          type="info"
          showIcon
          className="mb-4"
        />

        <Descriptions column={1} bordered>
          <Descriptions.Item label="필요 Verifier 인원수">
            <Space>
              <InputNumber
                min={1}
                max={10}
                value={verifierCount}
                onChange={(value) => setVerifierCount(value || 2)}
                style={{ width: 100 }}
              />
              <Text type="secondary">명</Text>
            </Space>
          </Descriptions.Item>
          {lastUpdated && (
            <Descriptions.Item label="마지막 수정">
              <Text type="secondary">
                {new Date(lastUpdated).toLocaleString('ko-KR')}
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        <div className="mt-4 flex justify-end">
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSettings}
            >
              새로고침
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              저장
            </Button>
          </Space>
        </div>
      </Card>

      <Card title="설정 안내" size="small">
        <ul className="list-disc pl-5 space-y-2 text-gray-600">
          <li>
            <strong>Verifier 인원수</strong>: 증빙서류가 정식으로 승인되기 위해 필요한 최소 컨펌 수입니다.
          </li>
          <li>
            예: 2명으로 설정하면, 2명의 Verifier가 모두 컨펌해야 증빙이 "확정완료" 상태가 됩니다.
          </li>
          <li>
            설정 변경은 즉시 적용되며, 이후 모든 증빙검토에 적용됩니다.
          </li>
        </ul>
      </Card>
    </div>
  )
}
