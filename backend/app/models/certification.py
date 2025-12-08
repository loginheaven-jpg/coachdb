"""
Certification model
"""
from sqlalchemy import Column, BigInteger, String, Date, ForeignKey, Enum as SQLEnum, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class CertificationType(str, enum.Enum):
    """자격증 유형"""
    COACH = "coach"  # 코치 자격증
    COUNSELING = "counseling"  # 상담/심리치료 자격증
    OTHER = "other"  # 기타 자격증


class Certification(Base):
    """자격증 정보"""
    __tablename__ = "certifications"

    certification_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    certification_type = Column(SQLEnum(CertificationType), nullable=False)
    certification_name = Column(String(200), nullable=False)
    issuing_organization = Column(String(200), nullable=True)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    certificate_number = Column(String(100), nullable=True)
    certificate_file_id = Column(BigInteger, ForeignKey("files.file_id"), nullable=True)
    verification_status = Column(String(20), nullable=False, default="pending")  # pending, approved, rejected
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=True, onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="certifications")
    certificate_file = relationship("File", foreign_keys=[certificate_file_id])
