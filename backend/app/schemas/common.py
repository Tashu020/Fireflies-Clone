import re
from datetime import UTC, datetime
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer

T = TypeVar("T")

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _as_utc_iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _require_timezone(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("datetime must include a timezone (e.g. 2024-01-01T10:00:00Z)")
    return value.astimezone(UTC)


# Serialized as ISO-8601 UTC with a trailing Z, e.g. "2024-08-08T15:52:00Z".
UtcDatetime = Annotated[datetime, PlainSerializer(_as_utc_iso, return_type=str, when_used="json")]
AwareDatetime = Annotated[datetime, AfterValidator(_require_timezone)]


def _validate_email(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None
    value = value.strip().lower()
    if not _EMAIL.match(value):
        raise ValueError("invalid email address")
    return value


OptionalEmail = Annotated[str | None, AfterValidator(_validate_email)]


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PersonOut(ApiModel):
    id: int
    name: str
    email: str | None
    avatar_color: str


class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: OptionalEmail = Field(default=None, max_length=254)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
