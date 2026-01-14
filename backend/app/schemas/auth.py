from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole, UserStatus


# Request Schemas
class UserRegister(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    """User registration request"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    birth_year: Optional[int] = Field(default=None, ge=1900, le=2100)  # 4-digit year
    gender: Optional[str] = Field(default=None, max_length=10)
    address: str = Field(..., max_length=500)  # Required: 시/군/구 level
    in_person_coaching_area: Optional[str] = Field(default=None, max_length=500)  # 대면코칭 가능지역
    roles: List[str] = Field(default_factory=lambda: ["coach"])  # Multiple roles possible - accepts strings
    coach_certification_number: Optional[str] = Field(default=None, max_length=50)  # 최상위 자격만
    coaching_fields: Optional[List[str]] = Field(default=None)  # Multiple selection: business, career, youth, adolescent, family, life

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isalpha() for char in v):
            raise ValueError('Password must contain at least one letter')
        return v


class UserLogin(BaseModel):
    """User login request"""
    email: EmailStr
    password: str


class TokenRefresh(BaseModel):
    """Token refresh request"""
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    """Password change request"""
    new_password: str = Field(..., min_length=6, max_length=100)

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v


class UserUpdate(BaseModel):
    """User profile update request"""
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    birth_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    gender: Optional[str] = Field(default=None, max_length=10)
    address: Optional[str] = Field(default=None, max_length=500)
    organization: Optional[str] = Field(default=None, max_length=200)  # 소속
    in_person_coaching_area: Optional[str] = Field(default=None, max_length=500)
    coach_certification_number: Optional[str] = Field(default=None, max_length=50)
    coaching_fields: Optional[List[str]] = Field(default=None)


# Response Schemas
class Token(BaseModel):
    """JWT token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User information response"""
    user_id: int
    email: str
    name: str
    phone: Optional[str]
    birth_year: Optional[int]
    gender: Optional[str]
    address: str
    organization: Optional[str]  # 소속
    in_person_coaching_area: Optional[str]
    roles: str  # JSON string of roles array
    status: UserStatus
    coach_certification_number: Optional[str]
    coaching_fields: Optional[str]  # JSON string
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserWithToken(BaseModel):
    """User with token response"""
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    pending_roles: Optional[List[str]] = None  # Roles awaiting admin approval
    profile_complete: bool = True  # False if required profile fields (name) are missing
