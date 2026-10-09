"""Extractive meeting summarizer: keywords, overview, chapters (outline) and action items.

It runs locally with no external service. Sentences are scored by how many frequent content words
they contain (a TF-style score), so the most "on topic" sentences become the overview and chapter
bullets. Action items are sentences containing commitment / request phrases.

`summarize()` is the entry point: it uses the Groq LLM when a key is configured and falls back to
this heuristic summarizer whenever the LLM is unavailable.
"""

import logging
import math
import re
from collections import Counter, defaultdict

from app.models import SummaryGenerator
from app.services import groq_client
from app.services.analysis import is_question
from app.services.groq_client import LLMError
from app.services.llm_summarizer import llm_summarize
from app.services.summary_types import ActionItemDraft, ChapterDraft, PointDraft, SummaryDraft
from app.services.text_patterns import ACTION_CUE, STOPWORDS, WORD, content_words
from app.services.transcript_builder import Sentence

MAX_KEYWORDS = 8
MAX_ACTION_ITEMS = 8
POINTS_PER_CHAPTER = 3
SENTENCES_PER_CHAPTER = 22

_FILLER_PREFIX = re.compile(
    r"^(?:(?:so|okay|ok|yeah|yes|well|um|uh|alright|right|and|also|great|perfect|sure|then|"
    r"now|cool|fine|good|thanks|thank you|got it|sounds good|but|plus|of course|to summarize|"
    r"to recap|in summary|absolutely|will do)[,.!]?\s+)+",
    re.IGNORECASE,
)
_SUBJECT_CUE_PREFIX = re.compile(
    r"^(?:i'll|i will|i'm going to|we'll|we will|we need to|we should|we have to|let's|"
    r"i can|let me)\s+(?:(?:plan|try|need) to\s+|also\s+|just\s+)*",
    re.IGNORECASE,
)
_SMALL_WORDS = {"and", "or", "of", "the", "a", "an", "in", "on", "for", "to", "with", "vs"}
_REQUEST_PREFIX = re.compile(r"^(?:can|could|would) you(?: please)?\s+", re.IGNORECASE)
# "Sam, ..." or "Tom will ..." at the start of a sentence names the person responsible.
_ADDRESS_PREFIX = re.compile(r"^(?P<name>[A-Z][a-z]+)(?:,\s+|\s+(?=will\s))(?:will\s+)?")
# Phrases that move the meeting along rather than describe work.
_MEETING_FLOW = re.compile(
    r"\blet's (?:move|start|get started|begin|go through|talk|look|keep|wrap|recap|continue|"
    r"dive|jump|kick off|do a quick)\b|\bthanks for\b|\bi'll be (?:your|joining|out)\b",
    re.IGNORECASE,
)


def _clean(text: str) -> str:
    text = _FILLER_PREFIX.sub("", text.strip())
    return text[:1].upper() + text[1:] if text else text


def _phrase_key(words: list[str]) -> str:
    return " ".join(words)


def _title_case(phrase: str) -> str:
    """'csv export' -> 'CSV Export' style headings; existing capitals (acronyms) are kept."""
    words = phrase.split()
    return " ".join(
        word
        if (index and word.lower() in _SMALL_WORDS) or word[:1].isupper()
        else word[:1].upper() + word[1:]
        for index, word in enumerate(words)
    )


