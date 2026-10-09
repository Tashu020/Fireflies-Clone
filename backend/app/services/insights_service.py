"""Smart Search insights for one meeting: AI filters, sentiment, speaker talk time, topics."""

from app.models import Meeting, TranscriptSegment
from app.schemas.meeting import InsightsOut, SentimentStat, SpeakerStat, TopicStat
from app.services.text_patterns import ACTION_CUE, DATE_TIME, METRIC


def _percent(part: int, whole: int) -> float:
    return round(part * 100 / whole, 1) if whole else 0.0


def build_insights(meeting: Meeting, segments: list[TranscriptSegment]) -> InsightsOut:
    action_starts = {item.start_ms for item in meeting.action_items if item.start_ms is not None}
    filters = {
        "questions": [s.id for s in segments if s.is_question],
        "tasks": [
            s.id for s in segments if s.start_ms in action_starts or ACTION_CUE.search(s.text)
        ],
        "dates": [s.id for s in segments if DATE_TIME.search(s.text)],
        "metrics": [s.id for s in segments if METRIC.search(s.text)],
    }

    by_sentiment: dict[str, list[int]] = {"positive": [], "neutral": [], "negative": []}
    for segment in segments:
        by_sentiment[segment.sentiment or "neutral"].append(segment.id)
    total = len(segments)
    sentiment = SentimentStat(
        positive=_percent(len(by_sentiment["positive"]), total),
        neutral=_percent(len(by_sentiment["neutral"]), total),
        negative=_percent(len(by_sentiment["negative"]), total),
        positive_ids=by_sentiment["positive"],
        neutral_ids=by_sentiment["neutral"],
        negative_ids=by_sentiment["negative"],
    )

    talk_ms: dict[int, int] = {}
    words: dict[int, int] = {}
    for segment in segments:
        talk_ms[segment.speaker_id] = talk_ms.get(segment.speaker_id, 0) + (
            segment.end_ms - segment.start_ms
        )
        words[segment.speaker_id] = words.get(segment.speaker_id, 0) + len(segment.text.split())
    total_talk = sum(talk_ms.values())
    speakers = sorted(
        (
            SpeakerStat(
                speaker_id=speaker.id,
                name=speaker.name,
                color_index=speaker.color_index,
                talk_ms=talk_ms.get(speaker.id, 0),
                talk_pct=_percent(talk_ms.get(speaker.id, 0), total_talk),
                word_count=words.get(speaker.id, 0),
                wpm=round(words.get(speaker.id, 0) / (talk_ms[speaker.id] / 60_000))
                if talk_ms.get(speaker.id)
                else 0,
            )
            for speaker in meeting.speakers
        ),
        key=lambda stat: -stat.talk_ms,
    )

    topics = []
    for meeting_topic in meeting.topics:
        name = meeting_topic.topic.name
        needle = name.lower()
        ids = [s.id for s in segments if needle in s.text.lower()]
        topics.append(TopicStat(name=name, count=len(ids), segment_ids=ids))

    return InsightsOut(filters=filters, sentiment=sentiment, speakers=speakers, topics=topics)
