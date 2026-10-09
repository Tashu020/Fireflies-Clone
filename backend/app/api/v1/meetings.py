import json
from pathlib import PurePath
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status
from pydantic import TypeAdapter, ValidationError

from app.api import serializers
from app.api.deps import CurrentUser, DbSession, MeetingDep
from app.core.errors import InvalidInputError, PayloadTooLargeError
from app.models import MeetingSource
from app.schemas.common import AwareDatetime, Page, ParticipantIn
from app.schemas.meeting import (
    ActionItemCreate,
    ActionItemOut,
    AskRequest,
    AskResponse,
    InsightsOut,
    MeetingCreate,
    MeetingDetail,
    MeetingListItem,
    MeetingSourceValue,
    MeetingUpdate,
    SegmentOut,
    SegmentUpdate,
    SpeakerOut,
    SpeakerUpdate,
    TranscriptOut,
)
from app.services import export_service, meeting_queries, meeting_service
from app.services.ask_service import answer_question
from app.services.insights_service import build_insights
from app.services.meeting_queries import Channel, DurationBucket, MeetingFilters, QuickFilter

router = APIRouter(prefix="/meetings", tags=["meetings"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {".txt": "txt", ".vtt": "vtt", ".srt": "srt", ".json": "json"}


def _detail(db: DbSession, meeting_public_id: str, me: CurrentUser) -> MeetingDetail:
    meeting = meeting_queries.get_meeting(db, meeting_public_id)
    assert meeting is not None
    return serializers.meeting_detail(meeting, me, meeting_queries.count_segments(db, meeting.id))


@router.get("", response_model=Page[MeetingListItem])
def list_meetings(
    db: DbSession,
    me: CurrentUser,
    q: Annotated[str | None, Query(max_length=200)] = None,
    channel: Channel = "all",
    quick: QuickFilter | None = None,
    host: Annotated[list[int] | None, Query(description="Host user ids")] = None,
    participant: Annotated[list[int] | None, Query(description="Participant person ids")] = None,
    source: Annotated[list[MeetingSourceValue] | None, Query()] = None,
    duration: Annotated[list[DurationBucket] | None, Query()] = None,
    topic: Annotated[list[int] | None, Query(description="Topic ids")] = None,
    date_from: AwareDatetime | None = None,
    date_to: AwareDatetime | None = None,
    sort: Annotated[str, Query(pattern="^(recent|oldest)$")] = "recent",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[MeetingListItem]:
    filters = MeetingFilters(
        q=q,
        channel=channel,
        quick=quick,
        host_user_ids=host or [],
        participant_ids=participant or [],
        sources=list(source or []),
        durations=list(duration or []),
        topic_ids=topic or [],
        date_from=date_from,
        date_to=date_to,
        sort="oldest" if sort == "oldest" else "recent",
        limit=limit,
        offset=offset,
    )
    meetings, total = meeting_queries.list_meetings(db, me, filters)
    return Page(
        items=[serializers.meeting_list_item(m, me) for m in meetings],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def create_meeting(data: MeetingCreate, db: DbSession, me: CurrentUser) -> MeetingDetail:
    """Creates a meeting from pasted transcript text, or from the form (metadata only)."""
    has_transcript = bool(data.transcript_text and data.transcript_text.strip())
    source = MeetingSource.PASTE if has_transcript else MeetingSource.FORM
    meeting = meeting_service.create_meeting(db, me, data, source)
    return _detail(db, meeting.public_id, me)


@router.post("/upload", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def upload_meeting(
    db: DbSession,
    me: CurrentUser,
    file: Annotated[UploadFile, File(description=".txt, .vtt, .srt or .json transcript")],
    title: Annotated[str | None, Form(max_length=200)] = None,
    started_at: Annotated[str | None, Form()] = None,
    participants: Annotated[str | None, Form(description="JSON list of {name, email}")] = None,
) -> MeetingDetail:
    filename = file.filename or "transcript.txt"
    extension = PurePath(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise InvalidInputError("Unsupported file type. Upload a .txt, .vtt, .srt or .json file.")

    raw = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise PayloadTooLargeError("The transcript file is larger than 5 MB.")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    try:
        people = TypeAdapter(list[ParticipantIn]).validate_python(
            json.loads(participants) if participants else []
        )
        data = MeetingCreate(
            title=(title or "").strip() or PurePath(filename).stem.replace("_", " ")[:200],
            started_at=started_at or None,  # type: ignore[arg-type]
            participants=people,
            transcript_format=ALLOWED_EXTENSIONS[extension],  # type: ignore[arg-type]
        )
    except (ValidationError, json.JSONDecodeError) as exc:
        raise InvalidInputError(f"Invalid form data: {exc}") from exc

    meeting = meeting_service.create_meeting(
        db, me, data, MeetingSource.UPLOAD, transcript_text=content
    )
    return _detail(db, meeting.public_id, me)


@router.get("/{meeting_id}", response_model=MeetingDetail)
def get_meeting(meeting: MeetingDep, db: DbSession, me: CurrentUser) -> MeetingDetail:
    return serializers.meeting_detail(meeting, me, meeting_queries.count_segments(db, meeting.id))


@router.patch("/{meeting_id}", response_model=MeetingDetail)
def update_meeting(
    data: MeetingUpdate, meeting: MeetingDep, db: DbSession, me: CurrentUser
) -> MeetingDetail:
    updated = meeting_service.update_meeting(db, meeting, data)
    return serializers.meeting_detail(updated, me, meeting_queries.count_segments(db, updated.id))


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting: MeetingDep, db: DbSession) -> Response:
    meeting_service.delete_meeting(db, meeting)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{meeting_id}/transcript", response_model=TranscriptOut)
def get_transcript(meeting: MeetingDep, db: DbSession) -> TranscriptOut:
    return TranscriptOut(
        meeting_id=meeting.public_id,
        speakers=[SpeakerOut.model_validate(s) for s in meeting.speakers],
        segments=[
            SegmentOut.model_validate(s) for s in meeting_queries.list_segments(db, meeting.id)
        ],
    )


@router.patch("/{meeting_id}/speakers/{speaker_id}", response_model=SpeakerOut)
def rename_speaker(
    speaker_id: int, data: SpeakerUpdate, meeting: MeetingDep, db: DbSession
) -> SpeakerOut:
    return SpeakerOut.model_validate(
        meeting_service.rename_speaker(db, meeting, speaker_id, data.name)
    )


@router.patch("/{meeting_id}/segments/{segment_id}", response_model=SegmentOut)
def update_segment(
    segment_id: int, data: SegmentUpdate, meeting: MeetingDep, db: DbSession
) -> SegmentOut:
    return SegmentOut.model_validate(
        meeting_service.update_segment(db, meeting, segment_id, data.text)
    )


@router.post("/{meeting_id}/summary/regenerate", response_model=MeetingDetail)
def regenerate_summary(meeting: MeetingDep, db: DbSession, me: CurrentUser) -> MeetingDetail:
    updated = meeting_service.regenerate_summary(db, meeting)
    return serializers.meeting_detail(updated, me, meeting_queries.count_segments(db, updated.id))


@router.get("/{meeting_id}/insights", response_model=InsightsOut)
def get_insights(meeting: MeetingDep, db: DbSession) -> InsightsOut:
    return build_insights(meeting, meeting_queries.list_segments(db, meeting.id))


@router.get("/{meeting_id}/action-items", response_model=list[ActionItemOut])
def list_action_items(meeting: MeetingDep) -> list[ActionItemOut]:
    return [serializers.action_item_out(i, meeting.public_id) for i in meeting.action_items]


@router.post(
    "/{meeting_id}/action-items",
    response_model=ActionItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_action_item(data: ActionItemCreate, meeting: MeetingDep, db: DbSession) -> ActionItemOut:
    item = meeting_service.create_action_item(db, meeting, data)
    return serializers.action_item_out(item, meeting.public_id)


@router.post("/{meeting_id}/ask", response_model=AskResponse)
def ask_about_meeting(data: AskRequest, meeting: MeetingDep, db: DbSession) -> AskResponse:
    """AskFred: answers a question from this meeting's notes and transcript."""
    return answer_question(meeting, meeting_queries.list_segments(db, meeting.id), data.question)


@router.get("/{meeting_id}/export")
def export_meeting(
    meeting: MeetingDep,
    db: DbSession,
    format: Annotated[export_service.ExportFormat, Query()] = "txt",  # noqa: A002
    content: Annotated[export_service.ExportContent, Query()] = "all",
) -> Response:
    body = export_service.export_meeting(
        meeting, meeting_queries.list_segments(db, meeting.id), format, content
    )
    filename = export_service.export_filename(meeting, content, format)
    media_type = "text/markdown" if format == "md" else "text/plain"
    return Response(
        content=body,
        media_type=f"{media_type}; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
