"""Exports a meeting's transcript and/or notes as plain text or Markdown."""

import re
from itertools import groupby
from typing import Literal

from app.models import Meeting, TranscriptSegment

ExportFormat = Literal["txt", "md"]
ExportContent = Literal["transcript", "summary", "all"]


def format_timestamp(ms: int | None) -> str:
    if ms is None:
        return ""
    seconds = ms // 1000
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes:02d}:{secs:02d}"


def export_filename(meeting: Meeting, content: ExportContent, fmt: ExportFormat) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", meeting.title.lower()).strip("-") or "meeting"
    return f"{slug}-{content}.{fmt}"


def _header(meeting: Meeting, md: bool) -> list[str]:
    title = f"# {meeting.title}" if md else meeting.title
    when = meeting.started_at.strftime("%b %d, %Y %H:%M UTC")
    names = ", ".join(mp.person.name for mp in meeting.participants)
    duration = format_timestamp(meeting.duration_sec * 1000)
    return [title, "", f"Date: {when} · Duration: {duration}", f"Participants: {names}", ""]


def _summary_lines(meeting: Meeting, md: bool) -> list[str]:
    h2 = "## " if md else ""
    lines: list[str] = []
    if meeting.summary is None:
        return [f"{h2}Notes", "", "No summary available.", ""]
    keywords = ", ".join(mt.topic.name for mt in meeting.topics)
    if keywords:
        lines += [f"{h2}Keywords", "", keywords, ""]
    lines += [f"{h2}Overview", "", meeting.summary.overview, ""]

    if meeting.chapters:
        lines += [f"{h2}Notes", ""]
        for chapter in meeting.chapters:
            heading = f"{chapter.title} ({format_timestamp(chapter.start_ms)})"
            lines += [f"### {heading}" if md else heading.upper()]
            if chapter.intro:
                lines.append(chapter.intro)
            for point in (p for p in chapter.points if p.parent_id is None):
                stamp = (
                    f" ({format_timestamp(point.start_ms)})" if point.start_ms is not None else ""
                )
                lines.append(f"- {'**' if md else ''}{point.text}{'**' if md else ''}{stamp}")
                for child in (c for c in chapter.points if c.parent_id == point.id):
                    lines.append(f"  - {child.text}")
            lines.append("")

    if meeting.action_items:
        lines += [f"{h2}Action items", ""]
        by_assignee = groupby(
            sorted(meeting.action_items, key=lambda i: i.assignee.name if i.assignee else "~"),
            key=lambda i: i.assignee.name if i.assignee else "Unassigned",
        )
        for assignee, items in by_assignee:
            lines.append(f"**{assignee}**" if md else assignee)
            for item in items:
                box = "[x]" if item.is_completed else "[ ]"
                stamp = f" ({format_timestamp(item.start_ms)})" if item.start_ms is not None else ""
                lines.append(f"- {box} {item.text}{stamp}")
            lines.append("")
    return lines


def _transcript_lines(meeting: Meeting, segments: list[TranscriptSegment], md: bool) -> list[str]:
    names = {speaker.id: speaker.name for speaker in meeting.speakers}
    lines = [f"{'## ' if md else ''}Transcript", ""]
    if not segments:
        return [*lines, "No transcript available.", ""]
    for speaker_id, group in groupby(segments, key=lambda s: s.speaker_id):
        turn = list(group)
        stamp = format_timestamp(turn[0].start_ms)
        speaker = f"**{names[speaker_id]}**" if md else names[speaker_id]
        lines += [f"{speaker} [{stamp}]", " ".join(s.text for s in turn), ""]
    return lines


def export_meeting(
    meeting: Meeting, segments: list[TranscriptSegment], fmt: ExportFormat, content: ExportContent
) -> str:
    md = fmt == "md"
    lines = _header(meeting, md)
    if content in ("summary", "all"):
        lines += _summary_lines(meeting, md)
    if content in ("transcript", "all"):
        lines += _transcript_lines(meeting, segments, md)
    return "\n".join(lines).rstrip() + "\n"
