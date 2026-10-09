"""SQLite FTS5 index over transcript sentences.

`transcript_fts` is an *external-content* FTS table: it stores only the search index and reads the
text from `transcript_segments` by rowid. Triggers keep the index in sync on insert/update/delete
(including deletes caused by ON DELETE CASCADE).
"""

from sqlalchemy import ColumnElement, Integer, Text, column, literal_column, table

FTS_DDL: tuple[str, ...] = (
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS transcript_fts USING fts5(
        text,
        content='transcript_segments',
        content_rowid='id',
        tokenize='porter unicode61'
    )
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_ai AFTER INSERT ON transcript_segments BEGIN
        INSERT INTO transcript_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_ad AFTER DELETE ON transcript_segments BEGIN
        INSERT INTO transcript_fts(transcript_fts, rowid, text) VALUES ('delete', old.id, old.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_au AFTER UPDATE OF text ON transcript_segments
    BEGIN
        INSERT INTO transcript_fts(transcript_fts, rowid, text) VALUES ('delete', old.id, old.text);
        INSERT INTO transcript_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
)


transcript_fts = table("transcript_fts", column("rowid", Integer), column("text", Text))


def fts_match(expression: str) -> ColumnElement[bool]:
    """`transcript_fts MATCH :expression` with a bound parameter."""
    return literal_column("transcript_fts").op("MATCH")(expression)


def fts_query(user_input: str) -> str | None:
    """Turns free text into a safe FTS5 MATCH expression: every word must appear, prefix-matched.

    Each token is wrapped in double quotes so FTS operators typed by the user (AND, NEAR, *, -)
    are treated as plain text.
    """
    tokens = ["".join(ch for ch in word if ch.isalnum()) for word in user_input.split()]
    tokens = [token for token in tokens if token]
    if not tokens:
        return None
    return " ".join(f'"{token}"*' for token in tokens)
