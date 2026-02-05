"""
평가 템플릿 (Scoring Template) 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Literal
from datetime import datetime


# 타입 정의
GradeType = Literal["string", "numeric", "file_exists", "multi_select"]
MatchingType = Literal["exact", "contains", "range", "grade"]
ValueSource = Literal["submitted", "user_field", "json_field"]
AggregationMode = Literal["first", "sum", "max", "count", "any_match", "best_match"]
ProofRequired = Literal["not_required", "optional", "required"]


class GradeMappingSchema(BaseModel):
    """등급 매핑 스키마 (default_mappings JSON 배열의 각 요소)"""
    value: Any  # 등급 값 (예: "KSC", "박사", 1000)
    score: float  # 점수
    label: Optional[str] = None  # 표시명
    fixed: bool = False  # 고정 여부


class ScoringTemplateBase(BaseModel):
    """평가 템플릿 기본 스키마"""
    template_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None

    # 평가 설정
    grade_type: GradeType = Field(default="string", description="등급 유형")
    matching_type: MatchingType = Field(default="exact", description="매칭 방식")
    value_source: ValueSource = Field(default="submitted", description="값 소스")
    source_field: Optional[str] = Field(default=None, description="필드명")
    extract_pattern: Optional[str] = Field(default=None, description="JSON 추출 패턴")
    aggregation_mode: AggregationMode = Field(default="first", description="집계 방식")

    # 등급 매핑 (JSON 문자열)
    default_mappings: str = Field(default="[]", description="등급별 점수 매핑 JSON")

    # 템플릿 특성
    fixed_grades: bool = Field(default=False, description="등급 고정 여부")
    allow_add_grades: bool = Field(default=True, description="등급 추가 허용")
    proof_required: ProofRequired = Field(default="optional", description="증빙 필수 여부")
    verification_note: Optional[str] = Field(default=None, description="검증 안내")

    # 항목 설정 기본값
    is_required_default: bool = Field(default=False, description="기본 필수 여부")
    allow_multiple: bool = Field(default=False, description="다중 입력 허용")

    # 자동 컨펌 정책
    auto_confirm_across_projects: bool = Field(default=False, description="타 과제 자동 컨펌")

    # 키워드 (JSON 문자열)
    keywords: Optional[str] = Field(default=None, description="키워드 JSON")

    is_active: bool = Field(default=True)


class ScoringTemplateCreate(ScoringTemplateBase):
    """평가 템플릿 생성 스키마"""
    template_id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")


class ScoringTemplateUpdate(BaseModel):
    """평가 템플릿 수정 스키마 (모든 필드 Optional)"""
    template_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None

    grade_type: Optional[GradeType] = None
    matching_type: Optional[MatchingType] = None
    value_source: Optional[ValueSource] = None
    source_field: Optional[str] = None
    extract_pattern: Optional[str] = None
    aggregation_mode: Optional[AggregationMode] = None

    default_mappings: Optional[str] = None

    fixed_grades: Optional[bool] = None
    allow_add_grades: Optional[bool] = None
    proof_required: Optional[ProofRequired] = None
    verification_note: Optional[str] = None

    is_required_default: Optional[bool] = None
    allow_multiple: Optional[bool] = None

    auto_confirm_across_projects: Optional[bool] = None
    keywords: Optional[str] = None
    is_active: Optional[bool] = None


class ScoringTemplateResponse(ScoringTemplateBase):
    """평가 템플릿 응답 스키마"""
    template_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScoringTemplateListResponse(BaseModel):
    """평가 템플릿 목록 응답"""
    templates: List[ScoringTemplateResponse]
    total: int
