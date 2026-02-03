import { useState } from 'react'

export interface WizardState {
  currentStep: number
  referenceProjectId: number | null

  // Step 2: Basic Info
  projectName: string
  projectType: string
  supportProgramName: string
  description: string
  recruitmentStartDate: string
  recruitmentEndDate: string
  maxParticipants: number
  projectStartDate: string
  projectEndDate: string

  // Step 3: Item Selection
  selectedItemIds: number[]

  // Step 4: Scoring
  scoreAllocation: Record<number, number>
  autoDistribute: boolean

  // Step 5: Reviewers
  selectedReviewerIds: number[]
}

export interface WizardActions {
  nextStep: () => void
  prevStep: () => void
  setReferenceProject: (projectId: number | null) => void
  updateProjectInfo: (data: Partial<WizardState>) => void
  toggleItem: (itemId: number) => void
  updateScore: (itemId: number, score: number) => void
  autoDistributeScores: () => void
  addReviewer: (userId: number) => void
  removeReviewer: (userId: number) => void
  reset: () => void
  canProceed: () => boolean
}

const initialState: WizardState = {
  currentStep: 1,
  referenceProjectId: null,
  projectName: '',
  projectType: '',
  supportProgramName: '',
  description: '',
  recruitmentStartDate: '',
  recruitmentEndDate: '',
  maxParticipants: 10,
  projectStartDate: '',
  projectEndDate: '',
  selectedItemIds: [],
  scoreAllocation: {},
  autoDistribute: true,
  selectedReviewerIds: []
}

export function useWizardState() {
  const [state, setState] = useState<WizardState>(initialState)

  const actions: WizardActions = {
    nextStep: () => {
      if (state.currentStep < 6) {
        setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }))
      }
    },

    prevStep: () => {
      if (state.currentStep > 1) {
        setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }))
      }
    },

    setReferenceProject: (projectId: number | null) => {
      setState(prev => ({ ...prev, referenceProjectId: projectId }))
    },

    updateProjectInfo: (data: Partial<WizardState>) => {
      setState(prev => ({ ...prev, ...data }))
    },

    toggleItem: (itemId: number) => {
      setState(prev => {
        const selectedItemIds = prev.selectedItemIds.includes(itemId)
          ? prev.selectedItemIds.filter(id => id !== itemId)
          : [...prev.selectedItemIds, itemId]
        return { ...prev, selectedItemIds }
      })
    },

    updateScore: (itemId: number, score: number) => {
      setState(prev => ({
        ...prev,
        scoreAllocation: {
          ...prev.scoreAllocation,
          [itemId]: score
        }
      }))
    },

    autoDistributeScores: () => {
      setState(prev => {
        const selectedItems = prev.selectedItemIds
        const totalScore = 100

        // 고정 배점이 있는 항목 제외
        const fixedItems = selectedItems.filter(id => prev.scoreAllocation[id] !== undefined)
        const fixedTotal = fixedItems.reduce((sum, id) => sum + (prev.scoreAllocation[id] || 0), 0)

        // 나머지 항목에 균등 분배
        const remainingItems = selectedItems.filter(id => !fixedItems.includes(id))
        const remainingScore = totalScore - fixedTotal
        const scorePerItem = Math.floor(remainingScore / remainingItems.length)

        // 반올림 오차 처리
        const newAllocation = { ...prev.scoreAllocation }
        remainingItems.forEach((id, index) => {
          if (index === remainingItems.length - 1) {
            // 마지막 항목에 오차 보정
            newAllocation[id] = remainingScore - (scorePerItem * (remainingItems.length - 1))
          } else {
            newAllocation[id] = scorePerItem
          }
        })

        return { ...prev, scoreAllocation: newAllocation }
      })
    },

    addReviewer: (userId: number) => {
      setState(prev => ({
        ...prev,
        selectedReviewerIds: [...prev.selectedReviewerIds, userId]
      }))
    },

    removeReviewer: (userId: number) => {
      setState(prev => ({
        ...prev,
        selectedReviewerIds: prev.selectedReviewerIds.filter(id => id !== userId)
      }))
    },

    reset: () => {
      setState(initialState)
    },

    canProceed: () => {
      // Step별 진행 가능 여부 검증
      const totalScore = Object.values(state.scoreAllocation).reduce((sum, score) => sum + score, 0)

      switch (state.currentStep) {
        case 1:
          return true // 참고 과제는 선택 사항
        case 2:
          return !!(state.projectName && state.recruitmentStartDate && state.recruitmentEndDate && state.maxParticipants > 0)
        case 3:
          // 항목 선택 + 배점 설정 (총 100점)
          return state.selectedItemIds.length > 0 && totalScore === 100
        case 4:
          // Step 4는 이제 상세 설정 단계이므로 항상 진행 가능
          return true
        case 5:
          return state.selectedReviewerIds.length >= 2
        case 6:
          return true
        default:
          return false
      }
    }
  }

  return { state, actions }
}
