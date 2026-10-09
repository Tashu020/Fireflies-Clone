"""AskFred for a single meeting: answers questions from the meeting's notes and transcript.

With a Groq key configured, the LLM writes the answer from the notes and transcript and cites the
transcript lines it used. Without one (or if the call fails), common intents (action items,
summary, decisions, participants, questions) are answered from the stored notes, and anything else
by ranking transcript sentences by keyword overlap with the question (IDF-weighted).
"""

import logging
import math
import re
from collections import Counter

from app.models import Meeting, TranscriptSegment
from app.schemas.meeting import AskCitation, AskResponse
from app.services import groq_client
from app.services.export_service import format_timestamp
from app.services.groq_client import LLMError
from app.services.llm_summarizer import clean_text, numbered_transcript
from app.services.text_patterns import content_words
from app.services.transcript_builder import Sentence

logger = logging.getLogger(__name__)
LLM_TRANSCRIPT_CHARS = 10_000
LLM_SYSTEM_PROMPT = """You are AskFred, the AI assistant inside Fireflies, answering a question
about one meeting. Use ONLY the meeting notes and transcript provided; transcript lines start with
[line number]. If the meeting does not cover the question, say so plainly.
Respond ONLY with a JSON object in exactly this shape:
{"answer": "direct answer in at most 80 words",
 "bullets": ["optional supporting points, at most 6"],
 "lines": [up to 4 transcript line numbers that support the answer]}"""

MAX_CITATIONS = 4

_INTENTS: dict[str, re.Pattern[str]] = {
    "action_items": re.compile(r"\b(action items?|to-?dos?|tasks?|next steps?|follow[- ]?ups?)\b"),
    "summary": re.compile(
        r"\b(summar\w*|overview|recap|tl;?dr|what (was|is) (this|the) meeting about)\b"
    ),
    "decisions": re.compile(r"\b(decisions?|decided|agreed|conclusions?|key points?|takeaways?)\b"),
    "participants": re.compile(r"\b(who (attended|was there|joined)|participants?|attendees?)\b"),
    "questions": re.compile(r"\b(questions? (were )?asked|what questions)\b"),
}


def _stem(word: str) -> str:
    return word[:5]  # crude prefix stemming: "pricing" ~ "price", "exports" ~ "export"


def _cite(segment: TranscriptSegment, speakers: dict[int, str]) -> AskCitation:
    return AskCitation(
        segment_id=segment.id,
        start_ms=segment.start_ms,
        speaker_name=speakers.get(segment.speaker_id, "Speaker"),
        text=segment.text,
    )


def _segments_at(segments: list[TranscriptSegment], starts: list[int]) -> list[TranscriptSegment]:
    by_start = {segment.start_ms: segment for segment in segments}
    return [by_start[start] for start in starts if start in by_start]


def answer_question(
    meeting: Meeting, segments: list[TranscriptSegment], question: str
) -> AskResponse:
    speakers = {speaker.id: speaker.name for speaker in meeting.speakers}
    if segments and groq_client.is_configured():
        try:
            return _llm_answer(meeting, segments, speakers, question)
        except LLMError as exc:
            logger.info("AskFred falling back to built-in answers: %s", exc)
    lowered = question.lower()

    if _INTENTS["action_items"].search(lowered):
        items = meeting.action_items
        if not items:
            return AskResponse(answer="No action items were captured in this meeting.")
        bullets = [
            f"{item.assignee.name if item.assignee else 'Unassigned'}: {item.text}"
            + (f" ({format_timestamp(item.start_ms)})" if item.start_ms is not None else "")
            + (" — done" if item.is_completed else "")
            for item in items
        ]
        starts = [i.start_ms for i in items if i.start_ms is not None][:MAX_CITATIONS]
        return AskResponse(
            answer=f"There are {len(items)} action items from this meeting:",
            bullets=bullets,
            citations=[_cite(s, speakers) for s in _segments_at(segments, starts)],
        )

    if _INTENTS["summary"].search(lowered) and meeting.summary:
        return AskResponse(
            answer=meeting.summary.overview or meeting.summary.gist,
            bullets=[chapter.title for chapter in meeting.chapters],
        )

    if _INTENTS["decisions"].search(lowered) and meeting.chapters:
        points = [p for chapter in meeting.chapters for p in chapter.points if p.parent_id is None]
        starts = [p.start_ms for p in points if p.start_ms is not None][:MAX_CITATIONS]
        return AskResponse(
            answer="Here are the key points from the meeting notes:",
            bullets=[point.text for point in points[:8]],
            citations=[_cite(s, speakers) for s in _segments_at(segments, starts)],
        )

    if _INTENTS["participants"].search(lowered):
        attended = [mp.person.name for mp in meeting.participants if mp.attended]
        invited = [mp.person.name for mp in meeting.participants if not mp.attended]
        answer = f"{len(attended)} people attended: {', '.join(attended)}."
        if invited:
            answer += f" Also invited: {', '.join(invited)}."
        return AskResponse(answer=answer)

    if _INTENTS["questions"].search(lowered):
        asked = [s for s in segments if s.is_question][:MAX_CITATIONS]
        if not asked:
            return AskResponse(answer="No questions were asked in this meeting.")
        return AskResponse(
            answer=f"{sum(s.is_question for s in segments)} questions were asked. A few of them:",
            citations=[_cite(s, speakers) for s in asked],
        )

    return _retrieve(segments, speakers, question)


