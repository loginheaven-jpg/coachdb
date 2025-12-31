from sqlalchemy import Column, Integer, BigInteger, Text, Enum, Boolean, Numeric, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    COMPLETED = "completed"


class SelectionResult(str, enum.Enum):
    PENDING = "pending"
    SELECTED = "selected"
    REJECTED = "rejected"


class ScoreVisibility(str, enum.Enum):
    ADMIN_ONLY = "admin_only"
    PUBLIC = "public"


class CoachRole(str, enum.Enum):
    """코치 신청 역할"""
    LEADER = "leader"             # 리더코치
    PARTICIPANT = "participant"   # 참여코치
    SUPERVISOR = "supervisor"     # 수퍼비전 코치


class Application(Base):
    """Track coach applications to projects"""

    __tablename__ = "applications"

    application_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)

    # 지원 시 입력사항
    motivation = Column(Text, nullable=True)  # 지원 동기 및 기여점
    applied_role = Column(Enum(CoachRole), nullable=True)  # 신청 역할

    status = Column(Enum(ApplicationStatus), nullable=False, default=ApplicationStatus.DRAFT)
    auto_score = Column(Numeric(6, 2), nullable=True)  # Automatically calculated score
    final_score = Column(Numeric(6, 2), nullable=True)  # Final score (may be adjusted by admin)
    score_visibility = Column(Enum(ScoreVisibility), nullable=False, default=ScoreVisibility.ADMIN_ONLY)
    can_submit = Column(Boolean, nullable=False, default=False)
    selection_result = Column(Enum(SelectionResult), nullable=False, default=SelectionResult.PENDING)

    # 선발 결과 통보 및 참여 확정
    result_notified_at = Column(DateTime(timezone=True), nullable=True)  # 선발 결과 통보일
    participation_confirmed = Column(Boolean, nullable=False, default=False)  # 참여 확정 여부
    participation_confirmed_at = Column(DateTime(timezone=True), nullable=True)  # 참여 확정일

    submitted_at = Column(DateTime(timezone=True), nullable=True)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # 마감 후 스냅샷 동결 관련 필드
    is_frozen = Column(Boolean, nullable=False, default=False)  # 마감 후 데이터 동결 여부
    frozen_at = Column(DateTime(timezone=True), nullable=True)  # 동결 시점

    # Prevent duplicate applications to same project
    __table_args__ = (
        UniqueConstraint('project_id', 'user_id', name='uq_project_user'),
    )

    # Relationships
    project = relationship("Project", back_populates="applications")
    user = relationship("User", back_populates="applications")
    application_data = relationship("ApplicationData", back_populates="application", cascade="all, delete-orphan")
    review_locks = relationship("ReviewLock", back_populates="application", cascade="all, delete-orphan")
    custom_question_answers = relationship("CustomQuestionAnswer", back_populates="application", cascade="all, delete-orphan")
    reviewer_evaluations = relationship("ReviewerEvaluation", back_populates="application", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Application(application_id={self.application_id}, project_id={self.project_id}, user_id={self.user_id}, status={self.status})>"


class VerificationStatus(str, enum.Enum):
    """서류 검증 상태"""
    PENDING = "pending"                       # 검토 대기
    APPROVED = "approved"                     # 승인
    REJECTED = "rejected"                     # 반려
    SUPPLEMENT_REQUESTED = "supplement_requested"  # 보충 요청
    SUPPLEMENTED = "supplemented"             # 보충 제출됨


class ApplicationData(Base):
    """Snapshot of application data (allows historical tracking)"""

    __tablename__ = "application_data"

    data_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    application_id = Column(BigInteger, ForeignKey("applications.application_id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("competency_items.item_id"), nullable=False)
    competency_id = Column(BigInteger, ForeignKey("coach_competencies.competency_id"), nullable=True)  # Link to reused competency
    submitted_value = Column(Text, nullable=True)
    submitted_file_id = Column(BigInteger, ForeignKey("files.file_id"), nullable=True)
    verification_status = Column(
        Enum('pending', 'approved', 'rejected', 'supplement_requested', 'supplemented',
             name='verification_status_enum'),
        nullable=False, default='pending'
    )
    item_score = Column(Numeric(5, 2), nullable=True)  # Score for this specific item
    reviewed_by = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)  # Reason for supplement request

    # 보충 요청 관련 필드
    supplement_deadline = Column(DateTime(timezone=True), nullable=True)  # 보충 기한
    supplement_requested_at = Column(DateTime(timezone=True), nullable=True)  # 보충 요청일

    # Relationships
    application = relationship("Application", back_populates="application_data")
    competency_item = relationship("CompetencyItem")
    linked_competency = relationship("CoachCompetency", back_populates="application_data")
    submitted_file = relationship("File", foreign_keys=[submitted_file_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    def __repr__(self):
        return f"<ApplicationData(data_id={self.data_id}, application_id={self.application_id}, item_id={self.item_id}, status={self.verification_status})>"
