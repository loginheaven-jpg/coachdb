/**
 * Scoring 관련 헬퍼 함수
 */

import {
  ScoringConfig,
  ScoringCriteria,
  GradeType,
  MatchingType,
  ValueSource,
  AggregationMode,
  ProofRequiredLevel
} from '../types/scoring'

import {
  ScoringCriteriaCreate,
  MatchingType as MTLower,
  ValueSourceType,
  AggregationMode as AggLower,
  GradeConfig
} from '../services/projectService'

/**
 * ScoringConfig를 ScoringCriteria[] 배열로 변환
 * (API 전송용)
 */
export function buildScoringCriteria(config: ScoringConfig): ScoringCriteria[] {
  if (config.matchingType === MatchingType.GRADE && config.gradeMappings) {
    // GRADE 타입: 단일 criteria, expected_value에 JSON config
    // 백엔드 match_grade_value()가 JSON.parse(expected_value)로 파싱함
    const gradeConfig: Record<string, any> = {
      type: config.gradeType || GradeType.STRING,
      grades: config.gradeMappings.map(m => ({
        value: m.value,
        score: m.score,
        ...(m.label ? { label: m.label } : {})
      }))
    }
    // file_exists 타입은 grades를 object로 변환 (exists/none)
    if (config.gradeType === GradeType.FILE_EXISTS && config.gradeMappings.length >= 2) {
      const existsMapping = config.gradeMappings.find(m => String(m.value) === 'exists' || String(m.value) === '있음')
      const noneMapping = config.gradeMappings.find(m => String(m.value) === 'none' || String(m.value) === '없음')
      gradeConfig.grades = {
        exists: existsMapping?.score || 0,
        none: noneMapping?.score || 0
      }
    }
    // multi_select 타입은 mode 추가
    if (config.gradeType === GradeType.MULTI_SELECT) {
      gradeConfig.mode = 'contains'  // 기본값
    }

    const maxScore = Math.max(...config.gradeMappings.map(m => m.score), 0)

    return [{
      matching_type: MatchingType.GRADE,
      expected_value: JSON.stringify(gradeConfig),
      score: maxScore,
      value_source: config.valueSource,
      source_field: config.sourceField,
      extract_pattern: config.extractPattern,
      aggregation_mode: config.aggregationMode
    }]
  } else {
    // EXACT, CONTAINS, RANGE: 단일 criteria
    return [{
      matching_type: config.matchingType,
      expected_value: '',
      score: 0,  // 기본값 (RANGE는 gradeMappings 사용)
      value_source: config.valueSource,
      source_field: config.sourceField,
      extract_pattern: config.extractPattern,
      aggregation_mode: config.aggregationMode
    }]
  }
}

/**
 * 역량 항목 이름으로 기본 설정 제안
 */
export function suggestDefaultConfig(itemName: string): Partial<ScoringConfig> {
  const name = itemName.toLowerCase()

  // 코칭관련자격증
  if (name.includes('kca') || name.includes('코칭') && name.includes('자격')) {
    return {
      matchingType: MatchingType.GRADE,
      gradeType: GradeType.STRING,
      valueSource: ValueSource.USER_FIELD,
      aggregationMode: AggregationMode.BEST_MATCH,
      proofRequired: ProofRequiredLevel.OPTIONAL
    }
  }

  // 상담/심리치료 관련 자격
  if (name.includes('상담') || name.includes('심리') || name.includes('치료')) {
    return {
      matchingType: MatchingType.CONTAINS,
      gradeType: GradeType.STRING,
      valueSource: ValueSource.SUBMITTED,
      aggregationMode: AggregationMode.BEST_MATCH,
      proofRequired: ProofRequiredLevel.REQUIRED
    }
  }

  // 경력 시간
  if (name.includes('경력') || name.includes('시간')) {
    return {
      matchingType: MatchingType.RANGE,
      gradeType: GradeType.NUMERIC,
      valueSource: ValueSource.SUBMITTED,
      aggregationMode: AggregationMode.SUM,
      proofRequired: ProofRequiredLevel.OPTIONAL
    }
  }

  // 학위
  if (name.includes('학위')) {
    return {
      matchingType: MatchingType.GRADE,
      gradeType: GradeType.STRING,
      valueSource: ValueSource.SUBMITTED,
      aggregationMode: AggregationMode.BEST_MATCH,
      proofRequired: ProofRequiredLevel.REQUIRED
    }
  }

  // 증빙 파일
  if (name.includes('증빙') || name.includes('파일')) {
    return {
      matchingType: MatchingType.EXACT,
      gradeType: GradeType.FILE_EXISTS,
      valueSource: ValueSource.SUBMITTED,
      proofRequired: ProofRequiredLevel.REQUIRED
    }
  }

  // 기본값
  return {
    matchingType: MatchingType.EXACT,
    gradeType: GradeType.STRING,
    valueSource: ValueSource.SUBMITTED,
    proofRequired: ProofRequiredLevel.OPTIONAL
  }
}

