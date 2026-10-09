from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.meeting import SearchHit, SearchResponse, SearchResult, TaskMeetingRef
from app.services import search_service

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
def search(
    db: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=200)],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> SearchResponse:
    """Searches meeting titles and transcripts. Snippets mark matches with \\u0002 / \\u0003."""
    results = search_service.search(db, q, limit)
    return SearchResponse(
        query=q,
        results=[
            SearchResult(
                meeting=TaskMeetingRef(
                    id=r.meeting.public_id, title=r.meeting.title, started_at=r.meeting.started_at
                ),
                duration_sec=r.meeting.duration_sec,
                title_match=r.title_match,
                hit_count=r.hit_count,
                hits=[
                    SearchHit(
                        segment_id=h.segment_id,
                        start_ms=h.start_ms,
                        speaker_name=h.speaker_name,
                        snippet=h.snippet,
                    )
                    for h in r.hits
                ],
            )
            for r in results
        ],
    )
