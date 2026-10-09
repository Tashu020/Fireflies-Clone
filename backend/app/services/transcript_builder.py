"""Turns speaker utterances into timed sentences.

Every transcript source (seed fixtures, .txt, .vtt, .json uploads, pasted text) is normalized into
`Utterance`s first; this module then splits them into sentences and assigns start/end times.
Missing times are estimated from speaking rate, so transcripts without timestamps still play back.
"""

import re
from dataclasses import dataclass

WORDS_PER_SECOND = 2.5  # ~150 words per minute, a typical conversational pace
TURN_GAP_MS = 600  # pause between speakers when times are estimated
MIN_SENTENCE_MS = 700

_ABBREVIATIONS = {"mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "e.g", "i.e", "approx"}
_SENTENCE_END = re.compile(r"(?<=[.!?])[\"')\]]*\s+(?=[\"'(\[]?[A-Z0-9])")


@dataclass
class Utterance:
    speaker: str
    text: str
    start_ms: int | None = None
    end_ms: int | None = None


@dataclass
class Sentence:
    speaker: str
    text: str
    start_ms: int
    end_ms: int


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def split_sentences(text: str) -> list[str]:
    text = normalize_whitespace(text)
    if not text:
        return []
    parts: list[str] = []
    last = 0
    for match in _SENTENCE_END.finditer(text):
        candidate = text[last : match.start()]
        last_word = candidate.rsplit(" ", 1)[-1].rstrip(".").lower()
        if last_word in _ABBREVIATIONS:
            continue  # "Dr. Smith" is not a sentence boundary
        parts.append(candidate.strip())
        last = match.end()
    parts.append(text[last:].strip())
    return [part for part in parts if part]


def estimate_duration_ms(text: str) -> int:
    words = len(text.split())
    return max(MIN_SENTENCE_MS, round(words / WORDS_PER_SECOND * 1000))


def build_sentences(utterances: list[Utterance]) -> list[Sentence]:
    """Splits utterances into sentences with monotonic, non-overlapping times.

    Provided times are respected; an utterance without an end time ends where the next timed
    utterance starts (or after its estimated duration); one without a start time follows the
    previous utterance. Within an utterance, time is shared out proportionally to sentence length.
    """
    sentences: list[Sentence] = []
    cursor = 0
    cleaned = [u for u in utterances if normalize_whitespace(u.text)]

    for index, utterance in enumerate(cleaned):
        parts = split_sentences(utterance.text)
        estimated = sum(estimate_duration_ms(part) for part in parts)

        start = utterance.start_ms if utterance.start_ms is not None else cursor
        start = max(start, cursor)
        end = utterance.end_ms
        if end is None or end <= start:
            next_start = next(
                (u.start_ms for u in cleaned[index + 1 :] if u.start_ms is not None), None
            )
            end = next_start if next_start is not None and next_start > start else start + estimated

        total_chars = sum(len(part) for part in parts)
        span = end - start
        position = start
        for part_index, part in enumerate(parts):
            is_last = part_index == len(parts) - 1
            part_end = end if is_last else position + round(span * len(part) / total_chars)
            sentences.append(Sentence(utterance.speaker, part, position, max(part_end, position)))
            position = part_end

        timed = utterance.start_ms is not None or utterance.end_ms is not None
        cursor = end if timed else end + TURN_GAP_MS

    return sentences
