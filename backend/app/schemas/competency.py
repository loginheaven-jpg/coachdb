from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.competency import VerificationStatus, MatchingType, ProofRequiredLevel, ItemTemplate, CompetencyCategory, InputType, ValueSourceType


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


class CompetencyItemResponse(BaseModel):
    """Competency item (master data)"""
    item_id: int
    item_name: str
    item_code: str
    category: str
    input_type: str  # Deprecated
    is_active: bool

    # Template system
    template: Optional[ItemTemplate] = None
    template_config: Optional[str] = None  # JSON string
    is_repeatable: bool = False
    max_entries: Optional[int] = None
    description: Optional[str] = None  # 설문 입력 안내 문구

    # Custom question support
    is_custom: bool = False
    created_by: Optional[int] = None

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


class ScoringCriteriaResponse(BaseModel):
    """Scoring criteria response"""
    criteria_id: int
    matching_type: MatchingType
    expected_value: str
    score: Decimal
    value_source: ValueSourceType = ValueSourceType.SUBMITTED
    source_field: Optional[str] = None
    extract_pattern: Optional[str] = None

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
    template: Optional[ItemTemplate] = None
    template_config: Optional[str] = None  # JSON string
    is_repeatable: bool = False
    max_entries: Optional[int] = None
    is_active: bool = True
    description: Optional[str] = None  # 설문 입력 안내 문구
    is_custom: bool = False  # True for custom questions
    fields: List[CompetencyItemFieldCreate] = []


class CompetencyItemUpdate(BaseModel):
    """Update a competency item (Admin only)"""
    item_name: Optional[str] = None
    category: Optional[CompetencyCategory] = None
    template: Optional[ItemTemplate] = None
    template_config: Optional[str] = None
    is_repeatable: Optional[bool] = None
    max_entries: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None  # 설문 입력 안내 문구
