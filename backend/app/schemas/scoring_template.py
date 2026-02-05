"""
평가 템플릿 (Scoring Template) 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class GradeMappingSchema(BaseModel):
    """등급 매핑 스키마 (default_mappings JSON 배열의 각 요소)"""
    value: str  # 등급 값 (예: "KSC", "박사", "1000")
    score: float  # 점수
    label: Optional[str] = None  # 표시명
    fixed: bool = False  # 고정 여부


class ScoringTemplateBase(BaseModel):
    """평가 템플릿 기본 스키마"""
    template_name: str
    description: Optional[str] = None

    # 평가 설정
    grade_type: str  # string, numeric, file_exists, multi_select
    matching_type: str  # exact, contains, range, grade
    value_source: str = "SUBMITTED"  # SUBMITTED, USER_FIELD, JSON_FIELD
    source_field: Optional[str] = None
    aggregation_mode: str = "first"  # first, sum, max, count, any_match, best_match

    # 등급 매핑 (JSON 문자열 또는 리스트)
    default_mappings: str  # JSON string

    # 템플릿 특성
    fixed_grades: bool = False
    allow_add_grades: bool = True
    proof_required: str = "OPTIONAL"  # NOT_REQUIRED, OPTIONAL, REQUIRED
    verification_note: Optional[str] = None

    # 항목 설정 기본값
    is_required_default: bool = False
    allow_multiple: bool = False

    # 자동 컨펌 정책
    auto_confirm_across_projects: bool = False

    # 키워드 (JSON 문자열)
    keywords: Optional[str] = None

    is_active: bool = True


class ScoringTemplateCreate(ScoringTemplateBase):
    """평가 템플릿 생성 스키마"""
    template_id: str  # 사용자가 지정하는 고유 ID (예: "kca_certification")


class ScoringTemplateUpdate(BaseModel):
    """평가 템플릿 수정 스키마 (모든 필드 Optional)"""
    template_name: Optional[str] = None
    description: Optional[str] = None

    grade_type: Optional[str] = None
    matching_type: Optional[str] = None
    value_source: Optional[str] = None
    source_field: Optional[str] = None
    aggregation_mode: Optional[str] = None

    default_mappings: Optional[str] = None

    fixed_grades: Optional[bool] = None
    allow_add_grades: Optional[bool] = None
    proof_required: Optional[str] = None
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
