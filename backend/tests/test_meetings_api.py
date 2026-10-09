from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API = "/api/v1"
FIXTURES = Path(__file__).parent / "fixtures"


def _first_meeting(client: TestClient, title: str) -> dict:
    items = client.get(f"{API}/meetings", params={"q": title, "limit": 100}).json()["items"]
    return next(item for item in items if item["title"] == title)


def test_list_is_paginated_and_sorted_by_recency(client: TestClient) -> None:
    body = client.get(f"{API}/meetings", params={"limit": 4}).json()
    assert body["total"] == 9 and body["limit"] == 4 and len(body["items"]) == 4
    dates = [item["started_at"] for item in body["items"]]
    assert dates == sorted(dates, reverse=True)

    oldest = client.get(f"{API}/meetings", params={"sort": "oldest", "limit": 1}).json()
    assert oldest["items"][0]["title"].startswith("1:1 Check-in")

    page_two = client.get(f"{API}/meetings", params={"limit": 4, "offset": 4}).json()
    ids = {i["id"] for i in body["items"]} & {i["id"] for i in page_two["items"]}
    assert not ids


def test_list_item_shape(client: TestClient) -> None:
    item = _first_meeting(client, "Weekly Product Sync")
    assert item["duration_sec"] > 0 and item["source"] == "notetaker"
    assert item["host"]["name"] == "Alex Morgan" and item["is_host"] is True
    assert item["participants"][0]["role"] == "host"
    assert any(not p["attended"] for p in item["participants"])  # Daniel was invited, absent
    assert "Slack alerts" in item["keywords"] and item["gist"]
    assert item["started_at"].endswith("Z")


@pytest.mark.parametrize(
    ("params", "expected_total"),
    [
        ({"q": "northwind"}, 3),  # title + transcript keyword
        ({"q": "Globex onboarding"}, 2),  # Globex kickoff + QBR mention
        ({"quick": "hosted"}, 6),
        ({"quick": "shared"}, 3),
        ({"channel": "uploads"}, 1),
        ({"source": "upload"}, 1),
        ({"source": ["notetaker", "mobile"]}, 6),
        ({"duration": "15to30"}, 1),
        ({"duration": ["lt15", "15to30"]}, 9),
        ({"duration": "gt90"}, 0),
    ],
)
def test_list_filters(client: TestClient, params: dict, expected_total: int) -> None:
    response = client.get(f"{API}/meetings", params=params)
    assert response.status_code == 200
    assert response.json()["total"] == expected_total


def test_filter_by_participant_host_topic_and_dates(client: TestClient) -> None:
    people = client.get(f"{API}/people", params={"q": "emily"}).json()
    assert [p["name"] for p in people] == ["Emily Chen"]
    by_person = client.get(f"{API}/meetings", params={"participant": people[0]["id"]}).json()
    assert [m["title"] for m in by_person["items"]] == ["Sales Discovery Call – Northwind Traders"]

    daniel = next(u for u in client.get(f"{API}/users").json() if u["name"] == "Daniel Kim")
    hosted = client.get(f"{API}/meetings", params={"host": daniel["user_id"]}).json()
    assert hosted["total"] == 2

    topic = next(t for t in client.get(f"{API}/topics").json() if t["name"] == "Slack alerts")
    tagged = client.get(f"{API}/meetings", params={"topic": topic["id"]}).json()
    assert tagged["total"] == topic["meeting_count"] == 3

    since = (datetime.now(UTC) - timedelta(days=7)).isoformat()
    recent = client.get(f"{API}/meetings", params={"date_from": since}).json()
    assert recent["total"] == 7


def test_list_rejects_invalid_params(client: TestClient) -> None:
    assert client.get(f"{API}/meetings", params={"limit": 0}).status_code == 422
    assert client.get(f"{API}/meetings", params={"limit": 101}).status_code == 422
    assert client.get(f"{API}/meetings", params={"duration": "forever"}).status_code == 422
    naive = client.get(f"{API}/meetings", params={"date_from": "2024-01-01T00:00:00"})
    assert naive.status_code == 422


def test_meeting_detail_and_transcript(client: TestClient) -> None:
    meeting_id = _first_meeting(client, "Quarterly Business Review – Q3")["id"]
    detail = client.get(f"{API}/meetings/{meeting_id}").json()
    assert detail["summary"]["generator"] == "seed"
    assert len(detail["chapters"]) == 7 and detail["chapters"][0]["points"]
    assert any(p["children"] for c in detail["chapters"] for p in c["points"])
    assert len(detail["action_items"]) == 11
    assert len(detail["speakers"]) == 6

    transcript = client.get(f"{API}/meetings/{meeting_id}/transcript").json()
    assert len(transcript["segments"]) == detail["segment_count"] > 200
    speaker_ids = {s["id"] for s in transcript["speakers"]}
    assert all(seg["speaker_id"] in speaker_ids for seg in transcript["segments"])
    assert client.get(f"{API}/meetings/does-not-exist").status_code == 404


