from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow
from app.models.person import Person, User

if TYPE_CHECKING:
    from app.models.action_item import ActionItem
    from app.models.summary import Chapter, MeetingTopic, Summary
    from app.models.transcript import Speaker, TranscriptSegment


class MeetingSource(StrEnum):
    NOTETAKER = "notetaker"
    CHROME_EXTENSION = "chrome_extension"
    DESKTOP = "desktop"
    MOBILE = "mobile"
    UPLOAD = "upload"
    PASTE = "paste"
    FORM = "form"


class MeetingStatus(StrEnum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ParticipantRole(StrEnum):
    HOST = "host"
    ATTENDEE = "attendee"


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(repr(v.value) for v in values)})"


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint(_in("source", MeetingSource), name="source"),
        CheckConstraint(_in("status", MeetingStatus), name="status"),
        CheckConstraint("duration_sec >= 0", name="duration_non_negative"),
        CheckConstraint(
            "summary_rating IS NULL OR summary_rating BETWEEN 1 AND 5", name="rating_range"
        ),
        Index("ix_meetings_started_at", "started_at"),
        Index("ix_meetings_host_started", "host_user_id", "started_at"),
        Index("ix_meetings_source", "source"),
        Index("ix_meetings_duration", "duration_sec"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(16), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime)
    duration_sec: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String(16), default="en")
    source: Mapped[str] = mapped_column(String(32), default=MeetingSource.UPLOAD.value)
    status: Mapped[str] = mapped_column(String(16), default=MeetingStatus.READY.value)
    privacy: Mapped[str] = mapped_column(String(32), default="teammates_and_link")
    media_url: Mapped[str | None] = mapped_column(String(500))
    media_type: Mapped[str | None] = mapped_column(String(16))
    summary_rating: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    host: Mapped[User] = relationship(lazy="joined")
    # Children are deleted by the database (ON DELETE CASCADE); passive_deletes avoids loading them.
    participants: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="MeetingParticipant.position",
    )
    speakers: Mapped[list["Speaker"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Speaker.id"
    )
    segments: Mapped[list["TranscriptSegment"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="TranscriptSegment.seq"
    )
    summary: Mapped["Summary | None"] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )
    chapters: Mapped[list["Chapter"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Chapter.seq"
    )
    topics: Mapped[list["MeetingTopic"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="MeetingTopic.rank"
    )
    action_items: Mapped[list["ActionItem"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="ActionItem.seq"
    )


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"
    __table_args__ = (
        CheckConstraint(_in("role", ParticipantRole), name="role"),
        Index("ix_meeting_participants_person", "person_id"),
    )

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True
    )
    person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(16), default=ParticipantRole.ATTENDEE.value)
    attended: Mapped[bool] = mapped_column(Boolean, default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")
    person: Mapped[Person] = relationship(lazy="joined")
