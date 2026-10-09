"""Maps ORM models to response schemas. Kept explicit so the API contract is easy to follow."""

from app.models import ActionItem, Chapter, Meeting, Person, User
from app.schemas.common import PersonOut
from app.schemas.meeting import (
    ActionItemOut,
    ChapterOut,
    ChapterPointOut,
    MeetingDetail,
    MeetingListItem,
    ParticipantOut,
    SpeakerOut,
    SummaryOut,
    TaskMeetingRef,
    TaskOut,
    UserOut,
)


def person_out(person: Person) -> PersonOut:
    return PersonOut.model_validate(person)


def user_out(user: User) -> UserOut:
    return UserOut(user_id=user.id, **PersonOut.model_validate(user.person).model_dump())


def _participants(meeting: Meeting) -> list[ParticipantOut]:
    return [
        ParticipantOut(**person_out(mp.person).model_dump(), role=mp.role, attended=mp.attended)  # type: ignore[arg-type]
        for mp in meeting.participants
    ]


def meeting_list_item(meeting: Meeting, me: User) -> MeetingListItem:
    return MeetingListItem(
        id=meeting.public_id,
        title=meeting.title,
        started_at=meeting.started_at,
        duration_sec=meeting.duration_sec,
        source=meeting.source,  # type: ignore[arg-type]
        status=meeting.status,
        language=meeting.language,
        host=person_out(meeting.host.person),
        is_host=meeting.host_user_id == me.id,
        participants=_participants(meeting),
        keywords=[mt.topic.name for mt in meeting.topics],
        gist=meeting.summary.gist if meeting.summary else None,
    )


def action_item_out(item: ActionItem, meeting_public_id: str) -> ActionItemOut:
    return ActionItemOut(
        id=item.id,
        meeting_id=meeting_public_id,
        text=item.text,
        assignee=person_out(item.assignee) if item.assignee else None,
        start_ms=item.start_ms,
        is_completed=item.is_completed,
        completed_at=item.completed_at,
        source=item.source,  # type: ignore[arg-type]
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def task_out(item: ActionItem, meeting: Meeting) -> TaskOut:
    return TaskOut(
        **action_item_out(item, meeting.public_id).model_dump(),
        meeting=TaskMeetingRef(
            id=meeting.public_id, title=meeting.title, started_at=meeting.started_at
        ),
    )


def _chapter_out(chapter: Chapter) -> ChapterOut:
    top_level = [p for p in chapter.points if p.parent_id is None]
    return ChapterOut(
        id=chapter.id,
        seq=chapter.seq,
        title=chapter.title,
        intro=chapter.intro,
        start_ms=chapter.start_ms,
        end_ms=chapter.end_ms,
        points=[
            ChapterPointOut(
                id=point.id,
                text=point.text,
                start_ms=point.start_ms,
                children=[
                    ChapterPointOut(id=child.id, text=child.text, start_ms=child.start_ms)
                    for child in chapter.points
                    if child.parent_id == point.id
                ],
            )
            for point in top_level
        ],
    )


def meeting_detail(meeting: Meeting, me: User, segment_count: int) -> MeetingDetail:
    summary = meeting.summary
    return MeetingDetail(
        **meeting_list_item(meeting, me).model_dump(),
        privacy=meeting.privacy,
        media_url=meeting.media_url,
        media_type=meeting.media_type,
        summary_rating=meeting.summary_rating,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        speakers=[SpeakerOut.model_validate(s) for s in meeting.speakers],
        summary=SummaryOut(
            overview=summary.overview,
            gist=summary.gist,
            keywords=[mt.topic.name for mt in meeting.topics],
            generator=summary.generator,  # type: ignore[arg-type]
            generated_at=summary.generated_at,
        )
        if summary
        else None,
        chapters=[_chapter_out(chapter) for chapter in meeting.chapters],
        action_items=[action_item_out(item, meeting.public_id) for item in meeting.action_items],
        segment_count=segment_count,
    )
