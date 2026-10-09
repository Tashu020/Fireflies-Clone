"""Parses uploaded / pasted transcripts (.txt, .vtt, .srt, .json) into speaker utterances.

Supported plain-text shapes (one utterance per line, continuation lines are appended):
    [00:01:23] Speaker Name: text        00:01:23 Speaker Name: text      01:23 - Speaker: text
    Speaker Name (01:23): text           Speaker Name [01:23]: text       Speaker Name: text
    Speaker Name  00:12                  <- header line (Fireflies / Zoom / Otter export style)
    text of the utterance...
"""

import json
import re
from typing import Any

from app.services.transcript_builder import Utterance, normalize_whitespace

DEFAULT_SPEAKER = "Speaker 1"

_TS = r"(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?"
_NAME = r"[^\W\d][\w .'’&-]{0,58}?"

_LEADING_TS_LINE = re.compile(
    rf"^[\[(]?(?P<ts>{_TS})[\])]?\s*(?:[-–|]\s*)?(?P<speaker>{_NAME})\s*:\s*(?P<text>.*)$"
)
_TRAILING_TS_LINE = re.compile(
    rf"^(?P<speaker>{_NAME})\s*[\[(](?P<ts>{_TS})[\])]\s*:\s*(?P<text>.*)$"
)
_SPEAKER_LINE = re.compile(rf"^(?P<speaker>{_NAME})\s*:\s*(?P<text>.+)$")
_HEADER_LINE = re.compile(rf"^(?P<speaker>{_NAME})\s*(?:[-–|•·]\s*)?[\[(]?(?P<ts>{_TS})[\])]?\s*$")
_CUE_TIMING = re.compile(rf"^(?P<start>{_TS})\s*-->\s*(?P<end>{_TS})")
_VOICE_TAG = re.compile(r"<v(?:\.[\w.-]+)?\s+(?P<speaker>[^>]+)>(?P<text>.*?)(?:</v>|$)", re.S)
_ANY_TAG = re.compile(r"<[^>]+>")


class TranscriptParseError(ValueError):
    """Raised when a transcript cannot be understood. The message is safe to show to users."""


def parse_timestamp(value: str) -> int:
    """'1:02:03.5' / '02:03' / '00:00:01,250' -> milliseconds."""
    value = value.strip().replace(",", ".")
    main, _, fraction = value.partition(".")
    parts = [int(p) for p in main.split(":")]
    seconds = 0
    for part in parts:
        seconds = seconds * 60 + part
    millis = int((fraction + "000")[:3]) if fraction else 0
    return seconds * 1000 + millis


def _looks_like_speaker(name: str) -> bool:
    name = name.strip()
    return 0 < len(name) <= 60 and len(name.split()) <= 5 and "http" not in name.lower()


def detect_format(content: str) -> str:
    stripped = content.lstrip("﻿ \t\r\n")
    if stripped.startswith("WEBVTT"):
        return "vtt"
    if stripped[:1] in ("[", "{"):
        try:
            json.loads(stripped)
            return "json"
        except json.JSONDecodeError:
            pass  # e.g. "[00:01] Ann: hi" is plain text
    if re.match(rf"^\d+\s*\r?\n{_TS}\s*-->", stripped):
        return "srt"
    return "txt"


def parse_transcript(content: str, fmt: str = "auto") -> list[Utterance]:
    content = content.lstrip("﻿")
    if not content.strip():
        raise TranscriptParseError("The transcript is empty.")
    fmt = detect_format(content) if fmt == "auto" else fmt
    parsers = {"txt": _parse_txt, "vtt": _parse_cues, "srt": _parse_cues, "json": _parse_json}
    if fmt not in parsers:
        raise TranscriptParseError(f"Unsupported transcript format: {fmt}")
    utterances = [u for u in parsers[fmt](content) if normalize_whitespace(u.text)]
    if not utterances:
        raise TranscriptParseError("No transcript lines were found in the file.")
    return utterances


