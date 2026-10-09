"""Global search across meeting titles and transcripts (SQLite FTS5 with BM25 ranking)."""

from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.fts import fts_query
from app.models import Meeting
from app.services.meeting_queries import escape_like

HIT_MARK_START = "\u0002"
HIT_MARK_END = "\u0003"
HITS_PER_MEETING = 3
MAX_SCANNED_HITS = 1000

_HITS_SQL = text(
    """
    SELECT s.id, s.meeting_id, s.start_ms, sp.name AS speaker_name,
           snippet(transcript_fts, 0, char(2), char(3), '…', 16) AS snippet
    FROM transcript_fts
    JOIN transcript_segments AS s ON s.id = transcript_fts.rowid
    JOIN speakers AS sp ON sp.id = s.speaker_id
    WHERE transcript_fts MATCH :expression
    ORDER BY rank
    LIMIT :max_hits
    """
)


@dataclass
class Hit:
    segment_id: int
    start_ms: int
    speaker_name: str
    snippet: str


@dataclass
class MeetingResult:
    meeting: Meeting
    title_match: bool = False
    hit_count: int = 0
    hits: list[Hit] = field(default_factory=list)


def search(db: Session, q: str, limit: int) -> list[MeetingResult]:
    q = q.strip()
    if not q:
        return []

    title_matches = db.scalars(
        select(Meeting)
        .where(Meeting.title.ilike(f"%{escape_like(q)}%", escape="\\"))
        .order_by(Meeting.started_at.desc())
        .limit(limit)
    ).all()

    hits_by_meeting: dict[int, list[Hit]] = defaultdict(list)
    meeting_order: list[int] = []  # by best-ranked hit
    expression = fts_query(q)
    if expression:
        rows = db.execute(_HITS_SQL, {"expression": expression, "max_hits": MAX_SCANNED_HITS})
        for row in rows:
            if row.meeting_id not in hits_by_meeting:
                meeting_order.append(row.meeting_id)
            hits_by_meeting[row.meeting_id].append(
                Hit(row.id, row.start_ms, row.speaker_name, row.snippet)
            )

    results: dict[int, MeetingResult] = {
        m.id: MeetingResult(m, title_match=True) for m in title_matches
    }
    remaining = [mid for mid in meeting_order if mid not in results][: max(0, limit - len(results))]
    if remaining:
        for meeting in db.scalars(select(Meeting).where(Meeting.id.in_(remaining))):
            results[meeting.id] = MeetingResult(meeting)

    ordered = [results[m.id] for m in title_matches] + [results[mid] for mid in remaining]
    for result in ordered:
        hits = hits_by_meeting.get(result.meeting.id, [])
        result.hit_count = len(hits)
        result.hits = sorted(hits[:HITS_PER_MEETING], key=lambda hit: hit.start_ms)
    return ordered[:limit]
