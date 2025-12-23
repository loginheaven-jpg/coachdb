"""
Email service for sending various notification emails
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from pathlib import Path
import logging

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

logger = logging.getLogger(__name__)

# Setup Jinja2 template environment
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "email"
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"])
)


def render_template(template_name: str, **context) -> str:
    """Render an email template with the given context"""
    template = jinja_env.get_template(template_name)
    return template.render(**context)


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """
    Send an email using SMTP

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email body
        text_content: Plain text email body (optional)

    Returns:
        True if email was sent successfully, False otherwise
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        # Plain text version (fallback)
        if text_content:
            msg.attach(MIMEText(text_content, "plain", "utf-8"))

        # HTML version
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        # Check if SMTP is configured
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning(f"SMTP not configured. Email to {to_email} not sent.")
            print(f"\n{'='*50}")
            print(f"EMAIL (SMTP not configured)")
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print(f"{'='*50}\n")
            return True  # Return True for development

        # Send email
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Email sent to {to_email}: {subject}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


async def send_password_reset_email(
    email: str,
    reset_token: str,
    user_name: Optional[str] = None
) -> bool:
    """
    Send password reset email with reset link
    """
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    html_content = render_template(
        "password_reset.html",
        user_name=user_name,
        reset_link=reset_link,
        expire_hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
    )

    text_content = f"""
안녕하세요{', ' + user_name + '님' if user_name else ''},

비밀번호 재설정을 요청하셨습니다.
아래 링크를 클릭하여 새 비밀번호를 설정해주세요:

{reset_link}

이 링크는 {settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS}시간 동안 유효합니다.

비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시해주세요.

감사합니다.
CoachDB 팀
"""

    return await send_email(
        to_email=email,
        subject="[CoachDB] 비밀번호 재설정 안내",
        html_content=html_content,
        text_content=text_content
    )


# Email template mapping for notification types
NOTIFICATION_EMAIL_CONFIG = {
    "supplement_request": {
        "template": "supplement_request.html",
        "subject": "[CoachDB] 서류 보충이 필요합니다"
    },
    "supplement_submitted": {
        "template": "supplement_request.html",  # Reuse template
        "subject": "[CoachDB] 보충 서류가 제출되었습니다"
    },
    "review_complete": {
        "template": "review_complete.html",
        "subject": "[CoachDB] 심사가 완료되었습니다"
    },
    "selection_result": {
        "template": "selection_result.html",
        "subject": "[CoachDB] 선발 결과 안내"
    },
    "verification_supplement_request": {
        "template": "verification_request.html",
        "subject": "[CoachDB] 증빙 보완이 필요합니다"
    },
    "verification_completed": {
        "template": "verification_complete.html",
        "subject": "[CoachDB] 증빙 검증이 완료되었습니다"
    }
}


async def send_notification_email(
    to_email: str,
    notification_type: str,
    title: str,
    message: Optional[str] = None,
    user_name: Optional[str] = None,
    **extra_context
) -> bool:
    """
    Send notification email based on notification type

    Args:
        to_email: Recipient email address
        notification_type: Type of notification (from NotificationType enum)
        title: Notification title
        message: Notification message content
        user_name: User's name for personalization
        **extra_context: Additional context for the template
            - action_url: URL for the action button
            - project_name: Related project name
            - item_name: Related item name
            - deadline: Deadline for supplement
            - result: Selection result ('selected' or 'rejected')
            - status: Verification status ('approved' or 'rejected')

    Returns:
        True if email was sent successfully, False otherwise
    """
    config = NOTIFICATION_EMAIL_CONFIG.get(notification_type)

    if not config:
        logger.warning(f"No email template configured for notification type: {notification_type}")
        return False

    # Default action URL
    action_url = extra_context.get("action_url", settings.FRONTEND_URL)

    try:
        html_content = render_template(
            config["template"],
            user_name=user_name,
            title=title,
            message=message,
            action_url=action_url,
            **extra_context
        )

        # Generate plain text version
        text_content = f"""
안녕하세요{', ' + user_name + '님' if user_name else ''},

{title}

{message if message else ''}

자세한 내용은 CoachDB에서 확인해주세요: {action_url}

감사합니다.
CoachDB 팀
"""

        return await send_email(
            to_email=to_email,
            subject=config["subject"],
            html_content=html_content,
            text_content=text_content
        )

    except Exception as e:
        logger.error(f"Failed to send notification email: {str(e)}")
        return False
