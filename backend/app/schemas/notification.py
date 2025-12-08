from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationCreate(BaseModel):
    """알림 생성 스키마"""
    user_id: int
    type: str
    title: str
    message: Optional[str] = None
    related_application_id: Optional[int] = None
    related_project_id: Optional[int] = None
    related_data_id: Optional[int] = None


class NotificationResponse(BaseModel):
    """알림 응답 스키마"""
    notification_id: int
    user_id: int
    type: str
    title: str
    message: Optional[str] = None
    related_application_id: Optional[int] = None
    related_project_id: Optional[int] = None
    related_data_id: Optional[int] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    """알림 업데이트 스키마 (읽음 처리)"""
    is_read: bool = True
