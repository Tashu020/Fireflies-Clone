from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


class Person(Base):
    """Anyone who appears in meetings: participants, speakers, action-item assignees."""

    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    avatar_color: Mapped[str] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped["User | None"] = relationship(back_populates="person")


class User(Base):
    """A workspace account. Accounts can host meetings; their identity lives in `people`."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="RESTRICT"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    person: Mapped[Person] = relationship(back_populates="user", lazy="joined")