def test_create_meeting_from_pasted_transcript(client: TestClient) -> None:
    text = (FIXTURES / "customer_feedback_review.txt").read_text(encoding="utf-8")
    response = client.post(
        f"{API}/meetings",
        json={
            "title": "Customer Feedback Review",
            "started_at": "2024-05-02T14:00:00Z",
            "participants": [{"name": "Nina Alvarez", "email": "nina@example.com"}],
            "transcript_text": text,
        },
    )
    assert response.status_code == 201, response.text
    meeting = response.json()
    assert meeting["source"] == "paste" and meeting["is_host"] is True
    assert meeting["started_at"] == "2024-05-02T14:00:00Z"
    assert meeting["duration_sec"] == 100  # last line starts at 1:37, estimated at ~2.4 s
    assert {s["name"] for s in meeting["speakers"]} == {"Nina Alvarez", "Leo Grant", "Priyanka Rao"}
    names = [p["name"] for p in meeting["participants"]]
    assert names[0] == "Alex Morgan" and "Nina Alvarez" in names and "Leo Grant" in names
    assert meeting["summary"]["generator"] == "heuristic"
    assert meeting["summary"]["keywords"] and meeting["chapters"]
    texts = [item["text"] for item in meeting["action_items"]]
    assert any("IT approval template" in t for t in texts)
    priyanka = next(i for i in meeting["action_items"] if "template" in i["text"])
    assert priyanka["assignee"]["name"] == "Priyanka Rao"

    listed = client.get(f"{API}/meetings", params={"channel": "uploads"}).json()
    assert listed["total"] == 2


@pytest.mark.parametrize(
    ("filename", "speakers", "duration_sec"),
    [
        ("customer_feedback_review.txt", 3, 100),
        ("standup.vtt", 3, 40),
        ("budget_check_in.json", 2, 32),
        ("retro.srt", 2, 31),
    ],
)
def test_upload_each_supported_format(
    client: TestClient, filename: str, speakers: int, duration_sec: int
) -> None:
    path = FIXTURES / filename
    response = client.post(
        f"{API}/meetings/upload",
        files={"file": (filename, path.read_bytes(), "application/octet-stream")},
        data={"participants": '[{"name": "Guest Person", "email": "guest@example.com"}]'},
    )
    assert response.status_code == 201, response.text
    meeting = response.json()
    assert meeting["source"] == "upload"
    assert meeting["title"] == path.stem.replace("_", " ")
    assert len(meeting["speakers"]) == speakers
    assert meeting["duration_sec"] == duration_sec
    assert any(p["name"] == "Guest Person" and not p["attended"] for p in meeting["participants"])
    transcript = client.get(f"{API}/meetings/{meeting['id']}/transcript").json()
    assert transcript["segments"][0]["start_ms"] >= 0


def test_upload_validation(client: TestClient) -> None:
    bad_type = client.post(f"{API}/meetings/upload", files={"file": ("notes.pdf", b"%PDF", "x")})
    assert bad_type.status_code == 422
    empty = client.post(
        f"{API}/meetings/upload", files={"file": ("empty.txt", b"   ", "text/plain")}
    )
    assert empty.status_code == 422 and "empty" in empty.json()["detail"]
    broken_json = client.post(
        f"{API}/meetings/upload", files={"file": ("x.json", b'[{"speaker": "A"}]', "text/plain")}
    )
    assert broken_json.status_code == 422 and "text" in broken_json.json()["detail"]
    too_big = client.post(
        f"{API}/meetings/upload", files={"file": ("big.txt", b"a" * (5 * 1024 * 1024 + 1), "t")}
    )
    assert too_big.status_code == 413


def test_create_meeting_from_form_without_transcript(client: TestClient) -> None:
    response = client.post(
        f"{API}/meetings",
        json={
            "title": "  Vendor   call ",
            "duration_sec": 1800,
            "participants": [{"name": "Vera Vendor", "email": "VERA@Vendor.example"}],
        },
    )
    assert response.status_code == 201
    meeting = response.json()
    assert meeting["title"] == "Vendor call" and meeting["source"] == "form"
    assert meeting["duration_sec"] == 1800 and meeting["summary"] is None
    assert meeting["participants"][1]["email"] == "vera@vendor.example"
    assert meeting["segment_count"] == 0


def test_create_validation_errors(client: TestClient) -> None:
    assert client.post(f"{API}/meetings", json={"title": ""}).status_code == 422
    bad_email = {"title": "x", "participants": [{"name": "A", "email": "not-an-email"}]}
    assert client.post(f"{API}/meetings", json=bad_email).status_code == 422
    naive_date = {"title": "x", "started_at": "2024-01-01T10:00:00"}
    assert client.post(f"{API}/meetings", json=naive_date).status_code == 422


