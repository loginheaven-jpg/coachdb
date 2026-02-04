/**
 * 등급 설정 타입 정의
 * 위저드 Step4와 SurveyBuilder에서 공통으로 사용
 */

// 등급 유형
export enum GradeType {
  STRING = 'string',           // 문자열 (예: KSC, KAC, KPC)
  NUMERIC = 'numeric',         // 숫자 (예: 점수, 시간)
  FILE_EXISTS = 'file_exists', // 파일 유무
  MULTI_SELECT = 'multi_select' // 복수 선택
}

// 값을 가져올 위치
export enum ValueSource {
  SUBMITTED = 'SUBMITTED',     // 제출된 값 (기본)
  USER_FIELD = 'USER_FIELD',   // 사용자 기본정보 필드 (예: kca_certification_level)
  JSON_FIELD = 'JSON_FIELD'    // JSON 필드 (고급 설정)
}

// 복수입력 집계 방식
export enum AggregationMode {
  // 문자열 타입용
  ANY_MATCH = 'ANY_MATCH',       // 하나라도 일치
  FIRST = 'FIRST',               // 첫 번째 값만

  // 숫자 타입용
  SUM = 'SUM',                   // 합계
  MAX = 'MAX',                   // 최대값 (숫자 자체)
  COUNT = 'COUNT',               // 개수
  BEST_MATCH = 'BEST_MATCH'      // 가장 높은 점수 (등급별 점수 중 최대)
}

// 매칭 방식
export enum MatchingType {
  EXACT = 'EXACT',       // 정확한 일치
  CONTAINS = 'CONTAINS', // 포함 여부
  RANGE = 'RANGE',       // 범위 매칭
  GRADE = 'GRADE'        // 등급별 점수
}

// 증빙 필수 수준
export enum ProofRequiredLevel {
  NOT_REQUIRED = 'NOT_REQUIRED',
  OPTIONAL = 'OPTIONAL',
  REQUIRED = 'REQUIRED'
}

// 등급 매핑 (각 항목의 점수 매핑)
export interface GradeMapping {
  value: string | number  // 등급 값 (예: "KSC", 1000)
  score: number          // 배점
  label?: string         // 표시명 (선택)
  fixed?: boolean        // 고정 등급 (사용자가 삭제/수정 불가)
}

// 통합 Scoring Config (WizardState에 저장될 구조)
export interface ScoringConfig {
  itemId: number
  matchingType: MatchingType
  gradeType?: GradeType  // GRADE인 경우에만 사용
  valueSource?: ValueSource
  sourceField?: string  // USER_FIELD, JSON_FIELD인 경우
  extractPattern?: string  // JSON 추출 패턴
  aggregationMode?: AggregationMode
  gradeMappings?: GradeMapping[]  // 등급별 점수 매핑
  configured: boolean  // 설정 완료 여부

  // 템플릿 관련
  fixedGrades?: boolean  // 등급 목록 고정 여부 (점수만 수정 가능)
  allowAddGrades?: boolean  // 사용자가 등급 추가 가능 여부
  proofRequired?: ProofRequiredLevel  // 증빙 필수 수준
  verificationNote?: string  // 검증 안내 메시지
}

// ScoringCriteria (API 전송용)
export interface ScoringCriteria {
  matching_type: string
  expected_value: string | null
  score: number
  value_source?: string
  source_field?: string
  extract_pattern?: string
  aggregation_mode?: string
}

// 등급 유형별 사용 가능한 매칭 방식
export const MATCHING_TYPES_BY_GRADE: Record<GradeType, MatchingType[]> = {
  [GradeType.STRING]: [MatchingType.EXACT, MatchingType.CONTAINS, MatchingType.GRADE],
  [GradeType.NUMERIC]: [MatchingType.RANGE, MatchingType.GRADE],
  [GradeType.FILE_EXISTS]: [MatchingType.EXACT],
  [GradeType.MULTI_SELECT]: [MatchingType.EXACT, MatchingType.GRADE]
}

// 등급 유형별 사용 가능한 집계 방식
export const AGGREGATION_MODES_BY_GRADE: Record<GradeType, AggregationMode[]> = {
  [GradeType.STRING]: [AggregationMode.ANY_MATCH, AggregationMode.FIRST, AggregationMode.BEST_MATCH],
  [GradeType.NUMERIC]: [AggregationMode.SUM, AggregationMode.MAX, AggregationMode.COUNT, AggregationMode.BEST_MATCH],
  [GradeType.FILE_EXISTS]: [AggregationMode.FIRST],
  [GradeType.MULTI_SELECT]: [AggregationMode.ANY_MATCH, AggregationMode.COUNT, AggregationMode.BEST_MATCH]
}

// 집계 방식 설명
export const AGGREGATION_MODE_DESCRIPTIONS: Record<AggregationMode, string> = {
  [AggregationMode.ANY_MATCH]: '하나라도 일치하면 해당 점수 부여',
  [AggregationMode.FIRST]: '첫 번째 값만 사용',
  [AggregationMode.SUM]: '모든 값을 합산',
  [AggregationMode.MAX]: '가장 큰 숫자 값 사용',
  [AggregationMode.COUNT]: '개수만큼 점수 부여',
  [AggregationMode.BEST_MATCH]: '등급별 점수 중 가장 높은 점수 부여'
}

// 매칭 방식 설명
export const MATCHING_TYPE_DESCRIPTIONS: Record<MatchingType, string> = {
  [MatchingType.EXACT]: '입력값이 정확히 일치해야 함',
  [MatchingType.CONTAINS]: '입력값에 특정 문자열이 포함되면 일치',
  [MatchingType.RANGE]: '숫자 범위로 등급 판정',
  [MatchingType.GRADE]: '미리 정의된 등급별로 점수 부여'
}
