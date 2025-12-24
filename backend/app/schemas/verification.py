from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.schemas.competency import FileBasicInfo


class VerificationRecordResponse(BaseModel):
    record_id: int
    competency_id: int
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

    class Config:
        from_attributes = True


class VerificationConfirmRequest(BaseModel):
    """증빙 컨펌 요청"""
    competency_id: int


class VerificationResetRequest(BaseModel):
    """증빙 검증 리셋 요청"""
    competency_id: int
    reason: Optional[str] = None


class VerificationSupplementRequest(BaseModel):
    """증빙 보완 요청 (Verifier가 코치에게)"""
    reason: str = Field(..., min_length=1, max_length=1000, description="보완 요청 사유")


class PendingVerificationItem(BaseModel):
    """검증 대기 중인 증빙 항목"""
    competency_id: int
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

    class Config:
        from_attributes = True