class HeuristicSummarizer:
    def generate(self, sentences: list[Sentence], title: str = "") -> SummaryDraft:
        if not sentences:
            return SummaryDraft(overview="", gist="")

        sentence_words = [content_words(s.text) for s in sentences]
        frequency = Counter(word for words in sentence_words for word in words)
        weights = {word: math.log1p(count) for word, count in frequency.items()}
        scores = [
            self._score(s, words, weights)
            for s, words in zip(sentences, sentence_words, strict=True)
        ]

        keywords = self._keywords(sentences, frequency)
        chapters = self._chapters(sentences, scores, keywords)
        overview_ids = sorted(self._top(range(len(sentences)), scores, 4))
        overview = " ".join(_clean(sentences[i].text) for i in overview_ids)
        gist = self._gist(keywords, title)

        return SummaryDraft(
            overview=overview,
            gist=gist,
            keywords=keywords,
            chapters=chapters,
            action_items=self._action_items(sentences, scores),
        )

    @staticmethod
    def _score(sentence: Sentence, words: list[str], weights: dict[str, float]) -> float:
        word_count = len(sentence.text.split())
        if word_count < 6:
            return 0.0
        score = sum(weights[w] for w in set(words)) / math.sqrt(word_count)
        return score * 0.5 if is_question(sentence.text) else score

    @staticmethod
    def _top(indices: range | list[int], scores: list[float], count: int) -> list[int]:
        ranked = sorted((i for i in indices if scores[i] > 0), key=lambda i: -scores[i])
        return ranked[:count]

    @staticmethod
    def _keywords(sentences: list[Sentence], frequency: Counter[str]) -> list[str]:
        """Frequent two-word phrases first (more descriptive), then frequent single words."""
        phrase_counts: Counter[str] = Counter()
        original_forms: dict[str, Counter[str]] = defaultdict(Counter)
        for sentence in sentences:
            tokens = WORD.findall(sentence.text)
            for first, second in zip(tokens, tokens[1:], strict=False):
                pair = [first.lower(), second.lower()]
                if all(len(w) > 2 and w not in STOPWORDS for w in pair):
                    key = _phrase_key(pair)
                    phrase_counts[key] += 1
                    original_forms[key][f"{first} {second}"] += 1
            for token in tokens:
                original_forms[token.lower()][token] += 1

        candidates: list[tuple[float, str]] = [
            (count * 2.5, key) for key, count in phrase_counts.items() if count >= 2
        ]
        candidates += [(count, key) for key, count in frequency.items() if count >= 2]
        candidates.sort(key=lambda item: -item[0])

        chosen: list[str] = []
        for _, key in candidates:
            words = set(key.split())
            if any(words & set(existing.split()) for existing in chosen):
                continue
            chosen.append(key)
            if len(chosen) == MAX_KEYWORDS:
                break

        def display(key: str) -> str:
            form = original_forms[key].most_common(1)[0][0] if original_forms[key] else key
            return form[:1].upper() + form[1:]

        return [display(key) for key in chosen]

    @staticmethod
    def _gist(keywords: list[str], title: str) -> str:
        topics = [k.lower() if not k.isupper() else k for k in keywords[:3]]
        if not topics:
            return f"Notes for {title}." if title else ""
        if len(topics) == 1:
            return f"The meeting focused on {topics[0]}."
        return f"The meeting covered {', '.join(topics[:-1])} and {topics[-1]}."

    @staticmethod
    def _boundaries(sentences: list[Sentence]) -> list[int]:
        """Start indices of chapters: evenly sized windows snapped to a nearby speaker change."""
        total = len(sentences)
        count = 1 if total < 12 else max(2, min(6, round(total / SENTENCES_PER_CHAPTER)))
        starts = [0]
        for chapter in range(1, count):
            target = round(chapter * total / count)
            nearby = [
                i
                for i in range(max(starts[-1] + 3, target - 5), min(total - 3, target + 6))
                if sentences[i].speaker != sentences[i - 1].speaker
            ]
            start = min(nearby, key=lambda i: abs(i - target)) if nearby else target
            if start > starts[-1]:
                starts.append(start)
        return starts

    @staticmethod
    def _window_terms(sentences: list[Sentence], window: range) -> Counter[str]:
        """Content words and two-word phrases (lower-cased) mentioned in a window."""
        terms: Counter[str] = Counter()
        for index in window:
            tokens = [t.lower() for t in WORD.findall(sentences[index].text)]
            useful = [len(t) > 2 and t not in STOPWORDS and not t.isdigit() for t in tokens]
            terms.update(t for t, ok in zip(tokens, useful, strict=True) if ok)
            for i in range(len(tokens) - 1):
                if useful[i] and useful[i + 1]:
                    terms[f"{tokens[i]} {tokens[i + 1]}"] += 1
        return terms

    def _chapters(
        self,
        sentences: list[Sentence],
        scores: list[float],
        keywords: list[str],
    ) -> list[ChapterDraft]:
        starts = self._boundaries(sentences)
        windows = [
            range(start, starts[i + 1] if i + 1 < len(starts) else len(sentences))
            for i, start in enumerate(starts)
        ]
        # Original casing for display (keeps acronyms like "CSV").
        forms: dict[str, Counter[str]] = defaultdict(Counter)
        for sentence in sentences:
            for token in WORD.findall(sentence.text):
                forms[token.lower()][token] += 1
        keyword_set = {k.lower() for k in keywords}

        def display(term: str) -> str:
            return " ".join(forms[w].most_common(1)[0][0] if forms[w] else w for w in term.split())

        # Terms frequent in one window but rare in the others make distinctive chapter titles.
        window_terms = [self._window_terms(sentences, window) for window in windows]
        document_frequency = Counter(term for terms in window_terms for term in terms)
        used: set[str] = set()

        chapters: list[ChapterDraft] = []
        for index, window in enumerate(windows):
            terms = window_terms[index]

            def weight(term: str, terms: Counter[str] = terms) -> float:
                idf = math.log(1 + len(windows) / document_frequency[term])
                boost = (1.5 if " " in term else 1.0) * (1.3 if term in keyword_set else 1.0)
                return terms[term] * idf * boost

            # Two-word phrases need 2+ mentions; single words need 3+ to be descriptive enough.
            ranked = sorted(
                (t for t in terms if terms[t] >= (2 if " " in t else 3)), key=lambda t: -weight(t)
            )
            title_terms: list[str] = []
            for allow_reuse in (False, True):
                for term in ranked:
                    if len(title_terms) == 2:
                        break
                    overlaps = any(set(term.split()) & set(t.split()) for t in title_terms)
                    if overlaps or (term in used and not allow_reuse):
                        continue
                    title_terms.append(term)
            if not title_terms and terms:  # short window: fall back to its strongest term
                title_terms = [max(terms, key=weight)]
            used.update(title_terms)
            title = " and ".join(_title_case(display(t)) for t in title_terms)

            best = self._top(list(window), scores, POINTS_PER_CHAPTER + 1)
            intro_index = best[0] if best else window.start
            points = sorted(best[1:]) if len(best) > 1 else []
            chapters.append(
                ChapterDraft(
                    title=title or f"Part {index + 1}",
                    intro=_clean(sentences[intro_index].text),
                    start_ms=sentences[window.start].start_ms,
                    end_ms=sentences[window.stop - 1].end_ms,
                    points=[
                        PointDraft(text=_clean(sentences[i].text), start_ms=sentences[i].start_ms)
                        for i in points
                    ],
                )
            )
        return chapters

    @staticmethod
    def _action_text(text: str, first_names: dict[str, str]) -> tuple[str, str | None]:
        """Rewrites a commitment / request as an imperative task.

        Returns (task text, assignee name when the sentence names someone responsible)."""
        text = _FILLER_PREFIX.sub("", text.strip())
        assignee = None
        addressed = _ADDRESS_PREFIX.match(text)
        if addressed and addressed["name"].lower() in first_names:
            assignee = first_names[addressed["name"].lower()]
            text = text[addressed.end() :]
        request = _REQUEST_PREFIX.match(text)
        if request:
            text = text[request.end() :]
        for _ in range(2):  # "Sure, then I'll plan to ..." needs two passes
            text = _SUBJECT_CUE_PREFIX.sub("", _FILLER_PREFIX.sub("", text))
        text = text.rstrip("?.! ")
        return (text[:1].upper() + text[1:], assignee)

    def _action_items(
        self, sentences: list[Sentence], scores: list[float]
    ) -> list[ActionItemDraft]:
        first_names = {s.speaker.split()[0].lower(): s.speaker for s in sentences}
        found: list[tuple[int, ActionItemDraft]] = []
        seen: set[str] = set()

        for index, sentence in enumerate(sentences):
            text = sentence.text
            if len(text.split()) < 5 or not ACTION_CUE.search(text) or _MEETING_FLOW.search(text):
                continue
            task, named = self._action_text(text, first_names)
            key = task.lower()
            if len(task.split()) < 3 or key in seen:
                continue
            seen.add(key)
            draft = ActionItemDraft(
                text=task, assignee=named or sentence.speaker, start_ms=sentence.start_ms
            )
            found.append((index, draft))

        if len(found) > MAX_ACTION_ITEMS:
            found = sorted(found, key=lambda item: -scores[item[0]])[:MAX_ACTION_ITEMS]
        return [draft for _, draft in sorted(found, key=lambda item: item[0])]


logger = logging.getLogger(__name__)


def summarize(sentences: list[Sentence], title: str) -> tuple[SummaryDraft, SummaryGenerator]:
    """LLM notes when Groq is configured, otherwise (or on any LLM failure) the heuristic notes."""
    if sentences and groq_client.is_configured():
        try:
            return llm_summarize(sentences, title), SummaryGenerator.LLM
        except LLMError as exc:
            logger.info("Falling back to the heuristic summarizer: %s", exc)
    return HeuristicSummarizer().generate(sentences, title), SummaryGenerator.HEURISTIC