def test_update_meeting_title_participants_and_rating(client: TestClient) -> None:
    meeting = _first_meeting(client, "Design Review: Dashboard Redesign")
    response = client.patch(
        f"{API}/meetings/{meeting['id']}",
        json={
            "title": "Dashboard Design Review",
            "participants": [
                {"name": "Maria Lopez", "email": "maria.lopez@acme.example"},
                {"name": "New Person", "email": "new.person@example.com"},
            ],
            "summary_rating": 4,
        },
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Dashboard Design Review" and updated["summary_rating"] == 4
    names = [p["name"] for p in updated["participants"]]
    assert names == ["Alex Morgan", "Maria Lopez", "New Person"]
    new_person = updated["participants"][2]
    assert new_person["attended"] is False

    # Persisted
    again = client.get(f"{API}/meetings/{meeting['id']}").json()
    assert again["title"] == "Dashboard Design Review"
    assert (
        client.patch(f"{API}/meetings/{meeting['id']}", json={"summary_rating": 9}).status_code
        == 422
    )


def test_delete_meeting_cascades(client: TestClient) -> None:
    meeting = _first_meeting(client, "Weekly Product Sync")
    assert client.delete(f"{API}/meetings/{meeting['id']}").status_code == 204
    assert client.get(f"{API}/meetings/{meeting['id']}").status_code == 404
    assert client.get(f"{API}/meetings").json()["total"] == 8
    search = client.get(f"{API}/search", params={"q": "activation rate"}).json()
    assert all(r["meeting"]["id"] != meeting["id"] for r in search["results"])
    assert client.delete(f"{API}/meetings/{meeting['id']}").status_code == 404


def test_rename_speaker_and_edit_segment(client: TestClient) -> None:
    meeting = _first_meeting(client, "1:1 Check-in – Alex / Sam")
    detail = client.get(f"{API}/meetings/{meeting['id']}").json()
    sam = next(s for s in detail["speakers"] if s["name"] == "Sam Carter")
    alex = next(s for s in detail["speakers"] if s["name"] == "Alex Morgan")

    renamed = client.patch(
        f"{API}/meetings/{meeting['id']}/speakers/{sam['id']}", json={"name": "Samuel Carter"}
    )
    assert renamed.status_code == 200 and renamed.json()["name"] == "Samuel Carter"
    clash = client.patch(
        f"{API}/meetings/{meeting['id']}/speakers/{sam['id']}", json={"name": "alex morgan"}
    )
    assert clash.status_code == 409
    assert alex["id"] != sam["id"]

    segment = client.get(f"{API}/meetings/{meeting['id']}/transcript").json()["segments"][0]
    edited = client.patch(
        f"{API}/meetings/{meeting['id']}/segments/{segment['id']}",
        json={"text": "Is this the corrected sentence about kangaroos?"},
    )
    assert edited.status_code == 200 and edited.json()["is_question"] is True
    hits = client.get(f"{API}/search", params={"q": "kangaroos"}).json()["results"]
    assert hits and hits[0]["hits"][0]["segment_id"] == segment["id"]


def test_regenerate_summary_keeps_user_action_items(client: TestClient) -> None:
    meeting = _first_meeting(client, "Customer Onboarding – Globex")
    created = client.post(
        f"{API}/meetings/{meeting['id']}/action-items", json={"text": "Send a thank-you note"}
    )
    assert created.status_code == 201
    response = client.post(f"{API}/meetings/{meeting['id']}/summary/regenerate")
    assert response.status_code == 200
    detail = response.json()
    assert detail["summary"]["generator"] == "heuristic"
    assert any(i["text"] == "Send a thank-you note" for i in detail["action_items"])
    assert all(i["source"] == "user" for i in detail["action_items"] if "thank-you" in i["text"])

    form = client.post(f"{API}/meetings", json={"title": "Empty"}).json()
    assert client.post(f"{API}/meetings/{form['id']}/summary/regenerate").status_code == 422


def test_insights(client: TestClient) -> None:
    meeting = _first_meeting(client, "Sales Discovery Call – Northwind Traders")
    insights = client.get(f"{API}/meetings/{meeting['id']}/insights").json()
    assert set(insights["filters"]) == {"questions", "tasks", "dates", "metrics"}
    assert insights["filters"]["questions"] and insights["filters"]["metrics"]
    sentiment = insights["sentiment"]
    assert abs(sentiment["positive"] + sentiment["neutral"] + sentiment["negative"] - 100) < 0.5
    assert round(sum(s["talk_pct"] for s in insights["speakers"])) == 100
    assert all(s["wpm"] > 0 for s in insights["speakers"])
    assert any(t["count"] > 0 for t in insights["topics"])


def test_export_markdown_and_text(client: TestClient) -> None:
    meeting = _first_meeting(client, "Weekly Product Sync")
    md = client.get(f"{API}/meetings/{meeting['id']}/export", params={"format": "md"})
    assert md.status_code == 200
    assert md.headers["content-type"].startswith("text/markdown")
    assert 'filename="weekly-product-sync-all.md"' in md.headers["content-disposition"]
    assert "# Weekly Product Sync" in md.text and "## Action items" in md.text
    assert "- [x] Add dark mode to the product backlog" in md.text
    assert "**Sam Carter** [" in md.text

    txt = client.get(
        f"{API}/meetings/{meeting['id']}/export", params={"format": "txt", "content": "transcript"}
    )
    assert txt.text.startswith("Weekly Product Sync") and "Overview" not in txt.text
