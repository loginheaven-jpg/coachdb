/**
 * 등급 템플릿 정의
 * 항목 유형별로 미리 정의된 기본 설정
 */

import {
  GradeType,
  GradeMapping,
  MatchingType,
  ValueSource,
  AggregationMode,
  ProofRequiredLevel
} from '../types/scoring'

export interface GradeTemplate {
  id: string
  name: string
  description: string
  gradeType: GradeType
  matchingType: MatchingType
  valueSource: ValueSource
  sourceField?: string        // USER_FIELD, JSON_FIELD인 경우 필드명
  aggregationMode: AggregationMode
  defaultMappings: GradeMapping[]

  // 템플릿 특성
  fixedGrades: boolean        // 등급 목록 고정 (점수만 수정 가능)
  allowAddGrades: boolean     // 사용자가 등급 추가 가능
  proofRequired: ProofRequiredLevel
  verificationNote?: string   // 검증 안내 메시지

  // 항목 설정
  isRequired?: boolean        // 필수 입력 여부
  allowMultiple?: boolean     // 복수 항목 입력 가능 여부

  // 자동 적용 조건
  keywords: string[]          // 항목명에 포함되면 자동 제안
}

/**
 * 템플릿 1: 코칭관련자격증
 * - 기본정보의 코치인증번호를 자동 조회
 * - KSC, KAC, KPC, 무자격 4등급 고정
 * - 사용자는 각 등급별 점수만 입력
 * - 증빙: 선택
 */
export const TEMPLATE_KCA_CERTIFICATION: GradeTemplate = {
  id: 'kca_certification',
  name: '코칭관련자격증 (KCA)',
  description: '기본정보의 코치인증번호를 자동 조회합니다',
  gradeType: GradeType.STRING,
  matchingType: MatchingType.GRADE,
  valueSource: ValueSource.USER_FIELD,
  sourceField: 'kca_certification_level',  // 사용자 기본정보 필드
  aggregationMode: AggregationMode.BEST_MATCH,
  defaultMappings: [
    { value: 'KSC', score: 40, label: 'KSC (수석코치)', fixed: true },
    { value: 'KAC', score: 30, label: 'KAC (전문코치)', fixed: true },
    { value: 'KPC', score: 20, label: 'KPC (전문코치)', fixed: true },
    { value: '무자격', score: 0, label: '무자격', fixed: true }
  ],
  fixedGrades: true,
  allowAddGrades: false,
  proofRequired: ProofRequiredLevel.OPTIONAL,
  isRequired: false,  // 필수 입력 아님 (선택)
  allowMultiple: false,  // 단일 값만 입력 (기본정보에서 자동 조회)
  verificationNote: '기본정보에 등록된 코치인증번호가 자동으로 조회됩니다',
  keywords: ['kca', '코칭', '자격증', '인증']
}

/**
 * 템플릿 2-A: 상담/심리치료관련자격 (이름 기준)
 * - 자격증 이름으로 등급 부여
 * - 예: '임상심리사' 포함 여부로 판정
 * - 증빙: 필수
 * - 사용자가 자격증명 추가 가능
 */
export const TEMPLATE_COUNSELING_BY_NAME: GradeTemplate = {
  id: 'counseling_by_name',
  name: '상담/심리치료관련자격 (이름 기준)',
  description: '자격증 이름으로 등급을 설정합니다 (예: "임상심리사" 포함 시)',
  gradeType: GradeType.STRING,
  matchingType: MatchingType.CONTAINS,
  valueSource: ValueSource.SUBMITTED,
  aggregationMode: AggregationMode.BEST_MATCH,
  defaultMappings: [
    { value: '임상심리사', score: 30, label: '"임상심리사" 포함' },
    { value: '상담심리사', score: 20, label: '"상담심리사" 포함' }
  ],
  fixedGrades: false,
  allowAddGrades: true,
  proofRequired: ProofRequiredLevel.REQUIRED,
  isRequired: false,  // 필수 입력 아님 (선택)
  allowMultiple: true,  // 복수 자격증 입력 가능
  verificationNote: '자격증 적합성은 검토자가 증빙을 확인하여 판단합니다',
  keywords: ['상담', '심리', '치료', '심리치료']
}