/**
 * 설정 검증
 */
export function validateScoringConfig(config: ScoringConfig, maxScore?: number): string[] {
  const errors: string[] = []

  if (!config.matchingType) {
    errors.push('매칭 방식을 선택하세요')
  }

  if (config.matchingType === MatchingType.GRADE) {
    if (!config.gradeType) {
      errors.push('등급 유형을 선택하세요')
    }

    if (!config.gradeMappings || config.gradeMappings.length === 0) {
      errors.push('최소 1개 이상의 등급을 추가하세요')
    }

    // 등급 값 중복 체크
    if (config.gradeMappings) {
      const values = config.gradeMappings.map(m => String(m.value))
      const uniqueValues = new Set(values)
      if (values.length !== uniqueValues.size) {
        errors.push('등급 값이 중복되었습니다')
      }
    }

    // 점수 유효성 체크
    if (config.gradeMappings) {
      for (const mapping of config.gradeMappings) {
        if (mapping.score < 0) {
          errors.push('점수는 0점 이상이어야 합니다')
          break
        }
      }

      // 최대 점수 초과 체크
      if (maxScore !== undefined && maxScore > 0) {
        const highestScore = Math.max(...config.gradeMappings.map(m => m.score))
        if (highestScore > maxScore) {
          errors.push(`등급별 점수가 최대 배점(${maxScore}점)을 초과할 수 없습니다. 가장 높은 점수: ${highestScore}점. 이전단계(항목선택)로 가셔서 배점을 조정하실 수 있습니다.`)
        }
      }
    }
  }

  if (config.valueSource === ValueSource.USER_FIELD || config.valueSource === ValueSource.JSON_FIELD) {
    if (!config.sourceField) {
      errors.push('필드명을 입력하세요')
    }
  }

  if (!config.aggregationMode && config.matchingType === MatchingType.GRADE) {
    errors.push('복수입력 점수계산법을 선택하세요')
  }

  return errors
}

/**
 * 총 점수 계산 (등급별 점수의 최대값)
 */
export function calculateTotalScore(config: ScoringConfig): number {
  if (!config.gradeMappings || config.gradeMappings.length === 0) {
    return 0
  }

  return Math.max(...config.gradeMappings.map(m => m.score))
}

/**
 * 등급 매핑을 점수 내림차순으로 정렬
 */
export function sortGradeMappingsByScore(mappings: ScoringConfig['gradeMappings']): ScoringConfig['gradeMappings'] {
  if (!mappings) return []
  return [...mappings].sort((a, b) => b.score - a.score)
}

/**
 * 설정 요약 텍스트 생성 (미리보기용)
 */
export function getScoringConfigSummary(config: ScoringConfig): string {
  if (!config.configured) {
    return '미설정'
  }

  const parts: string[] = []

  // 매칭 방식
  if (config.matchingType === MatchingType.GRADE) {
    parts.push(`등급별 점수 (${config.gradeMappings?.length || 0}개)`)
  } else if (config.matchingType === MatchingType.EXACT) {
    parts.push('정확한 일치')
  } else if (config.matchingType === MatchingType.CONTAINS) {
    parts.push('포함 여부')
  } else if (config.matchingType === MatchingType.RANGE) {
    parts.push('범위 매칭')
  }

  // 집계 방식
  if (config.aggregationMode) {
    const modeNames: Record<AggregationMode, string> = {
      [AggregationMode.ANY_MATCH]: '하나라도 일치',
      [AggregationMode.FIRST]: '첫번째만',
      [AggregationMode.SUM]: '합계',
      [AggregationMode.MAX]: '최대값',
      [AggregationMode.COUNT]: '개수',
      [AggregationMode.BEST_MATCH]: '최고점수'
    }
    parts.push(modeNames[config.aggregationMode])
  }

  return parts.join(' · ')
}

