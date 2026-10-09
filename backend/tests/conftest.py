"""Test setup: every test runs against a fresh copy of a seeded SQLite database.

The environment must be configured before `app` is imported, because the engine is created from
settings at import time.
"""

import os
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="fireflies-tests-"))
DB_PATH = _TMP_DIR / "test.db"
TEMPLATE_PATH = _TMP_DIR / "template.db"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
# Tests never call Groq (no network, no quota use); environment values override backend/.env.
os.environ["GROQ_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402


def _remove_db_files() -> None:
    for suffix in ("", "-wal", "-shm"):
        Path(f"{DB_PATH}{suffix}").unlink(missing_ok=True)


@pytest.fixture(scope="session")
def seeded_template() -> Path:
    from app.db.session import engine
    from app.seed.seed import run

    run(engine, reset=True)
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
    engine.dispose()
    shutil.copy(DB_PATH, TEMPLATE_PATH)
    return TEMPLATE_PATH


@pytest.fixture(autouse=True)
def fresh_database(seeded_template: Path) -> Iterator[None]:
    from app.db.session import engine

    engine.dispose()
    _remove_db_files()
    shutil.copy(seeded_template, DB_PATH)
    yield
    engine.dispose()


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def session() -> Iterator[Session]:
    from app.db.session import SessionLocal

    with SessionLocal() as db_session:
        yield db_session
