/**
 * 브라우저의 기본 파일 드롭 동작을 방지하는 훅
 *
 * 파일을 드래그해서 페이지에 드롭할 때 브라우저가 파일을 열어버리는 것을 방지합니다.
 * Upload 컴포넌트가 있는 페이지에서 사용하세요.
 */
import { useEffect } from 'react'

export default function usePreventFileDrop() {
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      // Upload.Dragger 영역이 아닌 경우에만 기본 동작 방지
      const target = e.target as HTMLElement
      const isUploadArea =
        target.closest('.ant-upload') ||
        target.closest('.ant-upload-drag') ||
        target.closest('[data-allow-drop="true"]')

      if (!isUploadArea) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventDropDefault = (e: DragEvent) => {
      const target = e.target as HTMLElement
      const isUploadArea =
        target.closest('.ant-upload') ||
        target.closest('.ant-upload-drag') ||
        target.closest('[data-allow-drop="true"]')

      if (!isUploadArea) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // 문서 전체에 이벤트 리스너 추가
    document.addEventListener('dragenter', preventDefault, true)
    document.addEventListener('dragover', preventDefault, true)
    document.addEventListener('dragleave', preventDefault, true)
    document.addEventListener('drop', preventDropDefault, true)

    return () => {
      document.removeEventListener('dragenter', preventDefault, true)
      document.removeEventListener('dragover', preventDefault, true)
      document.removeEventListener('dragleave', preventDefault, true)
      document.removeEventListener('drop', preventDropDefault, true)
    }
  }, [])
}
