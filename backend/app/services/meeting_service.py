"""Write-side use cases for meetings, transcripts, summaries and action items.

Each public function performs one use case and commits a single transaction, so a failure leaves
the database unchanged.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.db.types import utcnow
from app.models import (
    ActionItem,
    ActionItemSource,
    Meeting,
    MeetingSource,
    MeetingStatus,
    Person,
    Speaker,
    TranscriptSegment,
    User,
)
from app.schemas.common import ParticipantIn
from app.schemas.meeting import ActionItemCreate, ActionItemUpdate, MeetingCreate, MeetingUpdate
from app.services import meeting_queries
from app.services.analysis import classify_sentiment, is_question
from app.services.meeting_writer import (
    apply_summary,
    get_or_create_person,
    new_public_id,
    set_participants,
    write_transcript,
)
from app.services.summarizer import summarize
from app.services.transcript_builder import Sentence, build_sentences, normalize_whitespace
from app.services.transcript_parser import parse_transcript


def _resolve_participants(db: Session, participants: list[ParticipantIn]) -> list[Person]:
    return [get_or_create_person(db, p.name, p.email) for p in participants]


def _people_by_name(meeting: Meeting) -> dict[str, Person]:
    people = {mp.person.name: mp.person for mp in meeting.participants}
    people.update({s.name: s.person for s in meeting.speakers if s.person is not None})
    return people


def _summarize(db: Session, meeting: Meeting, sentences: list[Sentence]) -> None:
    draft, generator = summarize(sentences, meeting.title)
    apply_summary(db, meeting, draft, generator.value, _people_by_name(meeting))


def create_meeting(
    db: Session,
    me: User,
    data: MeetingCreate,
    source: MeetingSource,
    transcript_text: str | None = None,
) -> Meeting:
    """Creates a meeting, optionally from transcript text, and generates its summary."""
    text = transcript_text if transcript_text is not None else data.transcript_text
    sentences: list[Sentence] = []
    if text and text.strip():
        sentences = build_sentences(parse_transcript(text, data.transcript_format))
    elif source != MeetingSource.FORM:
        raise InvalidInputError(
            "The transcript is empty." if text is not None else "A transcript is required."
        )

    started_at = data.started_at or utcnow()
    meeting = Meeting(
        public_id=new_public_id(),
        title=normalize_whitespace(data.title),
        host_user_id=me.id,
        host=me,
        started_at=started_at,
        duration_sec=data.duration_sec or 0,
        language="en",
        source=source.value,
        status=MeetingStatus.READY.value,
    )
    db.add(meeting)

    host = me.person
    people = _resolve_participants(db, data.participants)
    by_name = {person.name.lower(): person for person in [host, *people]}
    speaker_people: dict[str, Person] = {}
    for speaker_name in dict.fromkeys(s.speaker for s in sentences):
        person = by_name.get(speaker_name.lower()) or get_or_create_person(db, speaker_name)
        by_name[speaker_name.lower()] = person
        speaker_people[speaker_name] = person
    db.flush()
    # With a transcript, attendance is known: the host and everyone who spoke attended, while
    # listed participants who never spoke are shown as invited. Without one, assume all attended.
    attended = {host.id, *(p.id for p in speaker_people.values())} if sentences else None
    set_participants(
        meeting, host=host, people=[*people, *speaker_people.values()], attended=attended
    )

    if sentences:
        write_transcript(meeting, sentences, speaker_people)
        db.flush()
        _summarize(db, meeting, sentences)

    db.commit()
    return meeting_queries.get_meeting(db, meeting.public_id)  # type: ignore[return-value]


def update_meeting(db: Session, meeting: Meeting, data: MeetingUpdate) -> Meeting:
    fields = data.model_fields_set
    if "title" in fields and data.title is not None:
        meeting.title = normalize_whitespace(data.title)
    if "started_at" in fields and data.started_at is not None:
        meeting.started_at = data.started_at
    if "summary_rating" in fields:
        meeting.summary_rating = data.summary_rating
    if "participants" in fields and data.participants is not None:
        host = meeting.host.person
        people = _resolve_participants(db, data.participants)  # the host is kept first
        db.flush()
        attended = {mp.person_id for mp in meeting.participants if mp.attended}
        set_participants(meeting, host=host, people=people, attended=attended | {host.id})
    meeting.updated_at = utcnow()
    db.commit()
    return meeting_queries.get_meeting(db, meeting.public_id)  # type: ignore[return-value]


def delete_meeting(db: Session, meeting: Meeting) -> None:
    db.delete(meeting)  # children are removed by ON DELETE CASCADE
    db.commit()


def rename_speaker(db: Session, meeting: Meeting, speaker_id: int, name: str) -> Speaker:
    speaker = next((s for s in meeting.speakers if s.id == speaker_id), None)
    if speaker is None:
        raise NotFoundError("Speaker not found")
    name = normalize_whitespace(name)
    if any(s.name.lower() == name.lower() and s.id != speaker_id for s in meeting.speakers):
        raise ConflictError(f'Another speaker is already named "{name}".')
    speaker.name = name
    participant = next(
        (mp.person for mp in meeting.participants if mp.person.name.lower() == name.lower()), None
    )
    speaker.person = participant
    db.commit()
    return speaker


def update_segment(db: Session, meeting: Meeting, segment_id: int, text: str) -> TranscriptSegment:
    segment = db.scalar(
        select(TranscriptSegment).where(
            TranscriptSegment.id == segment_id, TranscriptSegment.meeting_id == meeting.id
        )
    )
    if segment is None:
        raise NotFoundError("Transcript sentence not found")
    segment.text = normalize_whitespace(text)
    segment.sentiment = classify_sentiment(segment.text).value
    segment.is_question = is_question(segment.text)
    db.commit()
    return segment


def regenerate_summary(db: Session, meeting: Meeting) -> Meeting:
    segments = meeting_queries.list_segments(db, meeting.id)
    if not segments:
        raise InvalidInputError("This meeting has no transcript to summarize.")
    speakers = {s.id: s.name for s in meeting.speakers}
    sentences = [Sentence(speakers[s.speaker_id], s.text, s.start_ms, s.end_ms) for s in segments]
    _summarize(db, meeting, sentences)
    db.commit()
    db.expire_all()
    return meeting_queries.get_meeting(db, meeting.public_id)  # type: ignore[return-value]


def _check_assignee(db: Session, person_id: int | None) -> Person | None:
    if person_id is None:
        return None
    person = db.get(Person, person_id)
    if person is None:
        raise InvalidInputError("Assignee not found")
    return person


def _check_timestamp(meeting: Meeting, start_ms: int | None) -> None:
    if start_ms is not None and start_ms > meeting.duration_sec * 1000:
        raise InvalidInputError("Timestamp is beyond the end of the meeting.")


def create_action_item(db: Session, meeting: Meeting, data: ActionItemCreate) -> ActionItem:
    _check_timestamp(meeting, data.start_ms)
    next_seq = db.scalar(
        select(func.coalesce(func.max(ActionItem.seq), -1)).where(
            ActionItem.meeting_id == meeting.id
        )
    )
    item = ActionItem(
        meeting_id=meeting.id,
        text=normalize_whitespace(data.text),
        assignee=_check_assignee(db, data.assignee_person_id),
        start_ms=data.start_ms,
        seq=(next_seq if next_seq is not None else -1) + 1,
        source=ActionItemSource.USER.value,
    )
    db.add(item)
    db.commit()
    return item


def get_action_item(db: Session, item_id: int) -> ActionItem:
    item = db.get(ActionItem, item_id)
    if item is None:
        raise NotFoundError("Action item not found")
    return item


def update_action_item(db: Session, item: ActionItem, data: ActionItemUpdate) -> ActionItem:
    fields = data.model_fields_set
    if "text" in fields and data.text is not None:
        item.text = normalize_whitespace(data.text)
    if "assignee_person_id" in fields:
        item.assignee = _check_assignee(db, data.assignee_person_id)
    if "start_ms" in fields:
        meeting = db.get(Meeting, item.meeting_id)
        assert meeting is not None
        _check_timestamp(meeting, data.start_ms)
        item.start_ms = data.start_ms
    if "is_completed" in fields and data.is_completed is not None:
        item.is_completed = data.is_completed
        item.completed_at = utcnow() if data.is_completed else None
    item.updated_at = utcnow()
    db.commit()
    return item


def delete_action_item(db: Session, item: ActionItem) -> None:
    db.delete(item)
    db.commit()
