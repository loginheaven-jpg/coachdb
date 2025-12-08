from sqlalchemy import Column, String, DateTime, BigInteger, ForeignKey, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class SystemConfig(Base):
    """시스템 전역 설정"""

    __tablename__ = "system_config"

    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=False)
    description = Column(String(500), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)

    # Relationships
    updater = relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        return f"<SystemConfig(key={self.key}, value={self.value})>"


# 기본 설정 키 상수
class ConfigKeys:
    REQUIRED_VERIFIER_COUNT = "required_verifier_count"  # 증빙 확정에 필요한 Verifier 수
