"""Plain data structures describing a generated summary, independent of how it was produced
(seed fixture or summarizer), so another generator could be plugged in."""

from dataclasses import dataclass, field


@dataclass
class PointDraft:
    text: str
    start_ms: int | None = None
    children: list[str] = field(default_factory=list)


@dataclass
class ChapterDraft:
    title: str
    start_ms: int
    end_ms: int
    intro: str = ""
    points: list[PointDraft] = field(default_factory=list)


@dataclass
class ActionItemDraft:
    text: str
    assignee: str | None = None  # speaker / person name
    start_ms: int | None = None
    completed: bool = False


@dataclass
class SummaryDraft:
    overview: str
    gist: str
    keywords: list[str] = field(default_factory=list)
    chapters: list[ChapterDraft] = field(default_factory=list)
    action_items: list[ActionItemDraft] = field(default_factory=list)
