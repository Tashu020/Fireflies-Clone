from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ApiModel, AwareDatetime, ParticipantIn, PersonOut, UtcDatetime

MeetingSourceValue = Literal[
    "notetaker", "chrome_extension", "desktop", "mobile", "upload", "paste", "form"
]
TranscriptFormat = Literal["auto", "txt", "vtt", "srt", "json"]


class ParticipantOut(PersonOut):
    role: Literal["host", "attendee"]
    attended: bool


class SpeakerOut(ApiModel):
    id: int
    name: str
    color_index: int
    person_id: int | None


class ChapterPointOut(BaseModel):
    id: int
    text: str
    start_ms: int | None
    children: list["ChapterPointOut"] = []


class ChapterOut(BaseModel):
    id: int
    seq: int
    title: str
    intro: str
    start_ms: int
    end_ms: int
    points: list[ChapterPointOut]


class SummaryOut(BaseModel):
    overview: str
    gist: str
    keywords: list[str]
    generator: Literal["seed", "heuristic", "llm"]
    generated_at: UtcDatetime


class ActionItemOut(BaseModel):
    id: int
    meeting_id: str
    text: str
    assignee: PersonOut | None
    start_ms: int | None
    is_completed: bool
    completed_at: UtcDatetime | None
    source: Literal["ai", "user"]
    created_at: UtcDatetime
    updated_at: UtcDatetime


class MeetingListItem(BaseModel):
    id: str
    title: str
    started_at: UtcDatetime
    duration_sec: int
    source: MeetingSourceValue
    status: str
    language: str
    host: PersonOut
    is_host: bool
    participants: list[ParticipantOut]
    keywords: list[str]
    gist: str | None


class MeetingDetail(MeetingListItem):
    privacy: str
    media_url: str | None
    media_type: str | None
    summary_rating: int | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    speakers: list[SpeakerOut]
    summary: SummaryOut | None
    chapters: list[ChapterOut]
    action_items: list[ActionItemOut]
    segment_count: int


class SegmentOut(ApiModel):
    id: int
    seq: int
    speaker_id: int
    start_ms: int
    end_ms: int
    text: str
    sentiment: Literal["positive", "neutral", "negative"] | None
    is_question: bool


class TranscriptOut(BaseModel):
    meeting_id: str
    speakers: list[SpeakerOut]
    segments: list[SegmentOut]


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    started_at: AwareDatetime | None = None
    duration_sec: int | None = Field(default=None, ge=0, le=24 * 3600)
    participants: list[ParticipantIn] = Field(default_factory=list, max_length=50)
    transcript_text: str | None = Field(default=None, max_length=5_000_000)
    transcript_format: TranscriptFormat = "auto"


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    started_at: AwareDatetime | None = None
    participants: list[ParticipantIn] | None = Field(default=None, max_length=50)
    summary_rating: int | None = Field(default=None, ge=1, le=5)


class SpeakerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class SegmentUpdate(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class ActionItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    assignee_person_id: int | None = None
    start_ms: int | None = Field(default=None, ge=0)


class ActionItemUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=1000)
    assignee_person_id: int | None = None
    start_ms: int | None = Field(default=None, ge=0)
    is_completed: bool | None = None


class TaskMeetingRef(BaseModel):
    id: str
    title: str
    started_at: UtcDatetime


class TaskOut(ActionItemOut):
    meeting: TaskMeetingRef


class SearchHit(BaseModel):
    segment_id: int
    start_ms: int
    speaker_name: str
    # Matched terms are wrapped in \u0002 ... \u0003 markers; clients render them as highlights.
    snippet: str


class SearchResult(BaseModel):
    meeting: TaskMeetingRef
    duration_sec: int
    title_match: bool
    hit_count: int
    hits: list[SearchHit]


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


class SpeakerStat(BaseModel):
    speaker_id: int
    name: str
    color_index: int
    talk_ms: int
    talk_pct: float
    word_count: int
    wpm: int


class TopicStat(BaseModel):
    name: str
    count: int
    segment_ids: list[int]


class SentimentStat(BaseModel):
    positive: float
    neutral: float
    negative: float
    positive_ids: list[int]
    neutral_ids: list[int]
    negative_ids: list[int]


class InsightsOut(BaseModel):
    filters: dict[Literal["questions", "tasks", "dates", "metrics"], list[int]]
    sentiment: SentimentStat
    speakers: list[SpeakerStat]
    topics: list[TopicStat]


class TopicOut(BaseModel):
    id: int
    name: str
    meeting_count: int


class UserOut(PersonOut):
    user_id: int


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class AskCitation(BaseModel):
    segment_id: int
    start_ms: int
    speaker_name: str
    text: str


class AskResponse(BaseModel):
    answer: str
    bullets: list[str] = []
    citations: list[AskCitation] = []