/**
 * 템플릿 2-B: 상담/심리치료관련자격 (유무 기준)
 * - 증빙 파일 유무로 점수 부여
 * - 증빙 컨펌되면 무조건 점수
 * - 유자격/무자격 2등급 고정
 * - 증빙: 필수
 */
export const TEMPLATE_COUNSELING_BY_EXISTS: GradeTemplate = {
  id: 'counseling_by_exists',
  name: '상담/심리치료관련자격 (유무 기준)',
  description: '자격증 유무로 등급을 설정합니다 (증빙 확인 후 점수 부여)',
  gradeType: GradeType.FILE_EXISTS,
  matchingType: MatchingType.EXACT,
  valueSource: ValueSource.SUBMITTED,
  aggregationMode: AggregationMode.FIRST,
  defaultMappings: [
    { value: 'true', score: 20, label: '유자격 (증빙 확인)', fixed: true },
    { value: 'false', score: 0, label: '무자격', fixed: true }
  ],
  fixedGrades: true,
  allowAddGrades: false,
  proofRequired: ProofRequiredLevel.REQUIRED,
  isRequired: false,  // 필수 입력 아님 (선택)
  allowMultiple: false,  // 단일 값만 (유무 판정)
  verificationNote: '의미있는 자격증 적합성 기준은 과제관리자가 설정하고 확인은 검토자가 진행합니다',
  keywords: ['상담', '심리', '치료', '심리치료']
}

/**
 * 템플릿 3-A: 기타 자격증 (이름 기준)
 * - 템플릿 2-A와 동일 구조
 */
export const TEMPLATE_OTHER_BY_NAME: GradeTemplate = {
  id: 'other_by_name',
  name: '기타 자격증 (이름 기준)',
  description: '자격증 이름으로 등급을 설정합니다',
  gradeType: GradeType.STRING,
  matchingType: MatchingType.CONTAINS,
  valueSource: ValueSource.SUBMITTED,
  aggregationMode: AggregationMode.BEST_MATCH,
  defaultMappings: [
    { value: '', score: 20, label: '특정 자격증명 입력' }
  ],
  fixedGrades: false,
  allowAddGrades: true,
  proofRequired: ProofRequiredLevel.REQUIRED,
  isRequired: false,  // 필수 입력 아님 (선택)
  allowMultiple: true,  // 복수 자격증 입력 가능
  verificationNote: '자격증 적합성은 검토자가 증빙을 확인하여 판단합니다',
  keywords: ['기타', '자격']
}

/**
 * 템플릿 3-B: 기타 자격증 (유무 기준)
 * - 템플릿 2-B와 동일 구조
 */
export const TEMPLATE_OTHER_BY_EXISTS: GradeTemplate = {
  id: 'other_by_exists',
  name: '기타 자격증 (유무 기준)',
  description: '자격증 유무로 등급을 설정합니다',
  gradeType: GradeType.FILE_EXISTS,
  matchingType: MatchingType.EXACT,
  valueSource: ValueSource.SUBMITTED,
  aggregationMode: AggregationMode.FIRST,
  defaultMappings: [
    { value: 'true', score: 20, label: '유자격 (증빙 확인)', fixed: true },
    { value: 'false', score: 0, label: '무자격', fixed: true }
  ],
  fixedGrades: true,
  allowAddGrades: false,
  proofRequired: ProofRequiredLevel.REQUIRED,
  isRequired: false,  // 필수 입력 아님 (선택)
  allowMultiple: false,  // 단일 값만 (유무 판정)
  verificationNote: '자격증 적합성은 검토자가 증빙을 확인하여 판단합니다',
  keywords: ['기타', '자격']
}

/**
 * 추가 템플릿: 코칭 경력 시간
 */
