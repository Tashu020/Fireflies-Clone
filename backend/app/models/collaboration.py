from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow
from app.models.person import User


class Comment(Base):
    """A timestamped comment on a meeting, optionally anchored to a transcript sentence."""

    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_meeting_start", "meeting_id", "start_ms"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    segment_id: Mapped[int | None] = mapped_column(
        ForeignKey("transcript_segments.id", ondelete="CASCADE")
    )
    author_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    start_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    author: Mapped[User] = relationship(lazy="joined")


class Soundbite(Base):
    """A named clip (time range) of a meeting."""

    __tablename__ = "soundbites"
    __table_args__ = (
        CheckConstraint("end_ms > start_ms", name="time_order"),
        Index("ix_soundbites_meeting_start", "meeting_id", "start_ms"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    created_by: Mapped[User] = relationship(lazy="joined")
