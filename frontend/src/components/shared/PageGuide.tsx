import { useState, useEffect } from 'react'
import { Alert, Button, Space } from 'antd'
import { EyeInvisibleOutlined, BulbOutlined } from '@ant-design/icons'

interface PageGuideProps {
  guideId: string
  title?: string
  message: string | React.ReactNode
  type?: 'info' | 'warning' | 'success'
  className?: string
}

const STORAGE_KEY_PREFIX = 'pageGuide_dismissed_'

export default function PageGuide({
  guideId,
  title,
  message,
  type = 'info',
  className = ''
}: PageGuideProps) {
  const [visible, setVisible] = useState(false)

  const storageKey = `${STORAGE_KEY_PREFIX}${guideId}`

  useEffect(() => {
    const isDismissed = localStorage.getItem(storageKey) === 'true'
    setVisible(!isDismissed)
  }, [storageKey])

  const handleClose = () => {
    setVisible(false)
  }

  const handleDontShowAgain = () => {
    localStorage.setItem(storageKey, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <Alert
      className={className}
      type={type}
      showIcon
      icon={<BulbOutlined />}
      message={
        <div className="flex justify-between items-start">
          <div>
            {title && <strong className="block mb-1">{title}</strong>}
            <span>{message}</span>
          </div>
        </div>
      }
      action={
        <Space direction="vertical" size="small">
          <Button
            size="small"
            type="text"
            icon={<EyeInvisibleOutlined />}
            onClick={handleDontShowAgain}
            style={{ fontSize: '12px', color: '#666' }}
          >
            다시 보지 않기
          </Button>
        </Space>
      }
      closable
      onClose={handleClose}
      style={{
        marginBottom: '16px',
        borderRadius: '8px',
        backgroundColor: '#e6f7ff',
        border: '1px solid #91d5ff'
      }}
    />
  )
}

// 개발/테스트용: 모든 가이드 상태 초기화
export function resetAllGuides() {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key)
    }
  })
}
