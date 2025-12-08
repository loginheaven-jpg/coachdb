"""
Certification schemas
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date, datetime
from app.models.certification import CertificationType


# Base schemas
class CertificationBase(BaseModel):
    certification_type: CertificationType
    certification_name: str = Field(..., min_length=1, max_length=200)
    issuing_organization: Optional[str] = Field(None, max_length=200)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    certificate_number: Optional[str] = Field(None, max_length=100)
    certificate_file_id: Optional[int] = None


# Request schemas
class CertificationCreate(CertificationBase):
    """자격증 생성 요청"""
    pass


class CertificationUpdate(BaseModel):
    """자격증 수정 요청"""
    certification_name: Optional[str] = Field(None, min_length=1, max_length=200)
    issuing_organization: Optional[str] = Field(None, max_length=200)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    certificate_number: Optional[str] = Field(None, max_length=100)
    certificate_file_id: Optional[int] = None


# Response schemas
class CertificationResponse(CertificationBase):
    """자격증 응답"""
    model_config = ConfigDict(from_attributes=True)

    certification_id: int
    user_id: int
    verification_status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    # File info (populated from join)
    certificate_file: Optional[dict] = None


class CertificationListItem(BaseModel):
    """자격증 목록 아이템"""
    model_config = ConfigDict(from_attributes=True)

    certification_id: int
    certification_type: CertificationType
    certification_name: str
    issuing_organization: Optional[str] = None
    issue_date: Optional[date] = None
    verification_status: str
    has_file: bool = False
