from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Literal
from datetime import datetime
from app.schemas.competency import FileBasicInfo


class VerificationRecordResponse(BaseModel):
    record_id: int
    competency_id: Optional[int] = None  # CoachCompetency용
    application_data_id: Optional[int] = None  # ApplicationData용
    verifier_id: int
    verifier_name: Optional[str] = None
    verified_at: datetime
    is_valid: bool

    class Config:
        from_attributes = True


class ActivityRecord(BaseModel):
    """검증 관련 활동 기록 (컨펌, 보완요청, 리셋)"""
    activity_type: str  # "confirm" | "supplement_request" | "reset"
    actor_name: str  # 검토자/관리자 이름
    message: Optional[str] = None  # 보완요청/리셋 사유
    created_at: datetime
    is_valid: bool = True  # 컨펌 유효 여부 (confirm 타입만 해당)

    class Config:
        from_attributes = True


class CompetencyVerificationStatus(BaseModel):
    """증빙의 검증 상태 정보"""
    competency_id: int
    user_id: int
    user_name: Optional[str] = None
    item_id: int
    item_name: Optional[str] = None
    value: Optional[str] = None
    file_id: Optional[int] = None
    file_info: Optional[FileBasicInfo] = None  # 파일 메타데이터
    is_globally_verified: bool
    globally_verified_at: Optional[datetime] = None
    verification_count: int  # 현재 유효한 컨펌 수
    required_count: int  # 필요한 컨펌 수
    records: List[VerificationRecordResponse] = []  # 기존 유지 (호환성)
    activities: List[ActivityRecord] = []  # 통합 활동 기록 (컨펌 + 보완요청 + 리셋)
    my_verification: Optional[VerificationRecordResponse] = None  # 현재 사용자의 컨펌 여부

    class Config:
        from_attributes = True


class VerificationConfirmRequest(BaseModel):
    """증빙 컨펌 요청 - competency_id 또는 application_data_id 중 하나 필수"""
    competency_id: Optional[int] = None
    application_data_id: Optional[int] = None

    @model_validator(mode='after')
    def check_one_id(self):
        if self.competency_id is None and self.application_data_id is None:
            raise ValueError('competency_id 또는 application_data_id 중 하나는 필수입니다')
        if self.competency_id is not None and self.application_data_id is not None:
            raise ValueError('competency_id와 application_data_id 중 하나만 설정해야 합니다')
        return self


class VerificationResetRequest(BaseModel):
    """증빙 검증 리셋 요청"""
    competency_id: int
    reason: Optional[str] = None


class VerificationSupplementRequest(BaseModel):
    """증빙 보완 요청 (Verifier가 코치에게)"""
    reason: str = Field(..., min_length=1, max_length=1000, description="보완 요청 사유")


class PendingVerificationItem(BaseModel):
    """검증 대기 중인 증빙 항목

    source: 'competency' | 'application_data' - 항목의 출처
    """
    # 공통 필드
    source: Literal['competency', 'application_data'] = 'competency'  # 항목 출처
    competency_id: Optional[int] = None  # CoachCompetency인 경우
    application_data_id: Optional[int] = None  # ApplicationData인 경우
    user_id: int
    user_name: str
    user_email: str
    item_id: int
    item_name: str
    item_code: str
    value: Optional[str] = None
    file_id: Optional[int] = None
    file_info: Optional[FileBasicInfo] = None  # 파일 메타데이터
    created_at: datetime
    verification_count: int
    required_count: int
    my_verification: Optional[VerificationRecordResponse] = None  # 현재 사용자의 컨펌 여부
    verification_status: Optional[str] = None  # 검증 상태 (pending/rejected)
    rejection_reason: Optional[str] = None  # 보완 요청 사유

    # ApplicationData 전용 필드
    application_id: Optional[int] = None  # 해당 지원서 ID
    project_id: Optional[int] = None  # 해당 과제 ID
    project_name: Optional[str] = None  # 과제명

    class Config:
        from_attributes = True
