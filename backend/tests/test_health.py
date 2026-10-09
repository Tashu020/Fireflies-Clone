from fastapi.testclient import TestClient


def test_health_reports_database_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_answers_head_requests_for_uptime_monitors(client: TestClient) -> None:
    response = client.head("/api/v1/health")
    assert response.status_code == 200
    assert response.content == b""
