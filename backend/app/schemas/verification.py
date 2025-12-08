from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class VerificationRecordResponse(BaseModel):
    record_id: int
    competency_id: int
    verifier_id: int
    verifier_name: Optional[str] = None
    verified_at: datetime
    is_valid: bool

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
    is_globally_verified: bool
    globally_verified_at: Optional[datetime] = None
    verification_count: int  # 현재 유효한 컨펌 수
    required_count: int  # 필요한 컨펌 수
    records: List[VerificationRecordResponse] = []

    class Config:
        from_attributes = True


class VerificationConfirmRequest(BaseModel):
    """증빙 컨펌 요청"""
    competency_id: int


class VerificationResetRequest(BaseModel):
    """증빙 검증 리셋 요청"""
    competency_id: int
    reason: Optional[str] = None


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
    created_at: datetime
    verification_count: int
    required_count: int
    my_verification: Optional[VerificationRecordResponse] = None  # 현재 사용자의 컨펌 여부

    class Config:
        from_attributes = True
