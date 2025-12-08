from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationUpdate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/my", response_model=List[NotificationResponse])
async def get_my_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's notifications"""
    query = select(Notification).where(
        Notification.user_id == current_user.user_id
    )

    if unread_only:
        query = query.where(Notification.is_read == False)

    query = query.order_by(Notification.created_at.desc()).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        NotificationResponse(
            notification_id=n.notification_id,
            user_id=n.user_id,
            type=n.type,
            title=n.title,
            message=n.message,
            related_application_id=n.related_application_id,
            related_project_id=n.related_project_id,
            related_data_id=n.related_data_id,
            is_read=n.is_read,
            read_at=n.read_at,
            created_at=n.created_at
        )
        for n in notifications
    ]


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get count of unread notifications"""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.user_id,
            Notification.is_read == False
        )
    )
    notifications = result.scalars().all()
    return {"count": len(notifications)}


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await db.execute(
        select(Notification).where(Notification.notification_id == notification_id)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    if notification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your notification"
        )

    notification.is_read = True
    notification.read_at = datetime.now()

    await db.commit()
    await db.refresh(notification)

    return NotificationResponse(
        notification_id=notification.notification_id,
        user_id=notification.user_id,
        type=notification.type,
        title=notification.title,
        message=notification.message,
        related_application_id=notification.related_application_id,
        related_project_id=notification.related_project_id,
        related_data_id=notification.related_data_id,
        is_read=notification.is_read,
        read_at=notification.read_at,
        created_at=notification.created_at
    )


@router.put("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read"""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.user_id,
            Notification.is_read == False
        )
        .values(is_read=True, read_at=datetime.now())
    )
    await db.commit()

    return {"message": "All notifications marked as read"}
