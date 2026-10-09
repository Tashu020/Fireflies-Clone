from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import select

from app.api import serializers
from app.api.deps import CurrentUser, DbSession
from app.models import Meeting
from app.schemas.common import Page
from app.schemas.meeting import ActionItemOut, ActionItemUpdate, TaskOut
from app.services import meeting_queries, meeting_service

router = APIRouter(prefix="/action-items", tags=["action items"])


@router.get("", response_model=Page[TaskOut])
def list_tasks(
    db: DbSession,
    me: CurrentUser,
    scope: Literal["mine", "all"] = "mine",
    status_filter: Annotated[Literal["open", "done", "all"], Query(alias="status")] = "all",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[TaskOut]:
    """Action items across all meetings (the Tasks page)."""
    rows, total = meeting_queries.list_tasks(db, me, scope, status_filter, limit, offset)
    return Page(
        items=[serializers.task_out(item, meeting) for item, meeting in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def _meeting_public_id(db: DbSession, meeting_id: int) -> str:
    return db.scalar(select(Meeting.public_id).where(Meeting.id == meeting_id)) or ""


@router.patch("/{item_id}", response_model=ActionItemOut)
def update_action_item(item_id: int, data: ActionItemUpdate, db: DbSession) -> ActionItemOut:
    item = meeting_service.get_action_item(db, item_id)
    updated = meeting_service.update_action_item(db, item, data)
    return serializers.action_item_out(updated, _meeting_public_id(db, updated.meeting_id))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_item(item_id: int, db: DbSession) -> Response:
    meeting_service.delete_action_item(db, meeting_service.get_action_item(db, item_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
