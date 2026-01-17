from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from app.models.project import ProjectStatus, ProjectType
from app.models.competency import ProofRequiredLevel
from app.schemas.competency import ProjectItemCreate

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))


def calculate_display_status(
    status: ProjectStatus,
    recruitment_start_date: Optional[date],
    recruitment_end_date: Optional[date]
) -> str:
    """
    DB 상태와 날짜를 기반으로 표시용 상태를 계산합니다.
    한국 시간대(KST)를 기준으로 계산합니다.

    - draft → "draft" (초안)
    - pending → "pending" (승인대기)
    - approved → "approved" (승인완료, 모집개시 전)
    - rejected → "rejected" (반려됨)
    - ready + 오늘 < 모집시작일 → "recruiting_wait" (모집대기)
    - ready + 모집시작일 ≤ 오늘 ≤ 모집종료일 → "recruiting" (모집중)
    - ready + 오늘 > 모집종료일 → "recruiting_ended" (모집종료)
    - 그 외 → DB 상태 그대로
    """
    if status == ProjectStatus.READY:
        # 날짜가 없으면 기본 상태 반환
        if not recruitment_start_date or not recruitment_end_date:
            return status.value
        # 한국 시간대 기준으로 오늘 날짜 계산
        today = datetime.now(KST).date()
        if today < recruitment_start_date:
            return "pending"  # 모집대기
        elif today <= recruitment_end_date:
            return "recruiting"  # 모집중
        else:
            return "recruiting_ended"  # 모집종료 (심사중으로 전환 필요)
    return status.value


# ============================================================================
# User Basic Info
# ============================================================================
class UserBasicInfo(BaseModel):
    """Basic user information for nested responses"""
    user_id: int
    username: str
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# Project Schemas
# ============================================================================
class ProjectBase(BaseModel):
    """Base project schema with common fields"""
    project_name: str = Field(..., max_length=200)
    project_type: Optional[ProjectType] = ProjectType.OTHER  # 과제 구분
    description: Optional[str] = None
    support_program_name: Optional[str] = Field(None, max_length=200)
    recruitment_start_date: date
    recruitment_end_date: date
    project_start_date: Optional[date] = None
    project_end_date: Optional[date] = None
    max_participants: int = Field(..., gt=0)
    project_manager_id: Optional[int] = None


class ProjectCreate(ProjectBase):
    """Schema for creating a new project"""
    status: Optional[ProjectStatus] = ProjectStatus.DRAFT


# CustomQuestionCreateExtended는 ProjectCreateExtended보다 먼저 정의되어야 함
class CustomQuestionCreateExtended(BaseModel):
    """Extended schema for creating custom question (프로젝트 생성 시)"""
    question_text: str = Field(..., max_length=500)
    question_type: str = Field(default="text", pattern="^(text|textarea|select|file)$")
    is_required: bool = False
    display_order: int = Field(default=0, ge=0)
    options: Optional[str] = None
    # 추가 필드
    allows_text: bool = True
    allows_file: bool = False
    file_required: bool = False
    # 평가 관련 필드
    is_evaluation_item: bool = False  # 평가 항목 여부
    max_score: Optional[Decimal] = Field(None, ge=0)  # 평가 항목이면 점수 설정
    proof_required_level: ProofRequiredLevel = ProofRequiredLevel.NOT_REQUIRED  # 증빙 필요성
    scoring_rules: Optional[str] = None  # 평가 기준 (JSON string)


class ProjectCreateExtended(ProjectCreate):
    """Extended schema for creating project with all details (3-step wizard)"""
    # 2단계: 모집설문
    project_items: List[ProjectItemCreate] = []  # 기존 역량 항목 선택
    custom_questions: List[CustomQuestionCreateExtended] = []  # 커스텀 질문

    # 3단계: 심사위원 지정
    staff_user_ids: List[int] = []  # 심사위원 ID 목록


class ProjectUpdate(BaseModel):
    """Schema for updating a project"""
    project_name: Optional[str] = Field(None, max_length=200)
    project_type: Optional[ProjectType] = None  # 과제 구분
    description: Optional[str] = None
    support_program_name: Optional[str] = Field(None, max_length=200)
    recruitment_start_date: Optional[date] = None
    recruitment_end_date: Optional[date] = None
    project_start_date: Optional[date] = None
    project_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    overall_feedback: Optional[str] = None
    status: Optional[ProjectStatus] = None
    max_participants: Optional[int] = Field(None, gt=0)
    project_manager_id: Optional[int] = None


