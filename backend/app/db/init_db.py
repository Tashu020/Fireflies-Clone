from sqlalchemy import text
from sqlalchemy.engine import Engine

import app.models  # noqa: F401  (registers all models on Base.metadata)
from app.db.base import Base
from app.db.fts import FTS_DDL


def init_db(engine: Engine) -> None:
    """Creates all tables, indexes, the FTS index and its triggers (idempotent)."""
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        for statement in FTS_DDL:
            connection.execute(text(statement))


def drop_db(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS transcript_fts"))
    Base.metadata.drop_all(engine)
