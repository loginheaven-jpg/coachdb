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
    # Include project name in title for better context
    if project_name:
        title = f"[{project_name}] 서류 보충이 필요합니다: {item_name}"
    else:
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


async def send_application_draft_notification(
    db: AsyncSession,
    user_id: int,
    application_id: int,
    project_id: int,
    project_name: str
) -> Notification:
    """Send notification for application draft save (응모 임시저장)"""
    title = f"응모 임시저장: {project_name}"
    message = f"{project_name} 과제에 응모하고 임시저장하였습니다. 아직 제출된 상태는 아닙니다."

    return await create_notification_with_email(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.APPLICATION_DRAFT_SAVED,
        title=title,
        message=message,
        related_application_id=application_id,
        related_project_id=project_id,
        send_email=False,  # 임시저장은 이메일 발송 안 함
        action_url=f"{settings.FRONTEND_URL}/coach/projects/{project_id}/apply?applicationId={application_id}",
        project_name=project_name
    )


async def send_application_submit_notification(
    db: AsyncSession,
    user_id: int,
    application_id: int,
    project_id: int,
    project_name: str
) -> Notification:
    """Send notification for application submission (응모 제출완료)"""
    title = f"응모 제출완료: {project_name}"
    message = f"{project_name} 과제에 응모하고 제출완료하였습니다. 모집기간동안에는 수정할 수 있습니다."

    return await create_notification_with_email(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.APPLICATION_SUBMITTED,
        title=title,
        message=message,
        related_application_id=application_id,
        related_project_id=project_id,
        send_email=False,  # 제출완료도 이메일 발송 안 함 (필요 시 True로 변경)
        action_url=f"{settings.FRONTEND_URL}/coach/projects/{project_id}/apply?applicationId={application_id}&mode=view",
        project_name=project_name
    )


async def cleanup_old_notifications(
    db: AsyncSession,
    user_id: int,
    max_count: int = 20
) -> int:
    """
    Delete old notifications if user has more than max_count

    Returns:
        Number of deleted notifications
    """
    from sqlalchemy import func, delete

    # Count total notifications for user
    count_result = await db.execute(
        select(func.count(Notification.notification_id)).where(
            Notification.user_id == user_id
        )
    )
    total_count = count_result.scalar() or 0

    if total_count <= max_count:
        return 0

    # Find notification IDs to keep (most recent max_count)
    keep_query = select(Notification.notification_id).where(
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc()).limit(max_count)

    keep_result = await db.execute(keep_query)
    keep_ids = [row[0] for row in keep_result.fetchall()]

    # Delete old notifications
    delete_count = total_count - max_count
    delete_stmt = delete(Notification).where(
        Notification.user_id == user_id,
        Notification.notification_id.notin_(keep_ids)
    )

    await db.execute(delete_stmt)
    logger.info(f"Deleted {delete_count} old notifications for user {user_id}")

    return delete_count
