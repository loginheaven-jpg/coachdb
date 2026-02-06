from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.competency import VerificationStatus, MatchingType, ProofRequiredLevel, ItemTemplate, CompetencyCategory, InputType, ValueSourceType, AggregationMode


class FileBasicInfo(BaseModel):
    """Basic file information for nested responses"""
    file_id: int
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


# Request Schemas
class CompetencyCreate(BaseModel):
    """Create a new competency"""
    item_id: int
    value: Optional[str] = None
    file_id: Optional[int] = None


class CompetencyUpdate(BaseModel):
    """Update an existing competency"""
    value: Optional[str] = None
    file_id: Optional[int] = None


# Response Schemas
class CompetencyItemFieldResponse(BaseModel):
    """Competency item field response"""
    field_id: int
    field_name: str
    field_label: str
    field_type: str
    field_options: Optional[str] = None  # JSON string
    is_required: bool
    display_order: int
    placeholder: Optional[str] = None

    class Config:
        from_attributes = True


class UnifiedTemplateBasicInfo(BaseModel):
    """역량항목 응답에 포함되는 간략한 통합 템플릿 정보"""
    template_id: str
    template_name: str
    description: Optional[str] = None
    data_source: str
    evaluation_method: str
    grade_type: Optional[str] = None
    matching_type: Optional[str] = None
    has_scoring: bool = False
    is_certification: bool = False

    class Config:
        from_attributes = True


class CompetencyItemResponse(BaseModel):
    """Competency item (master data)"""
    item_id: int
    item_name: str
    item_code: str
    category: str
    input_type: str  # Deprecated
    is_active: bool

    # Template system (legacy)
    template: Optional[ItemTemplate] = None  # Deprecated: use unified_template_id
    template_config: Optional[str] = None  # JSON string (legacy)
    is_repeatable: bool = False
    max_entries: Optional[int] = None
    description: Optional[str] = None  # 설문 입력 안내 문구

    # Custom question support
    is_custom: bool = False
    created_by: Optional[int] = None

    # Input template (입력 폼 구조) - deprecated, use unified_template_id
    input_template_id: Optional[str] = None  # FK to input_templates

    # Scoring template (평가 방법 설정) - deprecated, use unified_template_id
    scoring_template_id: Optional[str] = None  # FK to scoring_templates
    scoring_config_override: Optional[str] = None  # 커스터마이즈 시 사용 (JSON)

    # Unified template (통합 템플릿 - 2-tier 아키텍처)
    unified_template_id: Optional[str] = None  # FK to unified_templates
    evaluation_method_override: Optional[str] = None  # by_name/by_existence 오버라이드 (자격증용)
    unified_template: Optional[UnifiedTemplateBasicInfo] = None  # 연결된 템플릿 정보

    # 템플릿에서 복사 후 독립 관리 (역량항목별 커스터마이징)
    grade_mappings: Optional[str] = None  # 등급-점수 매핑 JSON
    proof_required: Optional[str] = None  # not_required, optional, required
    help_text: Optional[str] = None  # 도움말
    placeholder: Optional[str] = None  # 플레이스홀더

    # 평가 설정 (Phase 4: 역량항목 완전 독립화)
    grade_type: Optional[str] = None  # string, numeric, file_exists, multi_select
    matching_type: Optional[str] = None  # exact, contains, range, grade
    grade_edit_mode: str = "flexible"  # fixed, score_only, flexible
    evaluation_method: str = "standard"  # standard, by_name, by_existence
    data_source: str = "form_input"  # form_input, user_profile, coach_competency
    has_scoring: bool = False  # computed: grade_type and matching_type both non-null

    # 점수 소스 설정 (Phase 5: 프리셋에서 완전 독립)
    scoring_value_source: Optional[str] = "submitted"  # submitted, user_field, json_field
    scoring_source_field: Optional[str] = None  # User 필드명
    extract_pattern: Optional[str] = None  # 정규식 추출 패턴

    # 역량항목 전용 필드
    verification_note: Optional[str] = None  # 검증 안내 문구
    auto_confirm_across_projects: Optional[bool] = None  # 타 과제 자동 컨펌
    field_label_overrides: Optional[str] = None  # 필드 라벨 오버라이드 JSON

    # Fields
    fields: List[CompetencyItemFieldResponse] = []

    class Config:
        from_attributes = True


