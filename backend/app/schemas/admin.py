from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ============================================================================
# System Config Schemas
# ============================================================================
class SystemConfigResponse(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True


class SystemConfigUpdate(BaseModel):
    value: str


class SystemConfigBulkUpdate(BaseModel):
    """여러 설정을 한번에 업데이트"""
    configs: dict[str, str]  # key -> value


# ============================================================================
# User Role Management Schemas
# ============================================================================
class UserListResponse(BaseModel):
    user_id: int
    email: str
    name: str
    roles: List[str]
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserRoleUpdate(BaseModel):
    roles: List[str]


class UserDetailResponse(BaseModel):
    user_id: int
    email: str
    name: str
    phone: Optional[str] = None
    roles: List[str]
    status: str
    created_at: Optional[datetime] = None
    birth_year: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# Role Request Schemas
# ============================================================================
class RoleRequestResponse(BaseModel):
    """Role request information for admin view"""
    request_id: int
    user_id: int
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    requested_role: str
    status: str  # PENDING, APPROVED, REJECTED
    requested_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    processed_by: Optional[int] = None
    processor_name: Optional[str] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True


class RoleRequestReject(BaseModel):
    """Request body for rejecting a role request"""
    reason: str
