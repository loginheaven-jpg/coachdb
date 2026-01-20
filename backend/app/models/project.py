from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"              # 초안 (임시저장, 비공개)
    PENDING = "pending"          # 승인대기 (SUPER_ADMIN 승인 필요)
    REJECTED = "rejected"        # 반려됨 (수정 후 재상신 가능)
    APPROVED = "approved"        # 승인완료 (SUPER_ADMIN 승인됨, 모집개시 전)
    READY = "ready"              # 모집개시 (과제관리자가 모집 시작)
    RECRUITING = "recruiting"    # 접수중 (legacy, 호환용 - 사용하지 않음)
    REVIEWING = "reviewing"      # 심사중
    IN_PROGRESS = "in_progress"  # 과제진행중
    EVALUATING = "evaluating"    # 과제평가중
    COMPLETED = "completed"      # (레거시, 사용 안함)
    CLOSED = "closed"            # 종료


class ProjectType(str, enum.Enum):
    PUBLIC_COACHING = "public_coaching"      # 공익코칭
    BUSINESS_COACHING = "business_coaching"  # 비즈니스코칭
    OTHER = "other"                          # 기타


class Project(Base):
    """Project model - recruitment projects for coaches"""

    __tablename__ = "projects"

    project_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    project_type = Column(Enum(ProjectType), nullable=True, default=ProjectType.OTHER)  # 과제 구분
    support_program_name = Column(String(200), nullable=True)  # 지원 사업명
    description = Column(Text, nullable=True)

    # 모집 기간
    recruitment_start_date = Column(Date, nullable=False)
    recruitment_end_date = Column(Date, nullable=False)

    # 과제 기간 (계획)
    project_start_date = Column(Date, nullable=True)
    project_end_date = Column(Date, nullable=True)

    # 실제 진행 기간
    actual_start_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)

    # 과제 종료 후 총평
    overall_feedback = Column(Text, nullable=True)  # 호환성 유지 (deprecated)
    project_achievements = Column(Text, nullable=True)  # 과제 성과
    project_special_notes = Column(Text, nullable=True)  # 특이사항

    status = Column(Enum(ProjectStatus), nullable=False, default=ProjectStatus.DRAFT)
    max_participants = Column(Integer, nullable=False)

    # 평가 가중치 (기본값: 정량 70%, 정성 30%)
    quantitative_weight = Column(Numeric(5, 2), nullable=False, default=70)  # 정량평가 가중치 (0-100)
    qualitative_weight = Column(Numeric(5, 2), nullable=False, default=30)   # 정성평가 가중치 (0-100)

    # 과제 관리자
    project_manager_id = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    created_by = Column(BigInteger, ForeignKey("users.user_id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    creator = relationship("User", back_populates="created_projects", foreign_keys=[created_by])
    project_manager = relationship("User", foreign_keys=[project_manager_id])
    staff_assignments = relationship("ProjectStaff", back_populates="project", cascade="all, delete-orphan")
    project_items = relationship("ProjectItem", back_populates="project", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="project", cascade="all, delete-orphan")
    custom_questions = relationship("CustomQuestion", back_populates="project", cascade="all, delete-orphan")
    evaluations = relationship("CoachEvaluation", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(project_id={self.project_id}, name={self.project_name}, status={self.status})>"


class ProjectStaff(Base):
    """Junction table - assign staff members to review applications for projects"""

    __tablename__ = "project_staff"

    project_id = Column(Integer, ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True)
    staff_user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="staff_assignments")
    staff_user = relationship("User", back_populates="project_staff")

    def __repr__(self):
        return f"<ProjectStaff(project_id={self.project_id}, staff_user_id={self.staff_user_id})>"
