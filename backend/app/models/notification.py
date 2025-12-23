from sqlalchemy import Column, BigInteger, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class NotificationType(str, enum.Enum):
    """알림 유형"""
    SUPPLEMENT_REQUEST = "supplement_request"     # 서류 보충 요청
    SUPPLEMENT_SUBMITTED = "supplement_submitted"  # 보충 서류 제출됨 (Staff용)
    REVIEW_COMPLETE = "review_complete"           # 심사 완료
    SELECTION_RESULT = "selection_result"         # 선발 결과
    PROJECT_UPDATE = "project_update"             # 과제 업데이트
    DEADLINE_REMINDER = "deadline_reminder"       # 마감 임박 알림
    # 증빙 검증 관련
    VERIFICATION_SUPPLEMENT_REQUEST = "verification_supplement_request"  # 증빙 보완 요청
    VERIFICATION_COMPLETED = "verification_completed"  # 증빙 검증 완료


class Notification(Base):
    """사용자 알림"""

    __tablename__ = "notifications"

    notification_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)

    type = Column(String(50), nullable=False)  # NotificationType 값
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)

    # 관련 엔티티 참조 (선택적)
    related_application_id = Column(BigInteger, ForeignKey("applications.application_id", ondelete="SET NULL"), nullable=True)
    related_project_id = Column(Integer, ForeignKey("projects.project_id", ondelete="SET NULL"), nullable=True)
    related_data_id = Column(BigInteger, nullable=True)  # ApplicationData ID
    related_competency_id = Column(BigInteger, ForeignKey("coach_competencies.competency_id", ondelete="SET NULL"), nullable=True)  # CoachCompetency ID

    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Email notification tracking
    email_sent = Column(Boolean, nullable=False, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    related_application = relationship("Application", foreign_keys=[related_application_id])
    related_project = relationship("Project", foreign_keys=[related_project_id])
    related_competency = relationship("CoachCompetency", foreign_keys=[related_competency_id])

    def __repr__(self):
        return f"<Notification(notification_id={self.notification_id}, user_id={self.user_id}, type={self.type}, is_read={self.is_read})>"
