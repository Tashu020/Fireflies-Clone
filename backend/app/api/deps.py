from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Meeting, User
from app.services import meeting_queries
from app.services.users import get_default_user

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession) -> User:
    return get_default_user(db)


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_meeting_or_404(meeting_id: str, db: DbSession) -> Meeting:
    meeting = meeting_queries.get_meeting(db, meeting_id)
    if meeting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    return meeting


MeetingDep = Annotated[Meeting, Depends(get_meeting_or_404)]
