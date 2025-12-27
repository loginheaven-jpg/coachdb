import { useState, useEffect } from 'react'
import { Modal, Spin, Button, Space, message, Typography } from 'antd'
import { DownloadOutlined, FileOutlined, FilePdfOutlined, FileImageOutlined } from '@ant-design/icons'
import fileService from '../services/fileService'
import api from '../services/api'

const { Text } = Typography

interface FilePreviewModalProps {
  visible: boolean
  fileId: number | null
  filename: string
  onClose: () => void
}

export default function FilePreviewModal({
  visible,
  fileId,
  filename,
  onClose
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPresignedUrl, setIsPresignedUrl] = useState(false)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  useEffect(() => {
    if (visible && fileId) {
      loadFile()
    }
    return () => {
      // Cleanup object URL when modal closes (only for blob URLs, not presigned URLs)
      if (fileUrl && !isPresignedUrl) {
        URL.revokeObjectURL(fileUrl)
      }
      setFileUrl(null)
      setIsPresignedUrl(false)
      setImageLoadFailed(false)
    }
  }, [visible, fileId])

  const loadFile = async (forceBlob = false) => {
    if (!fileId) return

    setLoading(true)
    setError(null)
    setFileUrl(null)
    setIsPresignedUrl(false)
    setImageLoadFailed(false)

    try {
      // First try to get presigned URL (for cloud storage), unless forcing blob
      if (!forceBlob) {
        try {
          const response = await api.get(`/files/${fileId}/download-url`)
          if (response.data?.download_url) {
            setFileUrl(response.data.download_url)
            setIsPresignedUrl(true)
            // Infer mime type from filename
            const ext = filename.toLowerCase().split('.').pop()
            if (ext === 'pdf') {
              setMimeType('application/pdf')
            } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
              setMimeType(`image/${ext === 'jpg' ? 'jpeg' : ext}`)
            } else {
              setMimeType('application/octet-stream')
            }
            setLoading(false)
            return
          }
        } catch {
          // Presigned URL not available, fall back to blob download
        }
      }

      // Fall back to blob download
      const blob = await fileService.downloadFile(fileId)
      const url = URL.createObjectURL(blob)
      setFileUrl(url)
      setIsPresignedUrl(false)
      setMimeType(blob.type || 'application/octet-stream')
    } catch (err: any) {
      console.error('파일 로드 실패:', err)
      setError('파일을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Handle image load error - fall back to blob download
  const handleImageError = () => {
    if (isPresignedUrl && !imageLoadFailed) {
      console.log('Presigned URL 이미지 로딩 실패, blob fallback 시도')
      setImageLoadFailed(true)
      loadFile(true) // Force blob download
    }
  }

  const handleDownload = async () => {
    if (!fileId) return
    try {
      await fileService.downloadAndSave(fileId, filename)
      message.success('파일 다운로드 완료')
    } catch (err) {
      message.error('파일 다운로드 실패')
    }
  }

  const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')
  const isImage = mimeType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => filename.toLowerCase().endsWith(`.${ext}`))

  const getFileIcon = () => {
    if (isPdf) return <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
    if (isImage) return <FileImageOutlined style={{ fontSize: 48, color: '#1890ff' }} />
    return <FileOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="파일 로딩 중..." />
        </div>
      )
    }

    if (error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          {getFileIcon()}
          <Text type="danger" style={{ marginTop: 16 }}>{error}</Text>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} style={{ marginTop: 16 }}>
            다운로드로 열기
          </Button>
        </div>
      )
    }

    if (!fileUrl) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Text type="secondary">파일을 불러오는 중...</Text>
        </div>
      )
    }

    // PDF Preview
    if (isPdf) {
      return (
        <iframe
          src={fileUrl}
          style={{ width: '100%', height: '70vh', border: 'none' }}
          title={filename}
          onError={handleImageError}
        />
      )
    }

    // Image Preview
    if (isImage) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16, maxHeight: '70vh', overflow: 'auto' }}>
          <img
            src={fileUrl}
            alt={filename}
            style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
            onError={handleImageError}
          />
        </div>
      )
    }

    // Unsupported file type
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        {getFileIcon()}
        <Text style={{ marginTop: 16 }}>미리보기를 지원하지 않는 파일 형식입니다.</Text>
        <Text type="secondary" style={{ marginTop: 8 }}>{filename}</Text>
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} style={{ marginTop: 16 }}>
          다운로드
        </Button>
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          {getFileIcon()}
          <span style={{ marginLeft: 8 }}>{filename}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="download" icon={<DownloadOutlined />} onClick={handleDownload}>
          다운로드
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          닫기
        </Button>
      ]}
      destroyOnClose
    >
      {renderContent()}
    </Modal>
  )
}

// Helper hook for file preview
export function useFilePreview() {
  const [previewState, setPreviewState] = useState<{
    visible: boolean
    fileId: number | null
    filename: string
  }>({
    visible: false,
    fileId: null,
    filename: ''
  })

  const openPreview = (fileId: number, filename: string) => {
    setPreviewState({
      visible: true,
      fileId,
      filename
    })
  }

  const closePreview = () => {
    setPreviewState({
      visible: false,
      fileId: null,
      filename: ''
    })
  }

  return {
    previewState,
    openPreview,
    closePreview
  }
}
