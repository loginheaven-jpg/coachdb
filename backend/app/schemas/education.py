from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class CoachEducationHistoryBase(BaseModel):
    """교육이력 기본 스키마"""
    education_name: str = Field(..., max_length=200, description="교육명")
    institution: Optional[str] = Field(None, max_length=200, description="교육기관")
    completion_date: Optional[date] = Field(None, description="이수일")
    hours: Optional[int] = Field(None, ge=0, description="교육시간")
    certificate_file_id: Optional[int] = Field(None, description="수료증 파일 ID")


class CoachEducationHistoryCreate(CoachEducationHistoryBase):
    """교육이력 생성 스키마"""
    pass


class CoachEducationHistoryUpdate(BaseModel):
    """교육이력 업데이트 스키마"""
    education_name: Optional[str] = Field(None, max_length=200, description="교육명")
    institution: Optional[str] = Field(None, max_length=200, description="교육기관")
    completion_date: Optional[date] = Field(None, description="이수일")
    hours: Optional[int] = Field(None, ge=0, description="교육시간")
    certificate_file_id: Optional[int] = Field(None, description="수료증 파일 ID")


class CoachEducationHistoryResponse(CoachEducationHistoryBase):
    """교육이력 응답 스키마"""
    education_id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
