from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.person import Person


class Sentiment(StrEnum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class Speaker(Base):
    """A speaker label inside one meeting's transcript, optionally linked to a known person."""

    __tablename__ = "speakers"
    __table_args__ = (UniqueConstraint("meeting_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id", ondelete="SET NULL"))
    color_index: Mapped[int] = mapped_column(Integer, default=0)

    person: Mapped[Person | None] = relationship()


class TranscriptSegment(Base):
    """One sentence of the transcript. Sentence granularity enables precise seek and highlight."""

    __tablename__ = "transcript_segments"
    __table_args__ = (
        UniqueConstraint("meeting_id", "seq"),
        Index("ix_transcript_segments_meeting_start", "meeting_id", "start_ms"),
        Index("ix_transcript_segments_speaker", "speaker_id"),
        CheckConstraint("end_ms >= start_ms", name="time_order"),
        CheckConstraint(
            "sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')",
            name="sentiment",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    speaker_id: Mapped[int] = mapped_column(ForeignKey("speakers.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer)
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    sentiment: Mapped[str | None] = mapped_column(String(16))
    is_question: Mapped[bool] = mapped_column(Boolean, default=False)

    speaker: Mapped[Speaker] = relationship()
