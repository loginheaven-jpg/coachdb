"""
통합 템플릿 (UnifiedTemplate) 스키마
"""
from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List, Any, Literal
from datetime import datetime


# 타입 정의
DataSourceType = Literal["form_input", "user_profile", "coach_competency"]
EvaluationMethodType = Literal["standard", "by_name", "by_existence"]
GradeTypeType = Literal["string", "numeric", "file_exists", "multi_select"]
MatchingTypeType = Literal["exact", "contains", "range", "grade"]
ValueSourceType = Literal["submitted", "user_field", "json_field"]
AggregationModeType = Literal["first", "sum", "max", "count", "any_match", "best_match"]
ProofRequiredType = Literal["not_required", "optional", "required"]
LayoutType = Literal["vertical", "horizontal", "grid"]
GradeEditModeType = Literal["fixed", "score_only", "flexible"]  # 수정불가, 점수만, 자유수정


class FieldSchema(BaseModel):
    """필드 정의 스키마"""
    name: str
    type: str  # text, number, select, date, file, etc.
    label: str
    required: bool = False
    options: Optional[List[str]] = None  # select 타입용
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    validation: Optional[dict] = None  # min, max, pattern 등


class GradeMappingSchema(BaseModel):
    """등급 매핑 스키마"""
    value: Any  # 등급 값 (예: "KSC", "박사", 1000)
    score: float  # 점수
    label: Optional[str] = None  # 표시명
    fixed: bool = False  # 고정 여부


class UnifiedTemplateBase(BaseModel):
    """통합 템플릿 기본 스키마"""
    template_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None

    # 입력 설정
    data_source: DataSourceType = Field(default="form_input", description="데이터 소스")
    source_field: Optional[str] = Field(default=None, description="user_profile일 때 필드명")
    display_only: bool = Field(default=False, description="읽기 전용 여부")
    fields_schema: str = Field(default="[]", description="필드 정의 JSON")
    layout_type: LayoutType = Field(default="vertical", description="레이아웃 유형")
    is_repeatable: bool = Field(default=False, description="반복 입력 허용")
    max_entries: Optional[str] = Field(default=None, description="최대 입력 개수")
    validation_rules: Optional[str] = Field(default=None, description="검증 규칙 JSON")
    help_text: Optional[str] = Field(default=None, description="도움말")
    placeholder: Optional[str] = Field(default=None, max_length=200)

    # 평가 설정
    evaluation_method: EvaluationMethodType = Field(default="standard", description="평가 방법")
    grade_type: Optional[GradeTypeType] = Field(default=None, description="등급 유형")
    matching_type: Optional[MatchingTypeType] = Field(default=None, description="매칭 방식")
    scoring_value_source: Optional[ValueSourceType] = Field(default="submitted", description="값 소스")
    scoring_source_field: Optional[str] = Field(default=None, description="필드명")
    extract_pattern: Optional[str] = Field(default=None, description="JSON 추출 패턴")
    aggregation_mode: Optional[AggregationModeType] = Field(default="first", description="집계 방식")
    default_mappings: str = Field(default="[]", description="등급별 점수 매핑 JSON")
    grade_edit_mode: GradeEditModeType = Field(default="flexible", description="등급 수정 모드: fixed(수정불가), score_only(점수만), flexible(자유수정)")
    proof_required: ProofRequiredType = Field(default="optional", description="증빙 필수 여부")
    verification_note: Optional[str] = Field(default=None, description="검증 안내")
    is_required_default: bool = Field(default=False, description="기본 필수 여부")
    allow_multiple: bool = Field(default=False, description="다중 입력 허용")
    auto_confirm_across_projects: bool = Field(default=False, description="타 과제 자동 컨펌")

    # 공통
    keywords: Optional[str] = Field(default=None, description="키워드 JSON")
    is_active: bool = Field(default=True)


class UnifiedTemplateCreate(UnifiedTemplateBase):
    """통합 템플릿 생성 스키마"""
    template_id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")


class UnifiedTemplateUpdate(BaseModel):
    """통합 템플릿 수정 스키마 (모든 필드 Optional)"""
    template_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None

    # 입력 설정
    data_source: Optional[DataSourceType] = None
    source_field: Optional[str] = None
    display_only: Optional[bool] = None
    fields_schema: Optional[str] = None
    layout_type: Optional[LayoutType] = None
    is_repeatable: Optional[bool] = None
    max_entries: Optional[str] = None
    validation_rules: Optional[str] = None
    help_text: Optional[str] = None
    placeholder: Optional[str] = None

    # 평가 설정
    evaluation_method: Optional[EvaluationMethodType] = None
    grade_type: Optional[GradeTypeType] = None
    matching_type: Optional[MatchingTypeType] = None
    scoring_value_source: Optional[ValueSourceType] = None
    scoring_source_field: Optional[str] = None
    extract_pattern: Optional[str] = None
    aggregation_mode: Optional[AggregationModeType] = None
    default_mappings: Optional[str] = None
    grade_edit_mode: Optional[GradeEditModeType] = None
    proof_required: Optional[ProofRequiredType] = None
    verification_note: Optional[str] = None
    is_required_default: Optional[bool] = None
    allow_multiple: Optional[bool] = None
    auto_confirm_across_projects: Optional[bool] = None

    # 공통
    keywords: Optional[str] = None
    is_active: Optional[bool] = None


class UnifiedTemplateResponse(UnifiedTemplateBase):
    """통합 템플릿 응답 스키마"""
    template_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    # 계산된 필드
    has_scoring: bool = False
    is_certification: bool = False

    class Config:
        from_attributes = True

    @field_serializer('data_source', 'evaluation_method', 'proof_required', 'layout_type', 'grade_edit_mode')
    def serialize_to_lower(self, v: str) -> str:
        """Enum 값을 소문자로 직렬화"""
        if v is None:
            return v
        return v.lower() if isinstance(v, str) else str(v).lower()

    @field_serializer('grade_type', 'matching_type', 'scoring_value_source', 'aggregation_mode')
    def serialize_optional_to_lower(self, v: Optional[str]) -> Optional[str]:
        """Optional Enum 값을 소문자로 직렬화"""
        if v is None:
            return v
        return v.lower() if isinstance(v, str) else str(v).lower()


class UnifiedTemplateListResponse(BaseModel):
    """통합 템플릿 목록 응답"""
    templates: List[UnifiedTemplateResponse]
    total: int


class EffectiveScoringConfig(BaseModel):
    """실제 적용될 평가 설정"""
    grade_type: Optional[str] = None
    matching_type: Optional[str] = None
    default_mappings: List[GradeMappingSchema] = []
    grade_edit_mode: str = "flexible"  # fixed, score_only, flexible
    scoring_value_source: Optional[str] = None
    scoring_source_field: Optional[str] = None
    extract_pattern: Optional[str] = None
    aggregation_mode: Optional[str] = None
