from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Person, User
from app.services.meeting_writer import get_or_create_person


def ensure_default_user(session: Session) -> User:
    """The app has no authentication; every request acts as this fictional default user."""
    settings = get_settings()
    person = get_or_create_person(session, settings.default_user_name, settings.default_user_email)
    session.flush()
    user = session.scalar(select(User).where(User.person_id == person.id))
    if user is None:
        user = User(person=person)
        session.add(user)
        session.flush()
    return user


def get_default_user(session: Session) -> User:
    email = get_settings().default_user_email.lower()
    user = session.scalar(select(User).join(User.person).where(Person.email == email))
    if user is None:
        user = ensure_default_user(session)
        session.commit()
    return user


def list_workspace_users(session: Session) -> list[User]:
    return list(session.scalars(select(User).join(User.person).order_by(Person.name)))
