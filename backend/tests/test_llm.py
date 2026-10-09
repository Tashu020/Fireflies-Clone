"""The Groq integration, with the network call replaced by canned responses (tests stay offline)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.services import groq_client
from app.services.groq_client import LLMError
from app.services.llm_summarizer import numbered_transcript
from app.services.transcript_builder import Sentence

API = "/api/v1"

TRANSCRIPT = """[00:00:01] Nina Alvarez: Welcome to the launch review. The beta went well.
[00:00:09] Leo Grant: Signups grew forty percent. I will send the metrics deck by Friday.
[00:00:20] Nina Alvarez: Great. Leo, can you also update the pricing page?
[00:00:28] Leo Grant: Yes, I'll update the pricing page tomorrow."""

CANNED_NOTES: dict[str, Any] = {
    "gist": "The team reviewed a successful beta launch.",
    "overview": "The beta went well and signups grew forty percent.",
    "keywords": ["Beta launch", "beta launch", "Pricing page"],
    "chapters": [
        {
            "title": "Follow-ups",
            "intro": "Next steps were agreed.",
            "line": 4,
            "points": [{"text": "Leo will update pricing", "line": 4, "details": ["Due tomorrow"]}],
        },
        {
            "title": "Beta results",
            "intro": "The beta was reviewed.",
            "line": 0,
            "points": [
                {"text": "Signups grew forty percent", "line": 2},
                {"text": "A point with a made-up line number", "line": 999},
            ],
        },
        {"title": "", "points": []},  # invalid chapters are dropped
    ],
    "action_items": [
        {"text": "Send the metrics deck by Friday", "assignee": "Leo Grant", "line": 3},
        {"text": "Update the pricing page", "assignee": "leo", "line": 5},
        {"text": "Book the retro", "assignee": "Somebody Else", "line": "x"},
    ],
}


@pytest.fixture
def fake_groq(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Pretends Groq is configured and records the prompts it receives."""
    prompts: list[str] = []
    monkeypatch.setattr(groq_client, "is_configured", lambda: True)

    def fake_chat_json(system: str, user: str, max_tokens: int = 2048) -> dict[str, Any]:
        prompts.append(user)
        if "Question:" in user:
            return {
                "answer": "Leo owns the pricing page update.",
                "bullets": ["Due tomorrow"],
                "lines": [6, 5, 77],
            }
        return CANNED_NOTES

    monkeypatch.setattr(groq_client, "chat_json", fake_chat_json)
    return prompts


def _create(client: TestClient) -> dict[str, Any]:
    response = client.post(
        f"{API}/meetings", json={"title": "Launch review", "transcript_text": TRANSCRIPT}
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_llm_notes_are_validated_and_mapped_to_timestamps(
    client: TestClient, fake_groq: list[str]
) -> None:
    meeting = _create(client)
    assert meeting["summary"]["generator"] == "llm"
    assert meeting["summary"]["keywords"] == ["Beta launch", "Pricing page"]  # deduplicated

    transcript = client.get(f"{API}/meetings/{meeting['id']}/transcript").json()["segments"]
    starts = [segment["start_ms"] for segment in transcript]
    chapters = meeting["chapters"]
    assert [c["title"] for c in chapters] == ["Beta results", "Follow-ups"]  # sorted by time
    assert chapters[0]["start_ms"] == starts[0] and chapters[1]["start_ms"] == starts[4]
    assert chapters[0]["end_ms"] == chapters[1]["start_ms"]
    assert chapters[0]["points"][1]["start_ms"] is None  # unknown line number is dropped
    assert chapters[1]["points"][0]["children"][0]["text"] == "Due tomorrow"

    items = {item["text"]: item for item in meeting["action_items"]}
    assert items["Send the metrics deck by Friday"]["assignee"]["name"] == "Leo Grant"
    assert items["Update the pricing page"]["assignee"]["name"] == "Leo Grant"  # first-name match
    assert (
        items["Book the retro"]["assignee"] is None and items["Book the retro"]["start_ms"] is None
    )

    assert "[0] 00:01 Nina Alvarez: Welcome to the launch review." in fake_groq[0]


def test_llm_failure_falls_back_to_heuristic_notes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(groq_client, "is_configured", lambda: True)

    def failing(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise LLMError("rate limited")

    monkeypatch.setattr(groq_client, "chat_json", failing)
    meeting = _create(client)
    assert meeting["summary"]["generator"] == "heuristic"
    assert meeting["chapters"] and meeting["action_items"]


def test_incomplete_llm_notes_fall_back(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(groq_client, "is_configured", lambda: True)
    monkeypatch.setattr(groq_client, "chat_json", lambda *a, **k: {"overview": "", "chapters": []})
    assert _create(client)["summary"]["generator"] == "heuristic"


def test_askfred_uses_llm_answer_with_valid_citations(
    client: TestClient, fake_groq: list[str]
) -> None:
    meeting = _create(client)
    answer = client.post(
        f"{API}/meetings/{meeting['id']}/ask", json={"question": "Who updates the pricing page?"}
    ).json()
    assert answer["answer"] == "Leo owns the pricing page update."
    assert answer["bullets"] == ["Due tomorrow"]
    texts = [c["text"] for c in answer["citations"]]
    assert texts == [
        "Leo, can you also update the pricing page?",
        "Yes, I'll update the pricing page tomorrow.",
    ]
    assert "Question: Who updates the pricing page?" in fake_groq[-1]
    assert "Action item (Leo Grant, open)" in fake_groq[-1]


def test_askfred_falls_back_when_llm_fails(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    meeting = _create(client)  # created with the heuristic (Groq not configured in tests)
    monkeypatch.setattr(groq_client, "is_configured", lambda: True)

    def failing(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise LLMError("unreachable")

    monkeypatch.setattr(groq_client, "chat_json", failing)
    answer = client.post(
        f"{API}/meetings/{meeting['id']}/ask", json={"question": "Who attended?"}
    ).json()
    assert answer["answer"].startswith("3 people attended")


def test_chat_json_requires_a_key() -> None:
    assert not groq_client.is_configured()
    with pytest.raises(LLMError):
        groq_client.chat_json("system", "user")


def test_numbered_transcript_fits_the_budget() -> None:
    sentences = [
        Sentence(f"S{i % 2}", f"Sentence number {i} about topic.", i * 1000, i * 1000 + 900)
        for i in range(400)
    ]
    full = numbered_transcript(sentences, max_chars=1_000_000)
    assert full.count("\n") == 399

    sampled = numbered_transcript(sentences, max_chars=2_000)
    lines = sampled.splitlines()
    assert len(sampled) <= 2_100 and lines[0].startswith("[0] ") and lines[-1].startswith("[399] ")

    focused = numbered_transcript(sentences, max_chars=200, priority=[250, 10, 300])
    assert [line.split("]")[0] for line in focused.splitlines()] == ["[10", "[250", "[300"]
