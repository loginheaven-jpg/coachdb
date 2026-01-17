import { Alert } from 'antd'
import { useProjectEdit } from '../../contexts/ProjectEditContext'
import SurveyBuilder from '../../components/SurveyBuilder'

export default function ProjectSurveyTab() {
  const {
    projectId,
    isCreateMode,
    scoreValidation,
    loadScoreValidation
  } = useProjectEdit()

  // 생성 모드에서는 먼저 과제를 저장해야 함
  if (isCreateMode || !projectId) {
    return (
      <Alert
        type="info"
        message="먼저 과제 정보를 저장해주세요"
        description="설문항목을 구성하려면 먼저 '과제정보' 탭에서 기본 정보를 입력하고 임시저장해주세요."
        showIcon
      />
    )
  }

  return (
    <div>
      {/* 점수 상태 안내 */}
      {scoreValidation && !scoreValidation.is_valid && (
        <Alert
          type="warning"
          message={`설문 점수: ${scoreValidation.total_score}/100점`}
          description="생성완료를 하려면 설문항목 배점의 합이 100점이어야 합니다."
          showIcon
          className="mb-4"
        />
      )}

      {/* SurveyBuilder */}
      <SurveyBuilder
        projectId={projectId}
        embedded={true}
        onSave={() => {
          loadScoreValidation()
        }}
      />
    </div>
  )
}