def _parse_txt(content: str) -> list[Utterance]:
    utterances: list[Utterance] = []
    pending_header: Utterance | None = None

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match = _LEADING_TS_LINE.match(line) or _TRAILING_TS_LINE.match(line)
        if match and _looks_like_speaker(match["speaker"]):
            pending_header = None
            utterances.append(
                Utterance(match["speaker"].strip(), match["text"], parse_timestamp(match["ts"]))
            )
            continue

        header = _HEADER_LINE.match(line)
        if header and _looks_like_speaker(header["speaker"]):
            pending_header = Utterance(header["speaker"].strip(), "", parse_timestamp(header["ts"]))
            utterances.append(pending_header)
            continue

        speaker_line = _SPEAKER_LINE.match(line)
        if speaker_line and _looks_like_speaker(speaker_line["speaker"]) and not pending_header:
            utterances.append(Utterance(speaker_line["speaker"].strip(), speaker_line["text"]))
            continue

        # Continuation of the previous utterance (or text under a header line).
        if utterances:
            previous = utterances[-1]
            previous.text = f"{previous.text} {line}".strip()
        else:
            utterances.append(Utterance(DEFAULT_SPEAKER, line))
    return utterances


def _parse_cues(content: str) -> list[Utterance]:
    """WebVTT and SRT: blocks separated by blank lines, each with a timing line."""
    utterances: list[Utterance] = []
    last_speaker = DEFAULT_SPEAKER
    for block in re.split(r"\r?\n\s*\r?\n", content):
        lines = [line.strip() for line in block.strip().splitlines() if line.strip()]
        timing_index = next((i for i, ln in enumerate(lines) if _CUE_TIMING.match(ln)), None)
        if timing_index is None:
            continue  # header, NOTE or STYLE block
        timing = _CUE_TIMING.match(lines[timing_index])
        assert timing is not None
        text = " ".join(lines[timing_index + 1 :])

        voice = _VOICE_TAG.search(text)
        if voice:
            speaker, text = voice["speaker"].strip(), voice["text"]
        else:
            speaker_line = _SPEAKER_LINE.match(_ANY_TAG.sub("", text))
            if speaker_line and _looks_like_speaker(speaker_line["speaker"]):
                speaker, text = speaker_line["speaker"].strip(), speaker_line["text"]
            else:
                speaker = last_speaker
        text = _ANY_TAG.sub("", text)
        last_speaker = speaker
        utterances.append(
            Utterance(
                speaker, text, parse_timestamp(timing["start"]), parse_timestamp(timing["end"])
            )
        )
    return utterances


def _seconds_to_ms(item: dict[str, Any], seconds_key: str, ms_key: str) -> int | None:
    if item.get(ms_key) is not None:
        return int(item[ms_key])
    value = item.get(seconds_key)
    if value is None:
        return None
    if isinstance(value, str):
        return parse_timestamp(value) if ":" in value else round(float(value) * 1000)
    return round(float(value) * 1000)


def _parse_json(content: str) -> list[Utterance]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise TranscriptParseError(f"Invalid JSON: {exc.msg} (line {exc.lineno}).") from exc

    if isinstance(data, dict):
        data = next(
            (
                data[key]
                for key in ("segments", "transcript", "utterances", "sentences")
                if key in data
            ),
            None,
        )
    if not isinstance(data, list):
        raise TranscriptParseError(
            'JSON must be a list of segments or an object with a "segments" list.'
        )

    utterances: list[Utterance] = []
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            raise TranscriptParseError(f"Segment {index + 1} must be an object.")
        text = item.get("text") or item.get("sentence") or item.get("content")
        if not isinstance(text, str):
            raise TranscriptParseError(f'Segment {index + 1} is missing a "text" field.')
        speaker = item.get("speaker") or item.get("speaker_name") or item.get("name")
        try:
            start = _seconds_to_ms(item, "start", "start_ms")
            if start is None:
                start = _seconds_to_ms(item, "start_time", "start_ms")
            end = _seconds_to_ms(item, "end", "end_ms")
            if end is None:
                end = _seconds_to_ms(item, "end_time", "end_ms")
        except (TypeError, ValueError) as exc:
            raise TranscriptParseError(f"Segment {index + 1} has an invalid time value.") from exc
        utterances.append(Utterance(str(speaker or DEFAULT_SPEAKER).strip(), text, start, end))
    return utterances
