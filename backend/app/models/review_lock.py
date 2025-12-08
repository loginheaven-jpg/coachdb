from sqlalchemy import Column, BigInteger, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReviewLock(Base):
    """Concurrent review prevention - prevent multiple staff from reviewing same item"""

    __tablename__ = "review_locks"

    lock_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    application_id = Column(BigInteger, ForeignKey("applications.application_id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("competency_items.item_id"), nullable=False)
    reviewer_id = Column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    locked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)  # Auto-release after 30 minutes

    # Ensure only one lock per application+item
    __table_args__ = (
        UniqueConstraint('application_id', 'item_id', name='uq_application_item_lock'),
    )

    # Relationships
    application = relationship("Application", back_populates="review_locks")
    item = relationship("CompetencyItem")
    reviewer = relationship("User")

    def __repr__(self):
        return f"<ReviewLock(lock_id={self.lock_id}, application_id={self.application_id}, item_id={self.item_id}, reviewer_id={self.reviewer_id})>"
