"""Importing this package registers every model on `Base.metadata`."""

from app.models.action_item import ActionItem, ActionItemSource
from app.models.collaboration import Comment, Soundbite
from app.models.meeting import (
    Meeting,
    MeetingParticipant,
    MeetingSource,
    MeetingStatus,
    ParticipantRole,
)
from app.models.person import Person, User
from app.models.summary import Chapter, ChapterPoint, MeetingTopic, Summary, SummaryGenerator, Topic
from app.models.transcript import Sentiment, Speaker, TranscriptSegment

__all__ = [
    "ActionItem",
    "ActionItemSource",
    "Chapter",
    "ChapterPoint",
    "Comment",
    "Meeting",
    "MeetingParticipant",
    "MeetingSource",
    "MeetingStatus",
    "MeetingTopic",
    "ParticipantRole",
    "Person",
    "Sentiment",
    "Soundbite",
    "Speaker",
    "Summary",
    "SummaryGenerator",
    "Topic",
    "TranscriptSegment",
    "User",
]
