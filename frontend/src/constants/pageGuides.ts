export interface GuideContent {
  id: string
  title?: string
  message: string
  type?: 'info' | 'warning' | 'success'
}

export const PAGE_GUIDES = {
  PROJECT_EDIT: {
    id: 'project-edit',
    title: '과제 입력 안내',
    message: "과제는 '과제정보'와 '설문항목'으로 구성되며, 두 가지 모두 입력되어야 정식저장이 가능합니다.",
    type: 'info' as const
  },
  PROJECT_CREATE: {
    id: 'project-create',
    title: '새 과제 생성 안내',
    message: "과제 생성 후 수정 화면에서 설문항목을 구성할 수 있습니다. 설문 배점이 100점이어야 정식저장이 가능합니다.",
    type: 'info' as const
  },
  SURVEY_BUILDER: {
    id: 'survey-builder',
    title: '설문 구성 안내',
    message: "각 항목의 배점을 설정하여 총 합계가 100점이 되도록 구성해주세요.",
    type: 'info' as const
  }
}
