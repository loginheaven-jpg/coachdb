from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date, datetime
from app.models.application import CoachRole


# ============================================================================
# Application Data Schemas (Survey Item Responses)
# ============================================================================
class ApplicationDataSubmit(BaseModel):
    """Schema for submitting application data (survey item response)"""
    item_id: int
    submitted_value: Optional[str] = None
    submitted_file_id: Optional[int] = None


class ApplicationDataResponse(BaseModel):
    """Application data response schema"""
    data_id: int
    application_id: int
    item_id: int
    competency_id: Optional[int] = None
    submitted_value: Optional[str] = None
    submitted_file_id: Optional[int] = None
    verification_status: str
    item_score: Optional[float] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    # 보충 요청 관련
    supplement_deadline: Optional[datetime] = None
    supplement_requested_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Supplement Request/Submit Schemas
# ============================================================================
class SupplementRequest(BaseModel):
    """보충 요청 스키마"""
    rejection_reason: str  # 미비 사유
    deadline_days: int = 3  # 보충 기한 (일 수)


class SupplementSubmit(BaseModel):
    """보충 제출 스키마"""
    submitted_value: Optional[str] = None
    submitted_file_id: Optional[int] = None


# ============================================================================
# Application Base Schemas
# ============================================================================
class ApplicationBase(BaseModel):
    """Base application schema"""
    motivation: Optional[str] = None
    applied_role: Optional[CoachRole] = None


class ApplicationCreate(ApplicationBase):
    """Schema for creating a new application"""
    project_id: int


class ApplicationUpdate(ApplicationBase):
    """Schema for updating an application"""
    pass


class ApplicationResponse(ApplicationBase):
    """Application response schema"""
    application_id: int
    project_id: int
    user_id: int
    status: str
    auto_score: Optional[float] = None
    final_score: Optional[float] = None
    score_visibility: str
    can_submit: bool
    selection_result: str
    submitted_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Custom Question Answer Schemas for Application
# ============================================================================
class CustomAnswerSubmit(BaseModel):
    """Schema for submitting a custom question answer"""
    question_id: int
    answer_text: Optional[str] = None
    answer_file_id: Optional[int] = None


class ApplicationSubmitRequest(BaseModel):
    """Schema for submitting an application with survey data and custom answers"""
    motivation: Optional[str] = None
    applied_role: Optional[CoachRole] = None
    custom_answers: List[CustomAnswerSubmit] = []
    application_data: List[ApplicationDataSubmit] = []  # Survey item responses


# ============================================================================
# Participation Project Response (Legacy)
# ============================================================================
class ParticipationProjectResponse(BaseModel):
    """참여 과제 리스트 응답 스키마"""
    application_id: int
    project_id: int
    project_name: str
    recruitment_start_date: date
    recruitment_end_date: date
    application_status: str
    document_verification_status: str  # "pending", "approved", "rejected", "partial", "supplement_requested"
    review_score: Optional[float]
    selection_result: str  # "pending", "selected", "rejected"
    submitted_at: Optional[datetime]
    # New fields
    motivation: Optional[str] = None
    applied_role: Optional[str] = None
    # 보충 요청 관련
    has_supplement_request: bool = False  # 보충 요청이 있는 항목 존재 여부
    supplement_count: int = 0  # 보충 요청 항목 개수

    class Config:
        from_attributes = True
