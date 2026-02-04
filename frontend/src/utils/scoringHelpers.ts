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

/**
 * ScoringConfig를 ScoringCriteria[] 배열로 변환
 * (API 전송용)
 */
export function buildScoringCriteria(config: ScoringConfig): ScoringCriteria[] {
  if (config.matchingType === MatchingType.GRADE && config.gradeMappings) {
    // GRADE 타입: 각 등급을 개별 criteria로 변환
    return config.gradeMappings.map(mapping => ({
      matching_type: MatchingType.GRADE,
      expected_value: String(mapping.value),
      score: mapping.score,
      value_source: config.valueSource,
      source_field: config.sourceField,
      extract_pattern: config.extractPattern,
      aggregation_mode: config.aggregationMode
    }))
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
export function validateScoringConfig(config: ScoringConfig): string[] {
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
