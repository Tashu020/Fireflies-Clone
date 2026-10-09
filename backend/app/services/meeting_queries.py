"""Read-side queries. Each list query is paginated and uses indexed columns for filtering."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from sqlalchemy import Exists, Select, exists, false, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.fts import fts_match, fts_query, transcript_fts
from app.models import (
    ActionItem,
    Chapter,
    Meeting,
    MeetingParticipant,
    MeetingSource,
    MeetingTopic,
    Person,
    Topic,
    TranscriptSegment,
    User,
)

Channel = Literal["all", "mine", "uploads"]
QuickFilter = Literal["hosted", "shared"]
DurationBucket = Literal["lt15", "15to30", "30to60", "60to90", "gt90"]

DURATION_RANGES: dict[str, tuple[int, int | None]] = {
    "lt15": (0, 15 * 60),
    "15to30": (15 * 60, 30 * 60),
    "30to60": (30 * 60, 60 * 60),
    "60to90": (60 * 60, 90 * 60),
    "gt90": (90 * 60, None),
}
# Meetings created from a file, pasted text or the form are all shown under "Uploads".
UPLOAD_SOURCES = (MeetingSource.UPLOAD.value, MeetingSource.PASTE.value, MeetingSource.FORM.value)


@dataclass
class MeetingFilters:
    q: str | None = None
    channel: Channel = "all"
    quick: QuickFilter | None = None
    host_user_ids: list[int] = field(default_factory=list)
    participant_ids: list[int] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    durations: list[DurationBucket] = field(default_factory=list)
    topic_ids: list[int] = field(default_factory=list)
    date_from: datetime | None = None
    date_to: datetime | None = None
    sort: Literal["recent", "oldest"] = "recent"
    limit: int = 20
    offset: int = 0


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _participates(person_id: int) -> Exists:
    return exists().where(
        MeetingParticipant.meeting_id == Meeting.id, MeetingParticipant.person_id == person_id
    )


def meetings_matching_text(q: str) -> Select[tuple[int]]:
    """Ids of meetings whose transcript contains every word of `q` (FTS5, prefix match)."""
    expression = fts_query(q)
    if expression is None:
        return select(TranscriptSegment.meeting_id).where(false())
    matching_rows = select(transcript_fts.c.rowid).where(fts_match(expression))
    return select(TranscriptSegment.meeting_id).where(TranscriptSegment.id.in_(matching_rows))


def _apply_filters(query: Select, filters: MeetingFilters, me: User) -> Select:
    if filters.q and filters.q.strip():
        pattern = f"%{escape_like(filters.q.strip())}%"
        query = query.where(
            or_(
                Meeting.title.ilike(pattern, escape="\\"),
                Meeting.id.in_(meetings_matching_text(filters.q)),
            )
        )

    if filters.channel == "mine":
        query = query.where(or_(Meeting.host_user_id == me.id, _participates(me.person_id)))
    elif filters.channel == "uploads":
        query = query.where(Meeting.source.in_(UPLOAD_SOURCES))

    if filters.quick == "hosted":
        query = query.where(Meeting.host_user_id == me.id)
    elif filters.quick == "shared":
        query = query.where(Meeting.host_user_id != me.id, _participates(me.person_id))

    if filters.host_user_ids:
        query = query.where(Meeting.host_user_id.in_(filters.host_user_ids))
    if filters.participant_ids:
        query = query.where(
            exists().where(
                MeetingParticipant.meeting_id == Meeting.id,
                MeetingParticipant.person_id.in_(filters.participant_ids),
            )
        )
    if filters.sources:
        sources = set(filters.sources)
        if MeetingSource.UPLOAD.value in sources:
            sources.update(UPLOAD_SOURCES)
        query = query.where(Meeting.source.in_(sources))
    if filters.durations:
        ranges = []
        for bucket in filters.durations:
            low, high = DURATION_RANGES[bucket]
            condition = Meeting.duration_sec >= low
            ranges.append(condition if high is None else condition & (Meeting.duration_sec < high))
        query = query.where(or_(*ranges))
    if filters.topic_ids:
        query = query.where(
            exists().where(
                MeetingTopic.meeting_id == Meeting.id, MeetingTopic.topic_id.in_(filters.topic_ids)
            )
        )
    if filters.date_from:
        query = query.where(Meeting.started_at >= filters.date_from)
    if filters.date_to:
        query = query.where(Meeting.started_at <= filters.date_to)
    return query


def list_meetings(db: Session, me: User, filters: MeetingFilters) -> tuple[list[Meeting], int]:
    base = _apply_filters(select(Meeting), filters, me)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    order = Meeting.started_at.desc() if filters.sort == "recent" else Meeting.started_at.asc()
    items = db.scalars(
        base.options(
            selectinload(Meeting.participants),
            selectinload(Meeting.topics),
            selectinload(Meeting.summary),
        )
        .order_by(order, Meeting.id.desc())
        .limit(filters.limit)
        .offset(filters.offset)
    ).all()
    return list(items), total


def get_meeting(db: Session, public_id: str) -> Meeting | None:
    return db.scalar(
        select(Meeting)
        .where(Meeting.public_id == public_id)
        .options(
            selectinload(Meeting.participants),
            selectinload(Meeting.speakers),
            selectinload(Meeting.summary),
            selectinload(Meeting.topics),
            selectinload(Meeting.chapters).selectinload(Chapter.points),
            selectinload(Meeting.action_items),
        )
    )


def count_segments(db: Session, meeting_id: int) -> int:
    return (
        db.scalar(
            select(func.count(TranscriptSegment.id)).where(
                TranscriptSegment.meeting_id == meeting_id
            )
        )
        or 0
    )


def list_segments(db: Session, meeting_id: int) -> list[TranscriptSegment]:
    return list(
        db.scalars(
            select(TranscriptSegment)
            .where(TranscriptSegment.meeting_id == meeting_id)
            .order_by(TranscriptSegment.seq)
        )
    )


def search_people(db: Session, q: str | None, limit: int) -> list[Person]:
    query = select(Person).order_by(Person.name).limit(limit)
    if q and q.strip():
        pattern = f"%{escape_like(q.strip())}%"
        query = query.where(
            or_(Person.name.ilike(pattern, escape="\\"), Person.email.ilike(pattern, escape="\\"))
        )
    return list(db.scalars(query))


def list_topics(db: Session) -> list[tuple[Topic, int]]:
    rows = db.execute(
        select(Topic, func.count(MeetingTopic.meeting_id).label("meeting_count"))
        .join(MeetingTopic, MeetingTopic.topic_id == Topic.id)
        .group_by(Topic.id)
        .order_by(func.count(MeetingTopic.meeting_id).desc(), Topic.name)
    ).all()
    return [(topic, count) for topic, count in rows]


def list_tasks(
    db: Session,
    me: User,
    scope: Literal["mine", "all"],
    status: Literal["open", "done", "all"],
    limit: int,
    offset: int,
) -> tuple[list[tuple[ActionItem, Meeting]], int]:
    query = select(ActionItem, Meeting).join(Meeting, Meeting.id == ActionItem.meeting_id)
    if scope == "mine":
        query = query.where(ActionItem.assignee_person_id == me.person_id)
    if status == "open":
        query = query.where(ActionItem.is_completed.is_(False))
    elif status == "done":
        query = query.where(ActionItem.is_completed.is_(True))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query.order_by(Meeting.started_at.desc(), ActionItem.seq).limit(limit).offset(offset)
    ).all()
    return [(item, meeting) for item, meeting in rows], total