class CoachCompetencyResponse(BaseModel):
    """Coach competency response"""
    competency_id: int
    user_id: int
    item_id: int
    value: Optional[str]
    file_id: Optional[int]
    verification_status: VerificationStatus
    verified_by: Optional[int]
    verified_at: Optional[datetime]
    rejection_reason: Optional[str]
    is_anonymized: bool
    created_at: datetime
    updated_at: Optional[datetime]

    # Global verification fields (다중 Verifier 컨펌 시스템)
    is_globally_verified: bool = False
    globally_verified_at: Optional[datetime] = None

    # Include competency item details
    competency_item: Optional[CompetencyItemResponse] = None
    # Include file details if file is attached
    file_info: Optional[FileBasicInfo] = None

    class Config:
        from_attributes = True


# ============================================================================
# Project Item Schemas (프로젝트별 역량 항목 설정)
# ============================================================================
class ScoringCriteriaCreate(BaseModel):
    """Create scoring criteria for project item"""
    matching_type: MatchingType  # EXACT, CONTAINS, RANGE, GRADE
    expected_value: str  # 매칭할 값 (예: "KAC", "1500")
    # GRADE 타입의 경우: {"type": "string", "grades": [{"value": "KSC", "score": 10}, ...]}
    # 또는: {"type": "numeric", "grades": [{"min": 1000, "score": 10}, {"min": 500, "max": 999, "score": 5}]}
    score: Decimal = Field(default=Decimal('0'), ge=0)  # 점수 (GRADE 타입에서는 expected_value JSON에서 결정)

    # GRADE 타입용 값 소스 설정
    value_source: ValueSourceType = ValueSourceType.SUBMITTED  # 값을 가져올 소스
    source_field: Optional[str] = None  # User 필드명 또는 JSON 필드명 (예: "coach_certification_number", "degree_level")
    extract_pattern: Optional[str] = None  # 정규식 패턴 (예: "^(.{3})" - 앞 3글자 추출)

    # 복수입력 항목의 집계 방식
    aggregation_mode: AggregationMode = AggregationMode.FIRST


class ScoringCriteriaResponse(BaseModel):
    """Scoring criteria response"""
    criteria_id: int
    matching_type: MatchingType
    expected_value: str
    score: Decimal
    value_source: ValueSourceType = ValueSourceType.SUBMITTED
    source_field: Optional[str] = None
    extract_pattern: Optional[str] = None
    aggregation_mode: AggregationMode = AggregationMode.FIRST

    class Config:
        from_attributes = True


class ProjectItemCreate(BaseModel):
    """Create project item (기존 역량 항목 선택)"""
    item_id: int  # CompetencyItem ID
    is_required: bool = False
    proof_required_level: ProofRequiredLevel = ProofRequiredLevel.NOT_REQUIRED  # 증빙 필요성
    max_score: Optional[Decimal] = Field(None, ge=0)  # 평가 항목이면 점수 설정
    display_order: int = Field(default=0, ge=0)
    scoring_criteria: List[ScoringCriteriaCreate] = []  # 채점 기준


class ProjectItemResponse(BaseModel):
    """Project item response"""
    project_item_id: int
    project_id: int
    item_id: int
    is_required: bool
    proof_required_level: ProofRequiredLevel  # 증빙 필요성
    max_score: Optional[Decimal]
    display_order: int

    # Include competency item details
    competency_item: Optional[CompetencyItemResponse] = None
    # Include scoring criteria
    scoring_criteria: List[ScoringCriteriaResponse] = []

    class Config:
        from_attributes = True


# ============================================================================
# Admin Competency Item Schemas (관리자용 역량 항목 관리)
# ============================================================================
class CompetencyItemFieldCreate(BaseModel):
    """Create a competency item field"""
    field_name: str
    field_label: str
    field_type: str  # "text", "select", "multiselect", "number", "file"
    field_options: Optional[str] = None  # JSON string for select/multiselect options
    is_required: bool = True
    display_order: int = 0
    placeholder: Optional[str] = None


class CompetencyItemFieldUpdate(BaseModel):
    """Update a competency item field"""
    field_name: Optional[str] = None
    field_label: Optional[str] = None
    field_type: Optional[str] = None
    field_options: Optional[str] = None
    is_required: Optional[bool] = None
    display_order: Optional[int] = None
    placeholder: Optional[str] = None


