"""
Notification service with email integration
"""
from datetime import datetime
from typing import Optional
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.core.email import send_notification_email
from app.core.config import settings

logger = logging.getLogger(__name__)


async def create_notification_with_email(
    db: AsyncSession,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: Optional[str] = None,
    related_application_id: Optional[int] = None,
    related_project_id: Optional[int] = None,
    related_data_id: Optional[int] = None,
    related_competency_id: Optional[int] = None,
    send_email: bool = True,
    **email_context
) -> Notification:
    """
    Create a notification and optionally send an email

    Args:
        db: Database session
        user_id: Target user ID
        notification_type: Type of notification
        title: Notification title
        message: Notification message
        related_application_id: Related application ID
        related_project_id: Related project ID
        related_data_id: Related data ID (ApplicationData)
        related_competency_id: Related competency ID
        send_email: Whether to send email notification
        **email_context: Additional context for email template
            - action_url: URL for the action button
            - project_name: Related project name
            - item_name: Related item name
            - deadline: Deadline for supplement
            - result: Selection result ('selected' or 'rejected')
            - status: Verification status ('approved' or 'rejected')

    Returns:
        Created Notification object
    """
    # Create notification
    notification = Notification(
        user_id=user_id,
        type=notification_type.value if isinstance(notification_type, NotificationType) else notification_type,
        title=title,
        message=message,
        related_application_id=related_application_id,
        related_project_id=related_project_id,
        related_data_id=related_data_id,
        related_competency_id=related_competency_id,
        email_sent=False
    )

    db.add(notification)

    # Send email if enabled
    if send_email:
        try:
            # Get user info
            result = await db.execute(
                select(User).where(User.user_id == user_id)
            )
            user = result.scalar_one_or_none()

            if user and user.email:
                # Build action URL if not provided
                if "action_url" not in email_context:
                    email_context["action_url"] = settings.FRONTEND_URL

                email_success = await send_notification_email(
                    to_email=user.email,
                    notification_type=notification_type.value if isinstance(notification_type, NotificationType) else notification_type,
                    title=title,
                    message=message,
                    user_name=user.name,
                    **email_context
                )

                if email_success:
                    notification.email_sent = True
                    notification.email_sent_at = datetime.utcnow()
                    logger.info(f"Notification email sent to user {user_id}: {title}")
                else:
                    logger.warning(f"Failed to send notification email to user {user_id}")
            else:
                logger.warning(f"User {user_id} has no email address")

        except Exception as e:
            logger.error(f"Error sending notification email: {str(e)}")

    await db.flush()
    return notification


async def send_supplement_request_notification(
    db: AsyncSession,
    user_id: int,
    application_id: int,
    project_id: int,
    data_id: int,
    item_name: str,
    reason: str,
    project_name: Optional[str] = None,
    deadline: Optional[str] = None
) -> Notification:
    """Send notification for supplement request (서류 보충 요청)"""
    title = f"서류 보충이 필요합니다: {item_name}"

    return await create_notification_with_email(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.SUPPLEMENT_REQUEST,
        title=title,
        message=reason,
        related_application_id=application_id,
        related_project_id=project_id,
        related_data_id=data_id,
        action_url=f"{settings.FRONTEND_URL}/applications/{application_id}",
        project_name=project_name,
        item_name=item_name,
        deadline=deadline
    )


async def send_verification_supplement_notification(
    db: AsyncSession,
    user_id: int,
    competency_id: int,
    item_name: str,
    reason: str
) -> Notification:
    """Send notification for verification supplement request (증빙 보완 요청)"""
    title = f"증빙 보완이 필요합니다: {item_name}"

    return await create_notification_with_email(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.VERIFICATION_SUPPLEMENT_REQUEST,
        title=title,
        message=reason,
        related_competency_id=competency_id,
        action_url=f"{settings.FRONTEND_URL}/profile/competencies",
        item_name=item_name
    )


async def send_verification_complete_notification(
    db: AsyncSession,
    user_id: int,
    competency_id: int,
    item_name: str,
    is_approved: bool,
    message: Optional[str] = None
) -> Notification:
    """Send notification for verification completion (증빙 검증 완료)"""
    status = "approved" if is_approved else "rejected"
    title = f"증빙 검증이 완료되었습니다: {item_name}"

    return await create_notification_with_email(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.VERIFICATION_COMPLETED,
        title=title,
        message=message,
        related_competency_id=competency_id,
        action_url=f"{settings.FRONTEND_URL}/profile/competencies",
        item_name=item_name,
        status=status
    )


async def send_review_complete_notification(
    db: AsyncSession,
    user_id: int,
    application_id: int,
    project_id: int,
    project_name: str,
    message: Optional[str] = None
) -> Notification:
    """Send notification for review completion (심사 완료)"""
    title = f"심사가 완료되었습니다: {project_name}"

    return await create_notification_with_email(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.REVIEW_COMPLETE,
        title=title,
        message=message,
        related_application_id=application_id,
        related_project_id=project_id,
        action_url=f"{settings.FRONTEND_URL}/applications/{application_id}",
        project_name=project_name
    )


async def send_selection_result_notification(
    db: AsyncSession,
    user_id: int,
    application_id: int,
    project_id: int,
    project_name: str,
    is_selected: bool,
    message: Optional[str] = None
) -> Notification:
    """Send notification for selection result (선발 결과)"""
    result = "selected" if is_selected else "rejected"
    title = f"선발 결과 안내: {project_name}"

    return await create_notification_with_email(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.SELECTION_RESULT,
        title=title,
        message=message,
        related_application_id=application_id,
        related_project_id=project_id,
        action_url=f"{settings.FRONTEND_URL}/applications/{application_id}",
        project_name=project_name,
        result=result
    )