/**
 * ScoringCriteria[] 배열을 ScoringConfig로 역변환
 * (API 응답 파싱용)
 */
export function parseScoringCriteria(
  itemId: number,
  criteria: ScoringCriteria[]
): Partial<ScoringConfig> | null {
  if (!criteria || criteria.length === 0) {
    return null
  }

  const firstCriteria = criteria[0]

  // matchingType 추출
  const matchingType = firstCriteria.matching_type as MatchingType

  if (matchingType === MatchingType.GRADE) {
    // GRADE 타입: 단일 criteria의 expected_value에서 JSON config 파싱
    let gradeMappings: Array<{ value: string | number; score: number; label?: string }> = []
    let gradeType: GradeType | undefined

    try {
      const config = JSON.parse(firstCriteria.expected_value || '{}')
      gradeType = config.type as GradeType

      if (config.type === 'file_exists' && config.grades && !Array.isArray(config.grades)) {
        // file_exists: {exists: N, none: N} → array 변환
        gradeMappings = [
          { value: 'exists', score: config.grades.exists || 0, label: '있음' },
          { value: 'none', score: config.grades.none || 0, label: '없음' }
        ]
      } else if (Array.isArray(config.grades)) {
        gradeMappings = config.grades.map((g: any) => ({
          value: g.value ?? '',
          score: g.score ?? 0,
          ...(g.label ? { label: g.label } : {})
        }))
      }
    } catch {
      // 레거시 호환: JSON 파싱 실패 시 여러 criteria에서 gradeMappings 복원
      gradeMappings = criteria.map(c => ({
        value: c.expected_value || '',
        score: c.score || 0
      }))
    }

    return {
      itemId,
      matchingType: MatchingType.GRADE,
      gradeType,
      valueSource: firstCriteria.value_source as ValueSource || ValueSource.SUBMITTED,
      sourceField: firstCriteria.source_field,
      extractPattern: firstCriteria.extract_pattern,
      aggregationMode: firstCriteria.aggregation_mode as AggregationMode,
      gradeMappings,
      configured: true
    }
  } else {
    // EXACT, CONTAINS, RANGE: 단일 criteria
    return {
      itemId,
      matchingType,
      valueSource: firstCriteria.value_source as ValueSource || ValueSource.SUBMITTED,
      sourceField: firstCriteria.source_field,
      aggregationMode: firstCriteria.aggregation_mode as AggregationMode,
      configured: true
    }
  }
}

// =====================================================
// SurveyBuilder ↔ GradeConfigModal 변환 함수
// SurveyBuilder: ScoringCriteriaCreate[] (소문자 enum)
// GradeConfigModal: ScoringConfig (대문자 enum)
// =====================================================

// 소문자 → 대문자 매핑
const valueSourceToUpper: Record<string, ValueSource> = {
  'submitted': ValueSource.SUBMITTED,
  'user_field': ValueSource.USER_FIELD,
  'json_field': ValueSource.JSON_FIELD
}
const aggModeToUpper: Record<string, AggregationMode> = {
  'first': AggregationMode.FIRST,
  'sum': AggregationMode.SUM,
  'max': AggregationMode.MAX,
  'count': AggregationMode.COUNT,
  'any_match': AggregationMode.ANY_MATCH,
  'best_match': AggregationMode.BEST_MATCH
}
// 대문자 → 소문자 매핑
const valueSourceToLower: Record<string, ValueSourceType> = {
  'SUBMITTED': ValueSourceType.SUBMITTED,
  'USER_FIELD': ValueSourceType.USER_FIELD,
  'JSON_FIELD': ValueSourceType.JSON_FIELD
}
const aggModeToLower: Record<string, AggLower> = {
  'FIRST': AggLower.FIRST,
  'SUM': AggLower.SUM,
  'MAX': AggLower.MAX,
  'COUNT': AggLower.COUNT,
  'ANY_MATCH': AggLower.ANY_MATCH,
  'BEST_MATCH': AggLower.BEST_MATCH
}

/**
 * ScoringCriteriaCreate[] (SurveyBuilder 소문자) → ScoringConfig (GradeConfigModal 대문자)
 * SurveyBuilder의 기존 criteria를 GradeConfigModal의 initialConfig로 변환
 */
