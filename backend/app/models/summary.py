from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


class SummaryGenerator(StrEnum):
    SEED = "seed"
    HEURISTIC = "heuristic"
    LLM = "llm"


class Summary(Base):
    """AI summary of a meeting (1:1). Regenerating replaces it together with chapters and topics."""

    __tablename__ = "summaries"

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True
    )
    overview: Mapped[str] = mapped_column(Text, default="")
    gist: Mapped[str] = mapped_column(String(500), default="")
    generator: Mapped[str] = mapped_column(String(16), default=SummaryGenerator.HEURISTIC.value)
    generated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Topic(Base):
    """A keyword / tag. Shared across meetings so the library can filter by it."""

    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80, collation="NOCASE"), unique=True)


class MeetingTopic(Base):
    __tablename__ = "meeting_topics"
    __table_args__ = (Index("ix_meeting_topics_topic", "topic_id"),)

    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True
    )
    rank: Mapped[int] = mapped_column(Integer, default=0)

    topic: Mapped[Topic] = relationship(lazy="joined")


class Chapter(Base):
    """A section of the meeting notes / outline, covering a time range of the recording."""

    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("meeting_id", "seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    intro: Mapped[str] = mapped_column(Text, default="")
    start_ms: Mapped[int] = mapped_column(Integer, default=0)
    end_ms: Mapped[int] = mapped_column(Integer, default=0)

    # All bullets of the chapter (top-level and nested); the tree is rebuilt from `parent_id`.
    points: Mapped[list["ChapterPoint"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="ChapterPoint.seq"
    )


class ChapterPoint(Base):
    """A bullet in a chapter. `parent_id` makes sub-bullets (one level deep in practice).
    `seq` orders bullets among their siblings."""

    __tablename__ = "chapter_points"
    __table_args__ = (Index("ix_chapter_points_chapter", "chapter_id", "seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("chapter_points.id", ondelete="CASCADE")
    )
    seq: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    start_ms: Mapped[int | None] = mapped_column(Integer)

    parent: Mapped["ChapterPoint | None"] = relationship(remote_side=[id])