class ProjectResponse(ProjectBase):
    """Basic project response schema"""
    project_id: int
    status: ProjectStatus
    display_status: Optional[str] = None  # 표시용 상태 (모집대기/모집중 등)
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    overall_feedback: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with relationships"""
    creator: Optional[UserBasicInfo] = None
    project_manager: Optional[UserBasicInfo] = None
    application_count: Optional[int] = None
    selected_count: Optional[int] = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Project list response for efficient queries"""
    project_id: int
    project_name: str
    project_type: Optional[ProjectType] = None  # 과제 구분
    recruitment_start_date: date
    recruitment_end_date: date
    project_start_date: Optional[date] = None
    project_end_date: Optional[date] = None
    status: ProjectStatus
    display_status: Optional[str] = None  # 표시용 상태 (모집대기/모집중 등)
    max_participants: int
    application_count: Optional[int] = None
    current_participants: Optional[int] = None  # 확정된 참여자 수
    created_by: int  # 생성자 ID
    project_manager_id: Optional[int] = None  # 과제관리자 ID
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Custom Question Schemas
# ============================================================================
class CustomQuestionBase(BaseModel):
    """Base custom question schema"""
    question_text: str = Field(..., max_length=500)
    question_type: str = Field(default="text", pattern="^(text|textarea|select|file)$")
    is_required: bool = False
    display_order: int = Field(default=0, ge=0)
    options: Optional[str] = None  # JSON string for select options


class CustomQuestionCreate(CustomQuestionBase):
    """Schema for creating a custom question"""
    project_id: int
    allows_text: bool = True
    allows_file: bool = False
    file_required: bool = False
    # 평가 관련 필드
    is_evaluation_item: bool = False
    max_score: Optional[Decimal] = Field(None, ge=0)  # 평가 항목이면 점수 설정
    proof_required_level: ProofRequiredLevel = ProofRequiredLevel.NOT_REQUIRED
    scoring_rules: Optional[str] = None  # JSON string


# CustomQuestionCreateExtended는 파일 상단에 이미 정의됨 (Line 44-55)


class CustomQuestionUpdate(BaseModel):
    """Schema for updating a custom question"""
    question_text: Optional[str] = Field(None, max_length=500)
    question_type: Optional[str] = Field(None, pattern="^(text|textarea|select|file)$")
    is_required: Optional[bool] = None
    display_order: Optional[int] = Field(None, ge=0)
    options: Optional[str] = None
    allows_text: Optional[bool] = None
    allows_file: Optional[bool] = None
    file_required: Optional[bool] = None
    # 평가 관련 필드
    is_evaluation_item: Optional[bool] = None
    max_score: Optional[Decimal] = Field(None, ge=0)
    proof_required_level: Optional[ProofRequiredLevel] = None
    scoring_rules: Optional[str] = None


class CustomQuestionResponse(CustomQuestionBase):
    """Custom question response schema"""
    question_id: int
    project_id: int
    allows_text: bool = True
    allows_file: bool = False
    file_required: bool = False
    # 평가 관련 필드
    is_evaluation_item: bool = False
    max_score: Optional[Decimal] = None
    proof_required_level: ProofRequiredLevel = ProofRequiredLevel.NOT_REQUIRED
    scoring_rules: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Custom Question Answer Schemas
# ============================================================================
class CustomQuestionAnswerBase(BaseModel):
    """Base custom question answer schema"""
    answer_text: Optional[str] = None
    answer_file_id: Optional[int] = None


class CustomQuestionAnswerCreate(CustomQuestionAnswerBase):
    """Schema for creating a custom question answer"""
    application_id: int
    question_id: int


class CustomQuestionAnswerUpdate(CustomQuestionAnswerBase):
    """Schema for updating a custom question answer"""
    pass


class CustomQuestionAnswerResponse(CustomQuestionAnswerBase):
    """Custom question answer response schema"""
    answer_id: int
    application_id: int
    question_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Coach Evaluation Schemas
# ============================================================================
class CoachEvaluationBase(BaseModel):
    """Base coach evaluation schema"""
    participation_score: int = Field(..., ge=1, le=4, description="1=중도이탈, 2=곤란, 3=원만, 4=매우적극")
    feedback_text: Optional[str] = None
    special_notes: Optional[str] = None


class CoachEvaluationCreate(CoachEvaluationBase):
    """Schema for creating a coach evaluation"""
    project_id: int
    coach_user_id: int


class CoachEvaluationUpdate(BaseModel):
    """Schema for updating a coach evaluation"""
    participation_score: Optional[int] = Field(None, ge=1, le=4)
    feedback_text: Optional[str] = None
    special_notes: Optional[str] = None


class CoachEvaluationResponse(CoachEvaluationBase):
    """Coach evaluation response schema"""
    evaluation_id: int
    project_id: int
    coach_user_id: int
    evaluated_by: int
    evaluated_at: datetime
    updated_at: Optional[datetime] = None

    # Include user details
    coach: Optional[UserBasicInfo] = None
    evaluator: Optional[UserBasicInfo] = None

    class Config:
        from_attributes = True


# ============================================================================
# Project Staff (심사자) Schemas
# ============================================================================
class ProjectStaffCreate(BaseModel):
    """Schema for adding a staff member (REVIEWER) to a project"""
    staff_user_id: int


class ProjectStaffResponse(BaseModel):
    """Response schema for project staff"""
    project_id: int
    staff_user_id: int
    assigned_at: datetime
    staff_user: Optional[UserBasicInfo] = None

    class Config:
        from_attributes = True


class ProjectStaffListResponse(BaseModel):
    """List of project staff members"""
    staff_list: List[ProjectStaffResponse]
    total_count: int