export function criteriaCreateToScoringConfig(
  itemId: number,
  criteria: ScoringCriteriaCreate[]
): ScoringConfig | null {
  if (!criteria || criteria.length === 0) return null

  const first = criteria[0]
  if (first.matching_type !== MTLower.GRADE) return null

  let gradeMappings: Array<{ value: string | number; score: number; label?: string }> = []
  let gradeType: GradeType | undefined
  let proofPenalty: number | undefined
  let matchMode: 'exact' | 'contains' | undefined

  try {
    const config = JSON.parse(first.expected_value || '{}')
    gradeType = config.type as GradeType
    proofPenalty = config.proofPenalty
    matchMode = config.matchMode as 'exact' | 'contains' | undefined

    if (config.type === 'file_exists' && config.grades && !Array.isArray(config.grades)) {
      gradeMappings = [
        { value: 'exists', score: config.grades.exists || 0, label: '있음' },
        { value: 'none', score: config.grades.none || 0, label: '없음' }
      ]
    } else if (Array.isArray(config.grades)) {
      gradeMappings = config.grades.map((g: any) => ({
        value: g.value ?? '',
        score: g.score ?? 0,
        ...(g.label ? { label: g.label } : {})
      }))
    }
  } catch {
    // 파싱 실패 시 null
    return null
  }

  return {
    itemId,
    matchingType: MatchingType.GRADE,
    gradeType,
    valueSource: valueSourceToUpper[first.value_source || 'submitted'] || ValueSource.SUBMITTED,
    sourceField: first.source_field || undefined,
    extractPattern: first.extract_pattern || undefined,
    aggregationMode: aggModeToUpper[first.aggregation_mode || 'any_match'] || AggregationMode.ANY_MATCH,
    gradeMappings,
    proofPenalty,
    matchMode,
    configured: true
  }
}

/**
 * ScoringConfig (GradeConfigModal 대문자) → { criteria: ScoringCriteriaCreate[], maxScore: number }
 * GradeConfigModal 결과를 SurveyBuilder 포맷으로 역변환
 */
export function scoringConfigToCriteriaCreate(config: ScoringConfig): {
  criteria: ScoringCriteriaCreate[]
  maxScore: number
} {
  if (config.matchingType !== MatchingType.GRADE || !config.gradeMappings) {
    return { criteria: [], maxScore: 0 }
  }

  const gradeConfig: Record<string, any> = {
    type: config.gradeType || GradeType.STRING,
    grades: config.gradeMappings.map(m => ({
      value: m.value,
      score: m.score,
      ...(m.label ? { label: m.label } : {})
    }))
  }

  // file_exists 특수 처리
  if (config.gradeType === GradeType.FILE_EXISTS && config.gradeMappings.length >= 2) {
    const existsMapping = config.gradeMappings.find(m => String(m.value) === 'exists' || String(m.value) === '있음')
    const noneMapping = config.gradeMappings.find(m => String(m.value) === 'none' || String(m.value) === '없음')
    gradeConfig.grades = {
      exists: existsMapping?.score || 0,
      none: noneMapping?.score || 0
    }
  }

  // multi_select mode 추가
  if (config.gradeType === GradeType.MULTI_SELECT) {
    gradeConfig.mode = 'contains'
  }

  // matchMode 추가 (CONTAINS 매칭 지원 - 백엔드 scoring_service에서 사용)
  if (config.matchMode && config.matchMode !== 'exact') {
    gradeConfig.matchMode = config.matchMode
  }

  // proofPenalty 보존
  if (config.proofPenalty !== undefined && config.proofPenalty !== null) {
    gradeConfig.proofPenalty = config.proofPenalty
  }

  const maxScore = Math.max(...config.gradeMappings.map(m => m.score), 0)

  const criteria: ScoringCriteriaCreate[] = [{
    matching_type: MTLower.GRADE,
    expected_value: JSON.stringify(gradeConfig),
    score: maxScore,
    value_source: valueSourceToLower[config.valueSource || 'SUBMITTED'] || ValueSourceType.SUBMITTED,
    source_field: config.sourceField || null,
    extract_pattern: config.extractPattern || null,
    aggregation_mode: aggModeToLower[config.aggregationMode || 'ANY_MATCH'] || AggLower.ANY_MATCH
  }]

  return { criteria, maxScore }
}
