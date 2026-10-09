"""Meeting notes written by an LLM (Groq), validated into the same SummaryDraft as the heuristic.

The transcript is sent as numbered lines ("[12] 03:05 Ann Lee: ..."). The model refers back to
line numbers, which are mapped to exact sentence start times here — so every timestamp in the notes
points at a real sentence, and anything malformed is dropped or rejected (→ heuristic fallback).
"""

from typing import Any

from app.services import groq_client
from app.services.export_service import format_timestamp
from app.services.groq_client import LLMError
from app.services.summary_types import ActionItemDraft, ChapterDraft, PointDraft, SummaryDraft
from app.services.transcript_builder import Sentence

# Keeps one request inside the Groq free tier's ~8k tokens-per-minute limit (~4 chars per token).
MAX_TRANSCRIPT_CHARS = 14_000
MAX_KEYWORDS = 8
MAX_CHAPTERS = 6
MAX_ACTION_ITEMS = 10

SYSTEM_PROMPT = """You are Fireflies, an AI meeting assistant that writes meeting notes.
The user sends a meeting transcript. Each line starts with [line number], a timestamp and the
speaker name. Respond ONLY with a JSON object in exactly this shape:
{
  "gist": "one sentence (max 25 words) saying what the meeting was about",
  "overview": "3-5 sentences summarising the discussion and outcomes",
  "keywords": ["5-8 short topic phrases of 1-3 words"],
  "chapters": [
    {
      "title": "short title of 2-6 words",
      "intro": "one sentence introducing the chapter",
      "line": <line number where the chapter starts>,
      "points": [
        {"text": "one concise sentence summarising a point", "line": <line number>,
         "details": ["optional supporting detail", "..."]}
      ]
    }
  ],
  "action_items": [
    {"text": "task phrased as an instruction starting with a verb",
     "assignee": "exact speaker name, or null", "line": <line number>}
  ]
}
Rules:
- Use only information from the transcript. Never invent names, numbers or decisions.
- Chapters follow the order of the meeting: 3-6 chapters (1-2 for very short meetings),
  each with 2-4 points and at most 2 details per point.
- Points summarise in your own words; do not quote the transcript.
- Action items are concrete tasks someone committed to or was asked to do.
- Every "line" must be a line number that appears in the transcript."""


def numbered_transcript(
    sentences: list[Sentence],
    max_chars: int = MAX_TRANSCRIPT_CHARS,
    priority: list[int] | None = None,
) -> str:
    """Numbered transcript lines that fit in `max_chars`.

    If the meeting is too long, lines from `priority` (e.g. the most relevant to a question) are
    kept first; otherwise lines are sampled evenly so the whole timeline is covered. Lines are
    always returned in meeting order.
    """
    lines = [
        f"[{index}] {format_timestamp(s.start_ms)} {s.speaker}: {s.text}"
        for index, s in enumerate(sentences)
    ]
    total = sum(len(line) + 1 for line in lines)
    if total <= max_chars or len(lines) < 2:
        return "\n".join(lines)
    if priority:
        chosen: list[int] = []
        used = 0
        for index in priority:
            if used + len(lines[index]) + 1 > max_chars:
                break
            chosen.append(index)
            used += len(lines[index]) + 1
        return "\n".join(lines[i] for i in sorted(chosen))
    keep = max(2, int(len(lines) * max_chars / total))
    sampled = sorted({round(k * (len(lines) - 1) / (keep - 1)) for k in range(keep)})
    return "\n".join(lines[i] for i in sampled)


# Models sometimes emit typographic hyphens (U+2010 / U+2011); normalize them to "-".
_HYPHENS = str.maketrans({"‐": "-", "‑": "-"})


def clean_text(value: Any, limit: int) -> str:
    """Single-spaced, length-limited text from an LLM field ("" if it isn't a string)."""
    if not isinstance(value, str):
        return ""
    return " ".join(value.translate(_HYPHENS).split())[:limit]


def _line(value: Any, count: int) -> int | None:
    try:
        line = int(value)
    except (TypeError, ValueError):
        return None
    return line if 0 <= line < count else None


def _speaker(value: Any, speakers: list[str]) -> str | None:
    name = clean_text(value, 120).lower()
    if not name:
        return None
    for speaker in speakers:  # exact name first, then first name ("Sam" -> "Sam Carter")
        if speaker.lower() == name:
            return speaker
    for speaker in speakers:
        if speaker.split()[0].lower() == name.split()[0]:
            return speaker
    return None


def build_draft(data: dict[str, Any], sentences: list[Sentence]) -> SummaryDraft:
    """Validates the model's JSON and converts line numbers to timestamps."""
    count = len(sentences)
    speakers = list(dict.fromkeys(s.speaker for s in sentences))

    def start(line: int | None) -> int | None:
        return sentences[line].start_ms if line is not None else None

    keywords: list[str] = []
    for keyword in data.get("keywords") or []:
        text = clean_text(keyword, 60)
        if text and text.lower() not in {k.lower() for k in keywords}:
            keywords.append(text[:1].upper() + text[1:])
    keywords = keywords[:MAX_KEYWORDS]

    chapters: list[ChapterDraft] = []
    for raw in (data.get("chapters") or [])[:MAX_CHAPTERS]:
        if not isinstance(raw, dict) or not clean_text(raw.get("title"), 200):
            continue
        points: list[PointDraft] = []
        for point in raw.get("points") or []:
            if isinstance(point, dict) and clean_text(point.get("text"), 600):
                details = [clean_text(d, 400) for d in (point.get("details") or [])[:3]]
                points.append(
                    PointDraft(
                        text=clean_text(point.get("text"), 600),
                        start_ms=start(_line(point.get("line"), count)),
                        children=[d for d in details if d],
                    )
                )
        first_point = next((p.start_ms for p in points if p.start_ms is not None), None)
        chapter_start = start(_line(raw.get("line"), count))
        chapters.append(
            ChapterDraft(
                title=clean_text(raw.get("title"), 200),
                intro=clean_text(raw.get("intro"), 600),
                start_ms=chapter_start if chapter_start is not None else (first_point or 0),
                end_ms=0,
                points=points,
            )
        )
    chapters.sort(key=lambda chapter: chapter.start_ms)
    for index, chapter in enumerate(chapters):
        following = chapters[index + 1].start_ms if index + 1 < len(chapters) else None
        chapter.end_ms = following if following is not None else sentences[-1].end_ms

    action_items: list[ActionItemDraft] = []
    for raw in (data.get("action_items") or [])[:MAX_ACTION_ITEMS]:
        if isinstance(raw, dict) and clean_text(raw.get("text"), 1000):
            action_items.append(
                ActionItemDraft(
                    text=clean_text(raw.get("text"), 1000),
                    assignee=_speaker(raw.get("assignee"), speakers),
                    start_ms=start(_line(raw.get("line"), count)),
                )
            )

    overview = clean_text(data.get("overview"), 4000)
    if not overview or not chapters:
        raise LLMError("The model's notes were incomplete")
    gist = clean_text(data.get("gist"), 500) or overview.split(". ")[0]
    return SummaryDraft(
        overview=overview,
        gist=gist,
        keywords=keywords,
        chapters=chapters,
        action_items=action_items,
    )


def llm_summarize(sentences: list[Sentence], title: str) -> SummaryDraft:
    if not sentences:
        raise LLMError("Nothing to summarize")
    user = f"Meeting title: {title}\n\nTranscript:\n{numbered_transcript(sentences)}"
    return build_draft(groq_client.chat_json(SYSTEM_PROMPT, user, max_tokens=2500), sentences)