class CompetencyItemCreate(BaseModel):
    """Create a competency item (Admin or PROJECT_MANAGER for custom questions)"""
    item_code: Optional[str] = None  # Auto-generated for custom questions
    item_name: str
    category: CompetencyCategory = CompetencyCategory.ADDON  # Default for custom
    input_type: InputType = InputType.TEXT  # Deprecated but required
    template: Optional[ItemTemplate] = None  # Deprecated: use unified_template_id
    template_config: Optional[str] = None  # JSON string (legacy)
    is_repeatable: bool = False
    max_entries: Optional[int] = None
    is_active: bool = True
    description: Optional[str] = None  # 설문 입력 안내 문구
    is_custom: bool = False  # True for custom questions
    # Legacy template fields (deprecated)
    input_template_id: Optional[str] = None  # FK to input_templates
    scoring_template_id: Optional[str] = None  # FK to scoring_templates
    scoring_config_override: Optional[str] = None  # 커스터마이즈 시 사용 (JSON)
    # 2-tier 통합 템플릿
    unified_template_id: Optional[str] = None  # FK to unified_templates
    evaluation_method_override: Optional[str] = None  # by_name/by_existence 오버라이드 (자격증용)

    # 템플릿에서 복사 후 독립 관리 (역량항목별 커스터마이징)
    grade_mappings: Optional[str] = None  # 등급-점수 매핑 JSON
    proof_required: Optional[str] = None  # not_required, optional, required
    help_text: Optional[str] = None  # 도움말
    placeholder: Optional[str] = None  # 플레이스홀더

    # 평가 설정 (Phase 4: 역량항목 완전 독립화)
    grade_type: Optional[str] = None
    matching_type: Optional[str] = None
    grade_edit_mode: Optional[str] = None
    evaluation_method: Optional[str] = None
    data_source: Optional[str] = None

    # 점수 소스 설정 (Phase 5)
    scoring_value_source: Optional[str] = None
    scoring_source_field: Optional[str] = None
    extract_pattern: Optional[str] = None

    # 역량항목 전용 필드
    verification_note: Optional[str] = None  # 검증 안내 문구
    auto_confirm_across_projects: Optional[bool] = None  # 타 과제 자동 컨펌
    field_label_overrides: Optional[str] = None  # 필드 라벨 오버라이드 JSON

    fields: List[CompetencyItemFieldCreate] = []


class CompetencyItemUpdate(BaseModel):
    """Update a competency item (Admin only)"""
    item_name: Optional[str] = None
    category: Optional[CompetencyCategory] = None
    template: Optional[ItemTemplate] = None  # Deprecated: use unified_template_id
    template_config: Optional[str] = None  # legacy
    is_repeatable: Optional[bool] = None
    max_entries: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None  # 설문 입력 안내 문구
    # Legacy template fields (deprecated)
    input_template_id: Optional[str] = None  # FK to input_templates
    scoring_template_id: Optional[str] = None  # FK to scoring_templates
    scoring_config_override: Optional[str] = None  # 커스터마이즈 시 사용 (JSON)
    # 2-tier 통합 템플릿
    unified_template_id: Optional[str] = None  # FK to unified_templates
    evaluation_method_override: Optional[str] = None  # by_name/by_existence 오버라이드 (자격증용)

    # 템플릿에서 복사 후 독립 관리 (역량항목별 커스터마이징)
    grade_mappings: Optional[str] = None  # 등급-점수 매핑 JSON
    proof_required: Optional[str] = None  # not_required, optional, required
    help_text: Optional[str] = None  # 도움말
    placeholder: Optional[str] = None  # 플레이스홀더

    # 평가 설정 (Phase 4: 역량항목 완전 독립화)
    grade_type: Optional[str] = None
    matching_type: Optional[str] = None
    grade_edit_mode: Optional[str] = None
    evaluation_method: Optional[str] = None
    data_source: Optional[str] = None

    # 점수 소스 설정 (Phase 5)
    scoring_value_source: Optional[str] = None
    scoring_source_field: Optional[str] = None
    extract_pattern: Optional[str] = None

    # 역량항목 전용 필드
    verification_note: Optional[str] = None  # 검증 안내 문구
    auto_confirm_across_projects: Optional[bool] = None  # 타 과제 자동 컨펌
    field_label_overrides: Optional[str] = None  # 필드 라벨 오버라이드 JSON
