"""Role Request model for role approval workflow"""
import enum
from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class RoleRequestStatus(str, enum.Enum):
    """Status of role request"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class RoleRequest(Base):
    """
    Role request record for approval workflow.
    When users request roles other than COACH during registration,
    those requests are stored here for admin approval.
    """
    __tablename__ = "role_requests"

    request_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"), nullable=False, index=True)
    requested_role = Column(String(50), nullable=False)  # VERIFIER, REVIEWER, PROJECT_MANAGER, SUPER_ADMIN
    status = Column(String(20), nullable=False, default=RoleRequestStatus.PENDING.value)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    processed_by = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="role_requests")
    processor = relationship("User", foreign_keys=[processed_by])
