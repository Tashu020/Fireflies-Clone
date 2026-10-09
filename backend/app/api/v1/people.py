from typing import Annotated

from fastapi import APIRouter, Query

from app.api import serializers
from app.api.deps import CurrentUser, DbSession
from app.schemas.common import PersonOut
from app.schemas.meeting import TopicOut, UserOut
from app.services import meeting_queries
from app.services.users import list_workspace_users

router = APIRouter(tags=["people"])


@router.get("/me", response_model=UserOut)
def get_me(me: CurrentUser) -> UserOut:
    """The default signed-in user (authentication is out of scope for this clone)."""
    return serializers.user_out(me)


@router.get("/users", response_model=list[UserOut])
def list_users(db: DbSession) -> list[UserOut]:
    """Workspace members — the possible meeting hosts."""
    return [serializers.user_out(user) for user in list_workspace_users(db)]


@router.get("/people", response_model=list[PersonOut])
def search_people(
    db: DbSession,
    q: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[PersonOut]:
    return [serializers.person_out(p) for p in meeting_queries.search_people(db, q, limit)]


@router.get("/topics", response_model=list[TopicOut])
def list_topics(db: DbSession) -> list[TopicOut]:
    return [
        TopicOut(id=topic.id, name=topic.name, meeting_count=count)
        for topic, count in meeting_queries.list_topics(db)
    ]
