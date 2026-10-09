from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import (
    ActionItem,
    Meeting,
    MeetingSource,
    Person,
    SummaryGenerator,
    TranscriptSegment,
    User,
)


def test_seed_creates_demo_workspace(session: Session) -> None:
    meetings = session.scalars(select(Meeting)).all()
    assert len(meetings) == 9
    assert session.scalar(select(func.count(User.id))) == 3
    assert session.scalar(select(func.count(Person.id))) == 12
    assert {m.source for m in meetings} >= {
        MeetingSource.NOTETAKER.value,
        MeetingSource.UPLOAD.value,
        MeetingSource.DESKTOP.value,
    }


def test_every_seeded_meeting_is_complete(session: Session) -> None:
    for meeting in session.scalars(select(Meeting)):
        assert len(meeting.segments) >= 60, meeting.title
        assert meeting.summary is not None and meeting.summary.generator == SummaryGenerator.SEED
        assert meeting.summary.overview and meeting.summary.gist
        assert len(meeting.chapters) >= 4
        assert meeting.action_items and meeting.topics
        assert meeting.duration_sec * 1000 >= meeting.segments[-1].end_ms
        assert meeting.participants[0].role == "host"
        assert meeting.participants[0].person_id == meeting.host.person_id


def test_seeded_timestamps_point_inside_the_transcript(session: Session) -> None:
    for meeting in session.scalars(select(Meeting)):
        starts = {segment.start_ms for segment in meeting.segments}
        for chapter in meeting.chapters:
            assert chapter.start_ms in starts and chapter.end_ms >= chapter.start_ms
            for point in chapter.points:
                assert point.start_ms is None or point.start_ms in starts
        for item in meeting.action_items:
            assert item.start_ms in starts
            assert item.assignee is not None, item.text


def test_transcript_segments_are_ordered_and_non_overlapping(session: Session) -> None:
    for meeting in session.scalars(select(Meeting)):
        previous_end = 0
        for segment in meeting.segments:
            assert segment.start_ms >= previous_end
            assert segment.end_ms >= segment.start_ms
            previous_end = segment.end_ms


def test_fts_index_matches_segments_and_follows_cascade_delete(session: Session) -> None:
    indexed = session.scalar(text("SELECT count(*) FROM transcript_fts"))
    assert indexed == session.scalar(select(func.count(TranscriptSegment.id)))

    meeting = session.scalar(select(Meeting).where(Meeting.title == "Weekly Product Sync"))
    assert meeting is not None
    hits_before = session.scalar(
        text("SELECT count(*) FROM transcript_fts WHERE transcript_fts MATCH 'activation'")
    )
    session.delete(meeting)
    session.commit()
    hits_after = session.scalar(
        text("SELECT count(*) FROM transcript_fts WHERE transcript_fts MATCH 'activation'")
    )
    assert hits_before > hits_after
    assert (
        session.scalar(select(func.count(ActionItem.id)).where(ActionItem.meeting_id == meeting.id))
        == 0
    )


def test_seeded_meeting_ids_are_stable_across_reseeds(session: Session) -> None:
    from app.services.meeting_writer import stable_public_id

    meeting = session.scalar(select(Meeting).where(Meeting.title == "Weekly Product Sync"))
    assert meeting is not None
    assert meeting.public_id == stable_public_id("seed:Weekly Product Sync")
    assert len({m.public_id for m in session.scalars(select(Meeting))}) == 9
