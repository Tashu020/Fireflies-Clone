import time

import pytest

from app.services.summarizer import HeuristicSummarizer
from app.services.transcript_builder import Sentence, Utterance, build_sentences
from app.services.transcript_parser import (
    TranscriptParseError,
    detect_format,
    parse_timestamp,
    parse_transcript,
)


def test_parse_timestamp() -> None:
    assert parse_timestamp("01:23") == 83_000
    assert parse_timestamp("1:02:03") == 3_723_000
    assert parse_timestamp("00:00:01,250") == 1_250
    assert parse_timestamp("00:00:01.5") == 1_500


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("WEBVTT\n\n00:00.000 --> 00:01.000\nhi", "vtt"),
        ('[{"speaker": "A", "text": "hi"}]', "json"),
        ("[00:01] Ann: hi", "txt"),
        ("1\n00:00:00,000 --> 00:00:01,000\nhi", "srt"),
        ("Ann: hi", "txt"),
    ],
)
def test_detect_format(content: str, expected: str) -> None:
    assert detect_format(content) == expected


def test_txt_variants() -> None:
    content = """
    [00:00:05] Ann Lee: Hello everyone.
    00:00:09 Bob Stone: Hi Ann.
    01:00 - Ann Lee: Moving on.
    Bob Stone (01:10): Sounds good.
    Ann Lee: No timestamp here,
    and this line continues it.
    """
    utterances = parse_transcript(content)
    assert [(u.speaker, u.start_ms) for u in utterances] == [
        ("Ann Lee", 5_000),
        ("Bob Stone", 9_000),
        ("Ann Lee", 60_000),
        ("Bob Stone", 70_000),
        ("Ann Lee", None),
    ]
    assert utterances[-1].text == "No timestamp here, and this line continues it."


def test_txt_header_block_style() -> None:
    content = "Ann Lee  00:03\nFirst point here.\nSecond line.\n\nBob Stone 00:15\nReply: noted.\n"
    utterances = parse_transcript(content)
    assert [(u.speaker, u.start_ms, u.text) for u in utterances] == [
        ("Ann Lee", 3_000, "First point here. Second line."),
        ("Bob Stone", 15_000, "Reply: noted."),
    ]


def test_plain_text_without_speakers_falls_back_to_default_speaker() -> None:
    utterances = parse_transcript("just some notes without any speaker labels")
    assert utterances[0].speaker == "Speaker 1"


def test_vtt_without_voice_tags_uses_speaker_prefix() -> None:
    content = (
        "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nAnn: Hi there.\n\n"
        "00:00:03.500 --> 00:00:05.000\nStill me."
    )
    utterances = parse_transcript(content)
    assert [(u.speaker, u.start_ms, u.end_ms) for u in utterances] == [
        ("Ann", 1_000, 3_000),
        ("Ann", 3_500, 5_000),
    ]


def test_json_variants_and_errors() -> None:
    utterances = parse_transcript(
        '[{"speaker_name": "A", "start_ms": 10, "end_ms": 20, "text": "x"}]'
    )
    assert (utterances[0].speaker, utterances[0].start_ms, utterances[0].end_ms) == ("A", 10, 20)
    with pytest.raises(TranscriptParseError):
        parse_transcript('{"foo": []}', "json")
    with pytest.raises(TranscriptParseError):
        parse_transcript('[{"text": "x", "start": "abc"}]', "json")
    with pytest.raises(TranscriptParseError):
        parse_transcript("{not json", "json")


def _meeting_sentences() -> list[Sentence]:
    turns = [
        ("Ann Lee", "Welcome to the pricing review. Our pricing page converts poorly on mobile."),
        ("Bob Stone", "The pricing page loads slowly, and the mobile layout hides the plans."),
        ("Ann Lee", "Bob, can you fix the mobile layout of the pricing page by Friday?"),
        ("Bob Stone", "Yes, I'll fix the mobile layout and share a preview on Thursday."),
        ("Cara Diaz", "Customer interviews show the enterprise plan is confusing."),
        ("Ann Lee", "Let's rewrite the enterprise plan description before the launch."),
        ("Cara Diaz", "I will draft the new enterprise plan copy this week."),
        ("Bob Stone", "The enterprise plan should also mention single sign on."),
    ] * 4
    return build_sentences([Utterance(speaker, text) for speaker, text in turns])


def test_heuristic_summary_structure() -> None:
    sentences = _meeting_sentences()
    draft = HeuristicSummarizer().generate(sentences, "Pricing review")

    lowered = [k.lower() for k in draft.keywords]
    assert "pricing page" in lowered and "enterprise plan" in lowered
    assert len(draft.keywords) <= 8
    assert draft.gist.startswith("The meeting covered")
    assert draft.overview

    starts = {s.start_ms for s in sentences}
    assert 1 <= len(draft.chapters) <= 6
    for chapter in draft.chapters:
        assert chapter.title and chapter.start_ms in starts and chapter.end_ms >= chapter.start_ms
        assert all(point.start_ms in starts for point in chapter.points)
    chapter_starts = [c.start_ms for c in draft.chapters]
    assert chapter_starts == sorted(chapter_starts)


def test_heuristic_action_items_have_assignees_and_imperative_text() -> None:
    draft = HeuristicSummarizer().generate(_meeting_sentences(), "Pricing review")
    by_text = {item.text: item.assignee for item in draft.action_items}
    assert by_text["Fix the mobile layout of the pricing page by Friday"] == "Bob Stone"
    assert by_text["Draft the new enterprise plan copy this week"] == "Cara Diaz"
    assert len(draft.action_items) <= 8
    assert len(by_text) == len(draft.action_items)  # deduplicated


def test_empty_transcript_summary() -> None:
    draft = HeuristicSummarizer().generate([], "Nothing")
    assert draft.overview == "" and draft.chapters == [] and draft.action_items == []


def test_large_transcript_builds_and_summarizes_quickly() -> None:
    """NFR: a ~5,000 sentence transcript parses and summarizes in under 2 s (typically ~0.5 s); the
    assertion leaves headroom so a busy CI machine does not make the test flaky."""
    lines = [
        f"Speaker {i % 4}: We reviewed item {i} of the roadmap and agreed the next step is clear. "
        f"I'll follow up on the budget for project {i % 37} next week."
        for i in range(2500)
    ]
    start = time.perf_counter()
    sentences = build_sentences(parse_transcript("\n".join(lines)))
    draft = HeuristicSummarizer().generate(sentences, "Big meeting")
    elapsed = time.perf_counter() - start
    assert len(sentences) == 5000
    assert draft.chapters and draft.action_items
    assert elapsed < 5.0, f"took {elapsed:.2f}s"
