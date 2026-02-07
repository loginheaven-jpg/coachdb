/**
 * 등급 설정 모달 (공통 컴포넌트)
 * 위저드 Step4와 SurveyBuilder에서 사용
 */

import { Modal, Select, Radio, Input, InputNumber, Button, Space, Alert, Divider, Collapse, Checkbox, message } from 'antd'
import { PlusOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import {
  ScoringConfig,
  GradeType,
  ValueSource,
  AggregationMode,
  MatchingType,
  GradeMapping,
  ProofRequiredLevel,
  MATCHING_TYPES_BY_GRADE,
  AGGREGATION_MODES_BY_GRADE,
  AGGREGATION_MODE_DESCRIPTIONS,
  MATCHING_TYPE_DESCRIPTIONS
} from '../../types/scoring'
import {
  ALL_TEMPLATES,
  getSuggestedTemplates,
  getTemplateById,
  GradeTemplate,
  TEMPLATE_COUNSELING_BY_NAME,
  TEMPLATE_COUNSELING_BY_EXISTS,
  TEMPLATE_OTHER_BY_NAME,
  TEMPLATE_OTHER_BY_EXISTS
} from '../../utils/gradeTemplates'
import { validateScoringConfig } from '../../utils/scoringHelpers'

const { Panel } = Collapse

interface GradeConfigModalProps {
  visible: boolean
  itemId: number
  itemName: string
  maxScore: number
  initialConfig?: ScoringConfig
  onOk: (config: ScoringConfig) => void
  onCancel: () => void
  showTemplateSelection?: boolean  // 위저드에서만 true
  gradeEditMode?: 'fixed' | 'score_only' | 'flexible'  // 역량 템플릿의 편집 제한
  isSuperAdmin?: boolean  // SUPER_ADMIN은 항상 제한 없음
}

export default function GradeConfigModal({
  visible,
  itemId,
  itemName,
  maxScore,
  initialConfig,
  onOk,
  onCancel,
  showTemplateSelection = false,
  gradeEditMode = 'flexible',
  isSuperAdmin = false
}: GradeConfigModalProps) {
  // grade_edit_mode 적용: SUPER_ADMIN은 항상 flexible
  const effectiveEditMode = isSuperAdmin ? 'flexible' : (gradeEditMode || 'flexible')
  // fixed: 전부 읽기 전용 / score_only: 점수만 수정 / flexible: 모두 수정
  const isGradeStructureLocked = effectiveEditMode === 'fixed' || effectiveEditMode === 'score_only'
  const isScoreLocked = effectiveEditMode === 'fixed'
  const [config, setConfig] = useState<ScoringConfig>({
    itemId,
    matchingType: MatchingType.EXACT,
    configured: false,
    ...initialConfig
  })

  const [templateSelectionMode, setTemplateSelectionMode] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 초기화: 템플릿 자동 제안
  useEffect(() => {
    if (visible && !initialConfig) {
      const suggestions = getSuggestedTemplates(itemName)

      if (suggestions.length > 0) {
        const template = suggestions[0]

        // 상담/심리치료, 기타 자격증은 선택 모달 표시
        if (showTemplateSelection && (
          template.id === 'counseling_by_name' ||
          template.id === 'counseling_by_exists' ||
          template.id === 'other_by_name' ||
          template.id === 'other_by_exists'
        )) {
          if (itemName.toLowerCase().includes('상담') || itemName.toLowerCase().includes('심리')) {
            setTemplateSelectionMode('counseling')
          } else {
            setTemplateSelectionMode('other')
          }
        } else {
          applyTemplate(template)
        }
      }
    }
  }, [visible, itemName, initialConfig, showTemplateSelection])

  // 템플릿 적용
  const applyTemplate = (template: GradeTemplate) => {
    setConfig(prev => ({
      ...prev,
      matchingType: template.matchingType,
      gradeType: template.gradeType,
      valueSource: template.valueSource,
      sourceField: template.sourceField,  // 템플릿의 sourceField 복사
      aggregationMode: template.aggregationMode,
      gradeMappings: template.defaultMappings.map(m => ({ ...m })),
      fixedGrades: template.fixedGrades,
      allowAddGrades: template.allowAddGrades,
      proofRequired: template.proofRequired,
      isRequired: template.isRequired,  // 필수 입력 여부
      allowMultiple: template.allowMultiple,  // 복수 입력 가능 여부
      autoConfirmAcrossProjects: template.autoConfirmAcrossProjects,  // 자동 컨펌 정책
      verificationNote: template.verificationNote
    }))
  }

  // 템플릿 선택 모달 처리
  const handleTemplateSelection = (choice: 'name' | 'exists') => {
    if (templateSelectionMode === 'counseling') {
      const template = choice === 'name' ? TEMPLATE_COUNSELING_BY_NAME : TEMPLATE_COUNSELING_BY_EXISTS
      applyTemplate(template)
    } else if (templateSelectionMode === 'other') {
      const template = choice === 'name' ? TEMPLATE_OTHER_BY_NAME : TEMPLATE_OTHER_BY_EXISTS
      applyTemplate(template)
    }
    setTemplateSelectionMode(null)
  }

  const handleOk = () => {
    const errors = validateScoringConfig(config, maxScore)
    if (errors.length > 0) {
      Modal.error({
        title: '설정 오류',
        content: (
          <ul style={{ paddingLeft: 20 }}>
            {errors.map((err, idx) => <li key={idx}>{err}</li>)}
          </ul>
        )
      })
      return
    }

    onOk({ ...config, configured: true })
  }

  const handleAddGrade = () => {
    const newMapping: GradeMapping = {
      value: config.gradeType === GradeType.NUMERIC ? 0 : '',
      score: 0
    }
    setConfig(prev => ({
      ...prev,
      gradeMappings: [...(prev.gradeMappings || []), newMapping]
    }))
  }

  const handleUpdateGrade = (index: number, field: keyof GradeMapping, value: any) => {
    setConfig(prev => {
      const mappings = [...(prev.gradeMappings || [])]
      mappings[index] = { ...mappings[index], [field]: value }
      return { ...prev, gradeMappings: mappings }
    })
  }

  const handleRemoveGrade = (index: number) => {
    const mapping = config.gradeMappings?.[index]
    if (mapping?.fixed) {
      message.warning('고정된 등급은 삭제할 수 없습니다')
      return
    }

    setConfig(prev => ({
      ...prev,
      gradeMappings: prev.gradeMappings?.filter((_, i) => i !== index)
    }))
  }

  // 등급 유형 변경 시 매칭/집계 방식 초기화
  const handleGradeTypeChange = (gradeType: GradeType) => {
    const availableMatching = MATCHING_TYPES_BY_GRADE[gradeType]
    const availableAggregation = AGGREGATION_MODES_BY_GRADE[gradeType]

    setConfig(prev => ({
      ...prev,
      gradeType,
      matchingType: availableMatching[0],
      aggregationMode: availableAggregation[0],
      gradeMappings: []
    }))
  }

  // 템플릿 선택 모달
  if (templateSelectionMode) {
    const isOther = templateSelectionMode === 'other'
    return (
      <Modal
        title={`${itemName} - 평가 방식 선택`}
        open={visible}
        onCancel={() => {
          setTemplateSelectionMode(null)
          onCancel()
        }}
        footer={null}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            type="info"
            message="자격증 평가 방식을 선택하세요"
            description={isOther ?
              "자격증을 어떻게 평가할지 선택하세요" :
              "상담/심리치료 관련 자격증을 어떻게 평가할지 선택하세요"
            }
            showIcon
          />

          <div
            onClick={() => handleTemplateSelection('name')}
            style={{
              padding: 20,
              border: '2px solid #d9d9d9',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ff6b00'
              e.currentTarget.style.backgroundColor = '#fff5eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d9d9d9'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
              자격증 이름으로 등급 설정
            </div>
            <div style={{ color: '#666' }}>
              예: "임상심리사" 포함 → 30점, "상담심리사" 포함 → 20점
              <br />
              자격증 이름을 기준으로 점수를 차등 부여합니다.
            </div>
          </div>

          <div
            onClick={() => handleTemplateSelection('exists')}
            style={{
              padding: 20,
              border: '2px solid #d9d9d9',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ff6b00'
              e.currentTarget.style.backgroundColor = '#fff5eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d9d9d9'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
              자격증 유무로 등급 설정
            </div>
            <div style={{ color: '#666' }}>
              예: 유자격(증빙 확인) → 20점, 무자격 → 0점
              <br />
              자격증 적합성은 검토자가 증빙을 확인하여 판단합니다.
            </div>
          </div>
        </Space>
      </Modal>
    )
  }

  return (
    <Modal
      title={`${itemName} - 등급 설정`}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={800}
      okText="설정 완료"
      cancelText="취소"
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 안내 메시지 */}
        {config.verificationNote && (
          <Alert
            type="info"
            message={config.verificationNote}
            showIcon
          />
        )}

        {/* grade_edit_mode 안내 */}
        {effectiveEditMode !== 'flexible' && (
          <Alert
            type="warning"
            message={effectiveEditMode === 'fixed'
              ? '이 항목은 역량 템플릿에서 등급 구조와 점수가 고정되어 있습니다 (읽기 전용)'
              : '이 항목은 역량 템플릿에서 등급 구조가 고정되어 있습니다 (점수만 수정 가능)'}
            showIcon
          />
        )}

        {/* 1. 등급 유형 */}
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
            등급 유형 <span style={{ color: '#ff4d4f' }}>*</span>
          </label>
          <Radio.Group
            value={config.gradeType}
            onChange={(e) => handleGradeTypeChange(e.target.value)}
            disabled={config.fixedGrades || isGradeStructureLocked}
          >
            <Space direction="vertical">
              <Radio value={GradeType.STRING}>문자열 (예: KSC, KAC)</Radio>
              <Radio value={GradeType.NUMERIC}>숫자 (예: 점수, 시간)</Radio>
              <Radio value={GradeType.FILE_EXISTS}>파일 유무</Radio>
              <Radio value={GradeType.MULTI_SELECT}>복수 선택</Radio>
            </Space>
          </Radio.Group>
        </div>

        {/* 2. 매칭 방식 */}
        {config.gradeType && (
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
              매칭 방식 <span style={{ color: '#ff4d4f' }}>*</span>
            </label>
            <Select
              style={{ width: '100%' }}
              value={config.matchingType}
              onChange={(value) => setConfig(prev => ({ ...prev, matchingType: value }))}
              disabled={config.fixedGrades || isGradeStructureLocked}
            >
              {MATCHING_TYPES_BY_GRADE[config.gradeType].map(type => (
                <Select.Option key={type} value={type}>
                  {MATCHING_TYPE_DESCRIPTIONS[type]}
                </Select.Option>
              ))}
            </Select>
          </div>
        )}

        {/* 3. 복수입력 집계 방식 */}
        {config.gradeType && config.matchingType === MatchingType.GRADE && (
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
              복수입력 점수계산법 <span style={{ color: '#ff4d4f' }}>*</span>
            </label>
            <Select
              style={{ width: '100%' }}
              value={config.aggregationMode}
              onChange={(value) => setConfig(prev => ({ ...prev, aggregationMode: value }))}
            >
              {AGGREGATION_MODES_BY_GRADE[config.gradeType].map(mode => (
                <Select.Option key={mode} value={mode}>
                  {AGGREGATION_MODE_DESCRIPTIONS[mode]}
                </Select.Option>
              ))}
            </Select>
          </div>
        )}

        {/* 4. 고급 설정 (접을 수 있음) */}
        <Collapse
          ghost
          expandIconPosition="end"
          onChange={(keys) => setShowAdvanced(keys.includes('advanced'))}
        >
          <Panel
            header={
              <span>
                <SettingOutlined /> 고급 설정 (선택)
              </span>
            }
            key="advanced"
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 값을 가져올 위치 */}
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                  값을 가져올 위치
                </label>
                <Select
                  style={{ width: '100%' }}
                  value={config.valueSource || ValueSource.SUBMITTED}
                  onChange={(value) => setConfig(prev => ({ ...prev, valueSource: value }))}
                  disabled={config.fixedGrades && config.valueSource === ValueSource.USER_FIELD}
                >
                  <Select.Option value={ValueSource.SUBMITTED}>
                    제출된 값 (기본)
                  </Select.Option>
                  <Select.Option value={ValueSource.USER_FIELD}>
                    사용자 기본정보 필드
                  </Select.Option>
                  <Select.Option value={ValueSource.JSON_FIELD}>
                    JSON 필드 (고급)
                  </Select.Option>
                </Select>
              </div>

              {/* 필드명 */}
              {(config.valueSource === ValueSource.USER_FIELD || config.valueSource === ValueSource.JSON_FIELD) && (
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                    필드명 <span style={{ color: '#ff4d4f' }}>*</span>
                  </label>
                  <Input
                    placeholder="예: kca_certification_level"
                    value={config.sourceField}
                    onChange={(e) => setConfig(prev => ({ ...prev, sourceField: e.target.value }))}
                  />
                  {config.valueSource === ValueSource.JSON_FIELD && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      JSON 경로 예: certifications[0].name
                    </div>
                  )}
                </div>
              )}
            </Space>
          </Panel>
        </Collapse>

        <Divider />

        {/* 5. 등급별 점수 설정 */}
        {config.matchingType === MatchingType.GRADE && (
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
              등급별 점수 ({config.gradeMappings?.length || 0}개)
              {(config.fixedGrades || isGradeStructureLocked) && (
                <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                  {isScoreLocked ? '(읽기 전용)' : '(점수만 수정 가능)'}
                </span>
              )}
            </label>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {(config.gradeMappings || []).map((mapping, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: 12,
                    border: '1px solid #e0e0e0',
                    borderRadius: 8,
                    backgroundColor: mapping.fixed ? '#f5f5f5' : '#fff'
                  }}
                >
                  {/* 등급 값 */}
                  {config.gradeType === GradeType.NUMERIC ? (
                    <InputNumber
                      style={{ width: 120 }}
                      placeholder="값"
                      value={Number(mapping.value)}
                      onChange={(value) => handleUpdateGrade(index, 'value', value || 0)}
                      disabled={mapping.fixed || isGradeStructureLocked}
                    />
                  ) : (
                    <Input
                      style={{ flex: 1 }}
                      placeholder="등급/값 (예: KSC)"
                      value={String(mapping.value)}
                      onChange={(e) => handleUpdateGrade(index, 'value', e.target.value)}
                      disabled={mapping.fixed || isGradeStructureLocked}
                    />
                  )}

                  <span style={{ color: '#999' }}>→</span>

                  {/* 점수 */}
                  <InputNumber
                    style={{ width: 100 }}
                    placeholder="점수"
                    value={mapping.score}
                    onChange={(value) => handleUpdateGrade(index, 'score', value || 0)}
                    addonAfter="점"
                    precision={0}
                    max={maxScore}
                    min={0}
                    disabled={isScoreLocked}
                  />

                  {/* 라벨 */}
                  {mapping.label && (
                    <span style={{ color: '#666', fontSize: 12, flex: 1 }}>
                      {mapping.label}
                    </span>
                  )}

                  {/* 삭제 버튼 */}
                  {!mapping.fixed && !isGradeStructureLocked && (
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveGrade(index)}
                    />
                  )}
                </div>
              ))}

              {/* 등급 추가 버튼 */}
              {(!config.fixedGrades || config.allowAddGrades) && !isGradeStructureLocked && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleAddGrade}
                  block
                >
                  등급 추가
                </Button>
              )}
            </Space>
          </div>
        )}

        <Divider />

        {/* 추가 설정 */}
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 12 }}>
            항목 설정
          </label>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 필수 입력 여부 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>필수 입력</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  이 항목을 반드시 입력해야 합니까?
                </div>
              </div>
              <Radio.Group
                value={config.isRequired ?? false}
                onChange={(e) => setConfig(prev => ({ ...prev, isRequired: e.target.value }))}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value={true}>필수</Radio.Button>
                <Radio.Button value={false}>선택</Radio.Button>
              </Radio.Group>
            </div>

            {/* 증빙 첨부 여부 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>증빙 첨부</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  이 항목에 대한 증빙 자료가 필요합니까?
                </div>
              </div>
              <Radio.Group
                value={config.proofRequired || ProofRequiredLevel.OPTIONAL}
                onChange={(e) => setConfig(prev => ({ ...prev, proofRequired: e.target.value }))}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value={ProofRequiredLevel.REQUIRED}>필수</Radio.Button>
                <Radio.Button value={ProofRequiredLevel.OPTIONAL}>선택</Radio.Button>
                <Radio.Button value={ProofRequiredLevel.NOT_REQUIRED}>불필요</Radio.Button>
              </Radio.Group>
            </div>

            {/* 증빙 감점 설정 - 증빙선택(OPTIONAL)일 때만 */}
            {(config.proofRequired === ProofRequiredLevel.OPTIONAL) && (
              <div style={{ padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Checkbox
                      checked={config.proofPenalty !== undefined && config.proofPenalty !== null && config.proofPenalty !== 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const currentMax = Math.max(...(config.gradeMappings || []).map(m => m.score), maxScore || 0)
                          setConfig(prev => ({ ...prev, proofPenalty: -(currentMax) }))
                        } else {
                          setConfig(prev => ({ ...prev, proofPenalty: undefined }))
                        }
                      }}
                    >
                      증빙 감점 적용
                    </Checkbox>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        const currentMax = Math.max(...(config.gradeMappings || []).map(m => m.score), maxScore || 0)
                        setConfig(prev => ({ ...prev, proofPenalty: -(currentMax) }))
                      }}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      증빙필수 (미첨부 시 0점)
                    </Button>
                  </Space>

                  {config.proofPenalty !== undefined && config.proofPenalty !== null && config.proofPenalty !== 0 && (
                    <>
                      <div>
                        <label style={{ fontSize: 12, color: '#666' }}>증빙 미첨부 시 감점</label>
                        <InputNumber
                          min={0}
                          max={100}
                          value={Math.abs(config.proofPenalty)}
                          onChange={(val) => setConfig(prev => ({ ...prev, proofPenalty: val ? -Math.abs(val) : undefined }))}
                          addonBefore="-"
                          addonAfter="점"
                          style={{ width: 150, marginLeft: 8 }}
                        />
                      </div>
                      <div style={{ padding: 8, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #e8e8e8' }}>
                        <span style={{ fontSize: 12, color: '#999' }}>결과 예시:</span>
                        <div style={{ marginTop: 4 }}>
                          {(() => {
                            const topScore = Math.max(...(config.gradeMappings || []).map(m => m.score), maxScore || 0)
                            const penalty = Math.abs(config.proofPenalty || 0)
                            return (
                              <>
                                <div>- 내용 + 증빙 = <strong>{topScore}점</strong></div>
                                <div>- 내용만 = <strong>{Math.max(0, topScore - penalty)}점</strong> ({topScore}-{penalty})</div>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </Space>
              </div>
            )}

            {/* 복수 입력 가능 여부 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>복수 항목 입력</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  이 항목을 여러 개 입력할 수 있습니까? (예: 여러 자격증)
                </div>
              </div>
              <Radio.Group
                value={config.allowMultiple ?? false}
                onChange={(e) => setConfig(prev => ({ ...prev, allowMultiple: e.target.value }))}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value={true}>가능</Radio.Button>
                <Radio.Button value={false}>불가</Radio.Button>
              </Radio.Group>
            </div>
          </Space>
        </div>

        {/* 총 배점 안내 */}
        <Alert
          type="warning"
          message={`총 배점: ${maxScore}점`}
          description={`이 항목에 할당된 최대 점수는 ${maxScore}점입니다. 등급별 점수의 합이 ${maxScore}점을 초과하지 않도록 주의하세요.`}
          showIcon
        />
      </Space>
    </Modal>
  )
}