export const TEMPLATE_COACHING_HOURS: GradeTemplate = {
  id: 'coaching_hours',
  name: '코칭 경력 시간',
  description: '시간 범위별로 점수를 부여합니다',
  gradeType: GradeType.NUMERIC,
  matchingType: MatchingType.RANGE,
  valueSource: ValueSource.SUBMITTED,
  aggregationMode: AggregationMode.SUM,
  defaultMappings: [
    { value: 1000, score: 30, label: '1000시간 이상' },
    { value: 500, score: 20, label: '500-999시간' },
    { value: 100, score: 10, label: '100-499시간' }
  ],
  fixedGrades: false,
  allowAddGrades: true,
  proofRequired: ProofRequiredLevel.OPTIONAL,
  isRequired: false,  // 필수 입력 아님 (선택)
  allowMultiple: true,  // 복수 경력 입력 가능 (합산)
  keywords: ['경력', '시간', 'hour']
}

/**
 * 추가 템플릿: 학위
 */
export const TEMPLATE_DEGREE: GradeTemplate = {
  id: 'degree',
  name: '학위',
  description: '학위별로 점수를 부여합니다',
  gradeType: GradeType.STRING,
  matchingType: MatchingType.GRADE,
  valueSource: ValueSource.SUBMITTED,
  aggregationMode: AggregationMode.BEST_MATCH,
  defaultMappings: [
    { value: '박사', score: 30, label: '박사' },
    { value: '석사', score: 20, label: '석사' },
    { value: '학사', score: 10, label: '학사' }
  ],
  fixedGrades: false,
  allowAddGrades: true,
  proofRequired: ProofRequiredLevel.REQUIRED,
  isRequired: false,  // 필수 입력 아님 (선택)
  allowMultiple: true,  // 복수 학위 입력 가능 (최고점수만 적용)
  keywords: ['학위', '학력', 'degree', '박사', '석사', '학사']
}

/**
 * 모든 템플릿 목록
 */
export const ALL_TEMPLATES: GradeTemplate[] = [
  TEMPLATE_KCA_CERTIFICATION,
  TEMPLATE_COUNSELING_BY_NAME,
  TEMPLATE_COUNSELING_BY_EXISTS,
  TEMPLATE_OTHER_BY_NAME,
  TEMPLATE_OTHER_BY_EXISTS,
  TEMPLATE_COACHING_HOURS,
  TEMPLATE_DEGREE
]

/**
 * 항목명으로 적합한 템플릿 찾기
 */
export function findTemplateByItemName(itemName: string): GradeTemplate | null {
  const name = itemName.toLowerCase()

  for (const template of ALL_TEMPLATES) {
    for (const keyword of template.keywords) {
      if (name.includes(keyword.toLowerCase())) {
        return template
      }
    }
  }

  return null
}

/**
 * 템플릿 ID로 템플릿 가져오기
 */
export function getTemplateById(id: string): GradeTemplate | null {
  return ALL_TEMPLATES.find(t => t.id === id) || null
}

/**
 * 특정 항목에 사용 가능한 템플릿 목록 반환
 */
export function getSuggestedTemplates(itemName: string): GradeTemplate[] {
  const name = itemName.toLowerCase()
  const suggestions: GradeTemplate[] = []

  // 정확히 매칭되는 템플릿 찾기
  for (const template of ALL_TEMPLATES) {
    for (const keyword of template.keywords) {
      if (name.includes(keyword.toLowerCase())) {
        suggestions.push(template)
        break
      }
    }
  }

  return suggestions
}

/**
 * 카테고리별 템플릿 그룹
 */
export const TEMPLATE_CATEGORIES = {
  coaching: {
    name: '코칭 관련',
    templates: [TEMPLATE_KCA_CERTIFICATION, TEMPLATE_COACHING_HOURS]
  },
  counseling: {
    name: '상담/심리치료 관련',
    templates: [TEMPLATE_COUNSELING_BY_NAME, TEMPLATE_COUNSELING_BY_EXISTS]
  },
  other: {
    name: '기타 자격증',
    templates: [TEMPLATE_OTHER_BY_NAME, TEMPLATE_OTHER_BY_EXISTS]
  },
  education: {
    name: '학력',
    templates: [TEMPLATE_DEGREE]
  }
}
