from sqlalchemy import Column, BigInteger, Integer, String, Enum, DateTime, func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"          # 시스템 설정, 역량 항목 정의
    PROJECT_MANAGER = "PROJECT_MANAGER"  # 과제 생성/관리, 평가기준 설정
    VERIFIER = "VERIFIER"                # 증빙서류 검증
    REVIEWER = "REVIEWER"                # 코치 평가/심사
    COACH = "COACH"                      # 일반 코치
    # Legacy roles (deprecated)
    ADMIN = "ADMIN"                      # Deprecated: use SUPER_ADMIN
    STAFF = "STAFF"                      # Deprecated: use VERIFIER or REVIEWER


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    DELETED = "deleted"


class User(Base):
    """User model - coaches, staff, and admins"""

    __tablename__ = "users"

    user_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    birth_year = Column(Integer, nullable=True)  # 4-digit year (e.g., 1985)
    gender = Column(String(10), nullable=True)
    address = Column(String(500), nullable=False)  # Changed to required (시/군/구)
    in_person_coaching_area = Column(String(500), nullable=True)  # 대면코칭가능지역 - 자유 입력
    roles = Column(String(200), nullable=False)  # JSON array - 복수 역할 가능
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.ACTIVE)
    coach_certification_number = Column(String(50), nullable=True)  # 최상위 자격
    coaching_fields = Column(String(500), nullable=True)  # JSON array of coaching fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    created_projects = relationship("Project", back_populates="creator", foreign_keys="Project.created_by")
    project_staff = relationship("ProjectStaff", back_populates="staff_user")
    competencies = relationship("CoachCompetency", back_populates="user", foreign_keys="CoachCompetency.user_id")
    applications = relationship("Application", back_populates="user")
    uploaded_files = relationship("File", back_populates="uploader")
    reminders = relationship("CompetencyReminder", back_populates="user", uselist=False)
    coach_profile = relationship("CoachProfile", back_populates="user", uselist=False)
    education_history = relationship("CoachEducationHistory", back_populates="user")
    certifications = relationship("Certification", back_populates="user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(user_id={self.user_id}, name={self.name}, roles={self.roles})>"
