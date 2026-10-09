"""Write-side helpers shared by meeting creation, summary regeneration and seeding."""

import hashlib
import math
import secrets
import string
import zlib
from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.types import utcnow
from app.models import (
    ActionItem,
    ActionItemSource,
    Chapter,
    ChapterPoint,
    Meeting,
    MeetingParticipant,
    MeetingTopic,
    ParticipantRole,
    Person,
    Speaker,
    Summary,
    Topic,
    TranscriptSegment,
)
from app.services.analysis import classify_sentiment, is_question
from app.services.summary_types import SummaryDraft
from app.services.transcript_builder import Sentence

# Avatar backgrounds, taken from the Fireflies palette (purple, green, orange, blue, pink, ...).
AVATAR_COLORS = (
    "#7A5AF8",
    "#12B76A",
    "#F79009",
    "#2E90FA",
    "#EE46BC",
    "#15B79E",
    "#EF6820",
    "#6172F3",
)
SPEAKER_COLOR_COUNT = len(AVATAR_COLORS)
_PUBLIC_ID_ALPHABET = string.ascii_letters + string.digits


def new_public_id(length: int = 10) -> str:
    return "".join(secrets.choice(_PUBLIC_ID_ALPHABET) for _ in range(length))


def stable_public_id(key: str, length: int = 10) -> str:
    """Deterministic id for seeded meetings, so their links survive a re-seed (e.g. after a
    free-tier restart wipes the database)."""
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return "".join(_PUBLIC_ID_ALPHABET[byte % len(_PUBLIC_ID_ALPHABET)] for byte in digest[:length])


def avatar_color_for(name: str) -> str:
    return AVATAR_COLORS[zlib.crc32(name.lower().encode()) % len(AVATAR_COLORS)]


def get_or_create_person(session: Session, name: str, email: str | None = None) -> Person:
    """Finds a person by email (preferred) or, when no email is given, by name."""
    name = name.strip()
    email = email.strip().lower() if email else None
    if email:
        person = session.scalar(select(Person).where(Person.email == email))
        if person is None:
            person = Person(name=name, email=email, avatar_color=avatar_color_for(name))
            session.add(person)
        return person

    person = session.scalar(
        select(Person).where(func.lower(Person.name) == name.lower()).order_by(Person.id).limit(1)
    )
    if person is None:
        person = Person(name=name, email=None, avatar_color=avatar_color_for(name))
        session.add(person)
    return person


def set_participants(
    meeting: Meeting,
    host: Person,
    people: Iterable[Person],
    attended: set[int] | None = None,
) -> None:
    """Replaces the participant list. The host is always first; duplicates are ignored.
    `attended` holds person ids that joined; None means everyone attended."""
    ordered: list[Person] = [host]
    for person in people:
        if all(person is not existing for existing in ordered):
            ordered.append(person)

    meeting.participants.clear()
    for position, person in enumerate(ordered):
        meeting.participants.append(
            MeetingParticipant(
                person=person,
                role=(ParticipantRole.HOST if person is host else ParticipantRole.ATTENDEE).value,
                attended=attended is None or person.id is None or person.id in attended,
                position=position,
            )
        )


def write_transcript(
    meeting: Meeting, sentences: list[Sentence], people_by_speaker: dict[str, Person]
) -> None:
    """Adds speakers and sentence segments (with sentiment / question flags) to a new meeting."""
    speakers: dict[str, Speaker] = {}
    for sentence in sentences:
        if sentence.speaker not in speakers:
            speaker = Speaker(
                name=sentence.speaker,
                person=people_by_speaker.get(sentence.speaker),
                color_index=len(speakers) % SPEAKER_COLOR_COUNT,
            )
            speakers[sentence.speaker] = speaker
            meeting.speakers.append(speaker)

    for seq, sentence in enumerate(sentences):
        meeting.segments.append(
            TranscriptSegment(
                speaker=speakers[sentence.speaker],
                seq=seq,
                start_ms=sentence.start_ms,
                end_ms=sentence.end_ms,
                text=sentence.text,
                sentiment=classify_sentiment(sentence.text).value,
                is_question=is_question(sentence.text),
            )
        )
    meeting.duration_sec = math.ceil(sentences[-1].end_ms / 1000) if sentences else 0


def _get_or_create_topic(session: Session, name: str) -> Topic:
    topic = session.scalar(select(Topic).where(Topic.name == name))  # NOCASE collation
    if topic is None:
        topic = Topic(name=name)
        session.add(topic)
        session.flush()
    return topic


def apply_summary(
    session: Session,
    meeting: Meeting,
    draft: SummaryDraft,
    generator: str,
    people_by_name: dict[str, Person],
) -> None:
    """Writes (or replaces) the summary, keywords, chapters and AI action items of a meeting.
    Action items added by users are preserved when a summary is regenerated."""
    if meeting.summary is None:
        meeting.summary = Summary()
    meeting.summary.overview = draft.overview
    meeting.summary.gist = draft.gist
    meeting.summary.generator = generator
    meeting.summary.generated_at = utcnow()

    # Flush the removals first so new rows can reuse the same unique keys (meeting_id, seq).
    meeting.chapters.clear()
    meeting.topics.clear()
    for item in [i for i in meeting.action_items if i.source == ActionItemSource.AI.value]:
        meeting.action_items.remove(item)
    session.flush()

    seen_keywords: set[str] = set()
    for keyword in draft.keywords:
        key = keyword.strip().lower()
        if key and key not in seen_keywords:
            seen_keywords.add(key)
            topic = _get_or_create_topic(session, keyword.strip())
            meeting.topics.append(MeetingTopic(topic=topic, rank=len(meeting.topics)))

    for chapter_seq, chapter_draft in enumerate(draft.chapters):
        chapter = Chapter(
            seq=chapter_seq,
            title=chapter_draft.title,
            intro=chapter_draft.intro,
            start_ms=chapter_draft.start_ms,
            end_ms=chapter_draft.end_ms,
        )
        for point_seq, point_draft in enumerate(chapter_draft.points):
            point = ChapterPoint(
                seq=point_seq, text=point_draft.text, start_ms=point_draft.start_ms
            )
            chapter.points.append(point)
            for child_seq, child_text in enumerate(point_draft.children):
                chapter.points.append(ChapterPoint(seq=child_seq, text=child_text, parent=point))
        meeting.chapters.append(chapter)

    lookup = {name.lower(): person for name, person in people_by_name.items()}
    next_seq = max((item.seq for item in meeting.action_items), default=-1) + 1
    for offset, item_draft in enumerate(draft.action_items):
        assignee = lookup.get(item_draft.assignee.lower()) if item_draft.assignee else None
        meeting.action_items.append(
            ActionItem(
                text=item_draft.text,
                assignee=assignee,
                start_ms=item_draft.start_ms,
                is_completed=item_draft.completed,
                completed_at=utcnow() if item_draft.completed else None,
                seq=next_seq + offset,
                source=ActionItemSource.AI.value,
            )
        )
