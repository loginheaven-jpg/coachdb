"""
입력 템플릿 (InputTemplate) Pydantic 스키마
"""
from typing import Optional, List, Any
from pydantic import BaseModel, Field
from datetime import datetime


class FieldSchema(BaseModel):
    """입력 필드 스키마"""
    name: str = Field(..., description="필드 이름 (영문)")
    type: str = Field(..., description="필드 타입 (text, number, select, multiselect, file, date)")
    label: str = Field(..., description="필드 레이블 (표시명)")
    required: bool = Field(default=False, description="필수 여부")
    options: Optional[List[str]] = Field(default=None, description="선택 옵션 (select/multiselect용)")
    placeholder: Optional[str] = Field(default=None, description="입력 힌트")
    default_value: Optional[Any] = Field(default=None, description="기본값")
    validation: Optional[dict] = Field(default=None, description="검증 규칙")


class InputTemplateBase(BaseModel):
    """입력 템플릿 기본 스키마"""
    template_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

    # 필드 스키마 (JSON 문자열)
    fields_schema: str = Field(default="[]", description="필드 정의 JSON")

    # 레이아웃
    layout_type: str = Field(default="vertical", description="레이아웃 유형")

    # 입력 특성
    is_repeatable: bool = Field(default=False, description="다중 입력 허용")
    max_entries: Optional[str] = Field(default=None, description="최대 입력 수")

    # 파일 설정
    allow_file_upload: bool = Field(default=False)
    file_required: bool = Field(default=False)
    allowed_file_types: Optional[str] = Field(default=None, description="허용 파일 형식 JSON")

    # 검증/도움말
    validation_rules: Optional[str] = Field(default=None, description="검증 규칙 JSON")
    help_text: Optional[str] = None
    placeholder: Optional[str] = None

    # 키워드
    keywords: Optional[str] = Field(default=None, description="키워드 JSON")


class InputTemplateCreate(InputTemplateBase):
    """입력 템플릿 생성 스키마"""
    template_id: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    is_active: bool = Field(default=True)


class InputTemplateUpdate(BaseModel):
    """입력 템플릿 수정 스키마"""
    template_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    fields_schema: Optional[str] = None
    layout_type: Optional[str] = None
    is_repeatable: Optional[bool] = None
    max_entries: Optional[str] = None
    allow_file_upload: Optional[bool] = None
    file_required: Optional[bool] = None
    allowed_file_types: Optional[str] = None
    validation_rules: Optional[str] = None
    help_text: Optional[str] = None
    placeholder: Optional[str] = None
    keywords: Optional[str] = None
    is_active: Optional[bool] = None


class InputTemplateResponse(InputTemplateBase):
    """입력 템플릿 응답 스키마"""
    template_id: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InputTemplateListResponse(BaseModel):
    """입력 템플릿 목록 응답"""
    templates: List[InputTemplateResponse]
    total: int
