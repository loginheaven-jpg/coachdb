from sqlalchemy import Column, BigInteger, String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CoachProfile(Base):
    """Coach detailed profile - optional information"""

    __tablename__ = "coach_profiles"

    profile_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # 누적 코칭시간
    total_coaching_hours = Column(Integer, nullable=True)  # KAC 인증 교육 시작 이후

    # 총 코칭 경력 (년)
    coaching_years = Column(Integer, nullable=True)

    # 전문 분야
    specialty = Column(String(500), nullable=True)

    # 학위 정보 (JSON array)
    # Format: [{"type": "coaching", "degreeLevel": "master", "degreeName": "코칭학", "file_id": 123}, ...]
    # Types: coaching, other
    degrees = Column(Text, nullable=True)  # JSON

    # 자격증 목록 (JSON array)
    # Format: [{"name": "KCA Level 3", "type": "KCA", "file_id": 123}, {"name": "상담사", "type": "COUNSELING", "file_id": 456}, ...]
    # Types: KCA, COUNSELING
    certifications = Column(Text, nullable=True)  # JSON

    # 멘토링/수퍼비전 경험 (JSON array)
    # Format: [{"description": "경험 설명", "file_id": 123}, ...]
    mentoring_experiences = Column(Text, nullable=True)  # JSON

    # 코칭 분야별 이력 (JSON object)
    # Format: {
    #   "business": {"coaching_history": "text", "certifications": "text", "files": [123, 456]},
    #   "career": {...}
    # }
    field_experiences = Column(Text, nullable=True)  # JSON

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="coach_profile")

    def __repr__(self):
        return f"<CoachProfile(profile_id={self.profile_id}, user_id={self.user_id})>"
