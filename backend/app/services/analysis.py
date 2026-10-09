"""Lightweight, dependency-free text analysis used for Smart Search style insights."""

import re

from app.models import Sentiment

_POSITIVE = {
    "great", "good", "love", "excellent", "awesome", "amazing", "happy", "glad", "excited",
    "perfect", "nice", "thanks", "thank", "appreciate", "helpful", "impressive", "fantastic",
    "agree", "success", "successful", "win", "improved", "improvement", "easy", "smooth",
    "exciting", "strong", "clear", "works", "fast", "better", "best", "solid", "progress",
}  # fmt: skip
_NEGATIVE = {
    "bad", "problem", "problems", "issue", "issues", "concern", "concerned", "worried", "risk",
    "risky", "difficult", "hard", "slow", "broken", "bug", "bugs", "fail", "failed", "failing",
    "frustrated", "frustrating", "unfortunately", "delay", "delayed", "blocker", "blocked",
    "expensive", "confusing", "churn", "worse", "worst", "missing", "late", "pain", "complaint",
}  # fmt: skip
_NEGATIONS = {"not", "no", "never", "don't", "doesn't", "isn't", "wasn't", "aren't", "can't"}
_WORD = re.compile(r"[a-z']+")


def classify_sentiment(text: str) -> Sentiment:
    score = 0
    words = _WORD.findall(text.lower())
    for index, word in enumerate(words):
        polarity = 1 if word in _POSITIVE else -1 if word in _NEGATIVE else 0
        if polarity and index > 0 and words[index - 1] in _NEGATIONS:
            polarity = -polarity
        score += polarity
    if score > 0:
        return Sentiment.POSITIVE
    if score < 0:
        return Sentiment.NEGATIVE
    return Sentiment.NEUTRAL


def is_question(text: str) -> bool:
    return text.rstrip().endswith("?")
