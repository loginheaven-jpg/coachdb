from sqlalchemy import Column, BigInteger, Integer, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CompetencyReminder(Base):
    """6-month update reminders for coaches (Phase 2)"""

    __tablename__ = "competency_reminders"

    reminder_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    last_reminder_sent = Column(DateTime(timezone=True), nullable=True)
    next_reminder_date = Column(Date, nullable=True)
    reminder_count = Column(Integer, nullable=False, default=0)

    # Relationships
    user = relationship("User", back_populates="reminders")

    def __repr__(self):
        return f"<CompetencyReminder(reminder_id={self.reminder_id}, user_id={self.user_id}, next_reminder_date={self.next_reminder_date})>"
