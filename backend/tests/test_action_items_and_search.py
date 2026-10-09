from fastapi.testclient import TestClient

API = "/api/v1"


def _meeting_id(client: TestClient, title: str) -> str:
    items = client.get(f"{API}/meetings", params={"limit": 100}).json()["items"]
    return next(item["id"] for item in items if item["title"] == title)


def test_action_item_crud(client: TestClient) -> None:
    meeting_id = _meeting_id(client, "Weekly Product Sync")
    me = client.get(f"{API}/me").json()

    created = client.post(
        f"{API}/meetings/{meeting_id}/action-items",
        json={
            "text": "  Book the launch   retro ",
            "assignee_person_id": me["id"],
            "start_ms": 1000,
        },
    )
    assert created.status_code == 201
    item = created.json()
    assert item["text"] == "Book the launch retro" and item["source"] == "user"
    assert item["assignee"]["name"] == "Alex Morgan" and not item["is_completed"]

    done = client.patch(f"{API}/action-items/{item['id']}", json={"is_completed": True}).json()
    assert done["is_completed"] and done["completed_at"] is not None
    reopened = client.patch(f"{API}/action-items/{item['id']}", json={"is_completed": False})
    assert reopened.json()["completed_at"] is None

    edited = client.patch(
        f"{API}/action-items/{item['id']}",
        json={"text": "Book the retro", "assignee_person_id": None},
    ).json()
    assert edited["text"] == "Book the retro" and edited["assignee"] is None

    items = client.get(f"{API}/meetings/{meeting_id}/action-items").json()
    assert items[-1]["id"] == item["id"] and len(items) == 7

    assert client.delete(f"{API}/action-items/{item['id']}").status_code == 204
    assert client.patch(f"{API}/action-items/{item['id']}", json={"text": "x"}).status_code == 404


def test_action_item_validation(client: TestClient) -> None:
    meeting_id = _meeting_id(client, "Weekly Product Sync")
    url = f"{API}/meetings/{meeting_id}/action-items"
    assert client.post(url, json={"text": ""}).status_code == 422
    assert client.post(url, json={"text": "x", "assignee_person_id": 99999}).status_code == 422
    assert client.post(url, json={"text": "x", "start_ms": 99_999_999}).status_code == 422
    assert client.post(url, json={"text": "x", "start_ms": -5}).status_code == 422


def test_tasks_page_scopes(client: TestClient) -> None:
    mine = client.get(f"{API}/action-items").json()
    assert mine["total"] > 0
    assert all(task["assignee"]["name"] == "Alex Morgan" for task in mine["items"])
    assert all(task["meeting"]["title"] for task in mine["items"])

    everyone = client.get(f"{API}/action-items", params={"scope": "all"}).json()
    done = client.get(f"{API}/action-items", params={"scope": "all", "status": "done"}).json()
    open_ = client.get(f"{API}/action-items", params={"scope": "all", "status": "open"}).json()
    assert everyone["total"] == done["total"] + open_["total"]
    assert all(task["is_completed"] for task in done["items"])


def test_global_search_titles_and_transcripts(client: TestClient) -> None:
    body = client.get(f"{API}/search", params={"q": "pricing"}).json()
    titles = [r["meeting"]["title"] for r in body["results"]]
    assert "Sales Discovery Call – Northwind Traders" in titles
    result = body["results"][0]
    assert result["hit_count"] >= len(result["hits"]) > 0
    snippet = result["hits"][0]["snippet"]
    assert "\u0002" in snippet and "\u0003" in snippet
    starts = [hit["start_ms"] for hit in result["hits"]]
    assert starts == sorted(starts)

    title_only = client.get(f"{API}/search", params={"q": "Globex"}).json()["results"]
    assert title_only[0]["title_match"] is True


def test_search_is_safe_with_fts_operators(client: TestClient) -> None:
    for query in ['"', "AND OR NOT", "price*", "NEAR(", "-", "c++", "''", "%_"]:
        response = client.get(f"{API}/search", params={"q": query})
        assert response.status_code == 200, query
    assert client.get(f"{API}/search", params={"q": ""}).status_code == 422


def test_askfred_answers_from_notes_and_transcript(client: TestClient) -> None:
    meeting_id = _meeting_id(client, "Sales Discovery Call – Northwind Traders")
    url = f"{API}/meetings/{meeting_id}/ask"

    tasks = client.post(url, json={"question": "What are the action items?"}).json()
    assert tasks["answer"].startswith("There are 6 action items")
    assert any("Raj Patel" in bullet for bullet in tasks["bullets"])

    recap = client.post(url, json={"question": "Can you summarize the meeting?"}).json()
    assert "Northwind" in recap["answer"] and recap["bullets"]

    people = client.post(url, json={"question": "Who attended?"}).json()
    assert people["answer"].startswith("4 people attended")

    topic = client.post(url, json={"question": "What did they say about data residency in the EU?"})
    citations = topic.json()["citations"]
    assert citations and any("EU" in c["text"] for c in citations)
    assert [c["start_ms"] for c in citations] == sorted(c["start_ms"] for c in citations)

    nothing = client.post(url, json={"question": "kangaroo zebra"}).json()
    assert "couldn't find" in nothing["answer"] and nothing["citations"] == []

    assert client.post(url, json={"question": ""}).status_code == 422