def _rank(segments: list[TranscriptSegment], question: str) -> list[int]:
    """Indices of segments sharing words with the question, most relevant first (IDF-weighted)."""
    terms = {_stem(word) for word in content_words(question)}
    stems_per_segment = [{_stem(w) for w in content_words(s.text)} for s in segments]
    document_frequency = Counter(stem for stems in stems_per_segment for stem in stems)
    total = len(segments)
    scored: list[tuple[float, int]] = []
    for index, stems in enumerate(stems_per_segment):
        overlap = terms & stems
        if overlap:
            score = sum(math.log(1 + total / document_frequency[stem]) for stem in overlap)
            scored.append((score, index))
    return [index for _, index in sorted(scored, key=lambda item: -item[0])]


def _notes_text(meeting: Meeting) -> str:
    lines: list[str] = []
    if meeting.summary:
        lines.append(f"Overview: {meeting.summary.overview}")
    for chapter in meeting.chapters:
        lines.append(f"Chapter: {chapter.title}")
        lines += [f"- {p.text}" for p in chapter.points if p.parent_id is None]
    for item in meeting.action_items:
        owner = item.assignee.name if item.assignee else "Unassigned"
        status = "done" if item.is_completed else "open"
        lines.append(f"Action item ({owner}, {status}): {item.text}")
    attended = ", ".join(mp.person.name for mp in meeting.participants if mp.attended)
    lines.append(f"Participants: {attended}")
    return "\n".join(lines)


def _llm_answer(
    meeting: Meeting,
    segments: list[TranscriptSegment],
    speakers: dict[int, str],
    question: str,
) -> AskResponse:
    sentences = [
        Sentence(speakers.get(s.speaker_id, "Speaker"), s.text, s.start_ms, s.end_ms)
        for s in segments
    ]
    transcript = numbered_transcript(
        sentences, LLM_TRANSCRIPT_CHARS, priority=_rank(segments, question) or None
    )
    user = (
        f"Meeting: {meeting.title}\n\nNotes:\n{_notes_text(meeting)}\n\n"
        f"Transcript:\n{transcript}\n\nQuestion: {question}"
    )
    data = groq_client.chat_json(LLM_SYSTEM_PROMPT, user, max_tokens=800)

    answer = clean_text(data.get("answer"), 1000)
    if not answer:
        raise LLMError("Empty answer")
    bullets = [b for b in (clean_text(x, 300) for x in (data.get("bullets") or [])) if b]
    cited: list[int] = []
    for value in data.get("lines") or []:
        try:
            line = int(value)
        except (TypeError, ValueError):
            continue
        if 0 <= line < len(segments) and line not in cited:
            cited.append(line)
    return AskResponse(
        answer=answer,
        bullets=bullets[:6],
        citations=[_cite(segments[i], speakers) for i in sorted(cited)[:MAX_CITATIONS]],
    )


def _retrieve(
    segments: list[TranscriptSegment], speakers: dict[int, str], question: str
) -> AskResponse:
    if not content_words(question) or not segments:
        return AskResponse(
            answer="Ask about a topic from this meeting, such as a project, customer or decision."
        )
    ranked = _rank(segments, question)
    if not ranked:
        return AskResponse(answer="I couldn't find anything about that in this meeting.")

    in_order = sorted((segments[i] for i in ranked[:MAX_CITATIONS]), key=lambda s: s.start_ms)
    return AskResponse(
        answer="Here's what was said about that in the meeting:",
        citations=[_cite(segment, speakers) for segment in in_order],
    )
