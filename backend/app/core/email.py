"""
Email service for sending password reset emails
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_password_reset_email(email: str, reset_token: str, user_name: Optional[str] = None) -> bool:
    """
    Send password reset email with reset link
    """
    try:
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "[CoachDB] 비밀번호 재설정 안내"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        # Plain text version
        text = f"""
안녕하세요{', ' + user_name + '님' if user_name else ''},

비밀번호 재설정을 요청하셨습니다.
아래 링크를 클릭하여 새 비밀번호를 설정해주세요:

{reset_link}

이 링크는 {settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS}시간 동안 유효합니다.

비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시해주세요.

감사합니다.
CoachDB 팀
"""

        # HTML version
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; text-align: center;">CoachDB</h1>
    </div>
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #333;">비밀번호 재설정</h2>
        <p style="color: #666; line-height: 1.6;">
            안녕하세요{', <strong>' + user_name + '</strong>님' if user_name else ''}.
        </p>
        <p style="color: #666; line-height: 1.6;">
            비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      padding: 15px 40px;
                      text-decoration: none;
                      border-radius: 5px;
                      font-weight: bold;
                      display: inline-block;">
                비밀번호 재설정
            </a>
        </div>
        <p style="color: #999; font-size: 12px;">
            이 링크는 {settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS}시간 동안 유효합니다.
        </p>
        <p style="color: #999; font-size: 12px;">
            비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시해주세요.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #999; font-size: 11px; text-align: center;">
            버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
            <a href="{reset_link}" style="color: #667eea;">{reset_link}</a>
        </p>
    </div>
</body>
</html>
"""

        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        # Check if SMTP is configured
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning(f"SMTP not configured. Reset link for {email}: {reset_link}")
            # For development, just log the link
            print(f"\n{'='*50}")
            print(f"PASSWORD RESET LINK (SMTP not configured)")
            print(f"Email: {email}")
            print(f"Link: {reset_link}")
            print(f"{'='*50}\n")
            return True

        # Send email
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Password reset email sent to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return False
