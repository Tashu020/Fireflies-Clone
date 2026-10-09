from app.services.analysis import classify_sentiment, is_question
from app.services.transcript_builder import (
    TURN_GAP_MS,
    Utterance,
    build_sentences,
    split_sentences,
)


def test_split_sentences_handles_punctuation_and_abbreviations() -> None:
    text = "Hi Dr. Smith. Are we ready? Yes!  Let's go. Version 2.4 ships soon."
    assert split_sentences(text) == [
        "Hi Dr. Smith.",
        "Are we ready?",
        "Yes!",
        "Let's go.",
        "Version 2.4 ships soon.",
    ]


def test_untimed_utterances_get_sequential_estimated_times() -> None:
    sentences = build_sentences(
        [Utterance("Ann", "Hello there. How are you?"), Utterance("Bob", "Great, thanks.")]
    )
    assert [s.speaker for s in sentences] == ["Ann", "Ann", "Bob"]
    assert sentences[0].start_ms == 0
    assert sentences[1].start_ms == sentences[0].end_ms
    assert sentences[2].start_ms == sentences[1].end_ms + TURN_GAP_MS


def test_timed_utterances_keep_their_times_and_fill_missing_ends() -> None:
    sentences = build_sentences(
        [
            Utterance("Ann", "First point. Second point.", start_ms=5_000),
            Utterance("Bob", "Reply.", start_ms=9_000, end_ms=10_000),
        ]
    )
    assert sentences[0].start_ms == 5_000
    assert sentences[1].end_ms == 9_000  # ends where the next timed utterance starts
    assert (sentences[2].start_ms, sentences[2].end_ms) == (9_000, 10_000)


def test_overlapping_input_times_are_made_monotonic() -> None:
    sentences = build_sentences(
        [
            Utterance("Ann", "One.", start_ms=0, end_ms=4_000),
            Utterance("Bob", "Two.", start_ms=3_000),
        ]
    )
    assert sentences[1].start_ms >= sentences[0].end_ms


def test_sentiment_and_question_detection() -> None:
    assert classify_sentiment("This is great, thanks!").value == "positive"
    assert classify_sentiment("The export is broken and slow.").value == "negative"
    assert classify_sentiment("That is not good.").value == "negative"
    assert classify_sentiment("We meet on Tuesday.").value == "neutral"
    assert is_question("Can you own that? ")
    assert not is_question("I can own that.")
