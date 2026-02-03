import { Modal } from 'antd'
import { useNavigate } from 'react-router-dom'

export function showWizardSelectionModal() {
  const navigate = useNavigate()

  Modal.confirm({
    title: '과제 생성 방식 선택',
    width: 500,
    content: (
      <div style={{ padding: '16px 0' }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
            🧙 위저드 방식
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#8c8c8c' }}>
            단계별 안내를 따라 쉽게 생성 (초보자 추천)
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
            ⚙️ 직접 설정
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#8c8c8c' }}>
            모든 옵션을 직접 제어 (숙련자용)
          </p>
        </div>
      </div>
    ),
    okText: '🧙 위저드 사용',
    cancelText: '⚙️ 직접 설정',
    onOk: () => {
      // useNavigate는 컴포넌트 내에서만 사용 가능하므로 window.location 사용
      window.location.href = '/projects/wizard'
    },
    onCancel: () => {
      window.location.href = '/projects/new'
    }
  })
}

// Hook 버전 (컴포넌트 내에서 사용)
export function useWizardSelectionModal() {
  const navigate = useNavigate()

  return () => {
    Modal.confirm({
      title: '과제 생성 방식 선택',
      width: 500,
      content: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
              🧙 위저드 방식
            </p>
            <p style={{ margin: '4px 0 0 0', color: '#8c8c8c' }}>
              단계별 안내를 따라 쉽게 생성 (초보자 추천)
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
              ⚙️ 직접 설정
            </p>
            <p style={{ margin: '4px 0 0 0', color: '#8c8c8c' }}>
              모든 옵션을 직접 제어 (숙련자용)
            </p>
          </div>
        </div>
      ),
      okText: '🧙 위저드 사용',
      cancelText: '⚙️ 직접 설정',
      onOk: () => {
        navigate('/projects/wizard')
      },
      onCancel: () => {
        navigate('/projects/new')
      }
    })
  }
}
