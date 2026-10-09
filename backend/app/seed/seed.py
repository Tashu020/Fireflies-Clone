"""Loads the demo workspace: fictional people, users and meetings with transcripts and summaries.

Fixtures live in `app/seed/data/`. Summary bullets and action items point at transcript moments with
an `at` snippet (a short quote from the transcript); the loader resolves each snippet to the start
time of the first sentence containing it, so timestamps always match the transcript exactly.

Usage:  python -m app.seed            (seed only if the database is empty)
        python -m app.seed --reset    (drop everything and reload)
"""

import argparse
import json
from datetime import timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db.init_db import drop_db, init_db
from app.db.types import utcnow
from app.models import Meeting, MeetingSource, Person, SummaryGenerator, User
from app.services.meeting_writer import (
    apply_summary,
    get_or_create_person,
    set_participants,
    stable_public_id,
    write_transcript,
)
from app.services.summary_types import ActionItemDraft, ChapterDraft, PointDraft, SummaryDraft
from app.services.transcript_builder import Sentence, Utterance, build_sentences
from app.services.users import ensure_default_user

DATA_DIR = Path(__file__).parent / "data"


class SeedError(ValueError):
    pass


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_transcript(lines: list[str], title: str) -> list[Utterance]:
    utterances = []
    for line in lines:
        speaker, sep, text = line.partition(":")
        if not sep:
            raise SeedError(f"[{title}] transcript line without 'Speaker:' prefix: {line[:60]}")
        utterances.append(Utterance(speaker=speaker.strip(), text=text.strip()))
    return utterances


def _resolver(sentences: list[Sentence], title: str):
    def resolve(snippet: str) -> int:
        needle = snippet.lower()
        for sentence in sentences:
            if needle in sentence.text.lower():
                return sentence.start_ms
        raise SeedError(f"[{title}] snippet not found in transcript: {snippet!r}")

    return resolve


def _summary_draft(spec: dict[str, Any], sentences: list[Sentence], title: str) -> SummaryDraft:
    resolve = _resolver(sentences, title)
    end_of_meeting = sentences[-1].end_ms
    chapter_specs = spec["chapters"]
    starts = [resolve(chapter["at"]) for chapter in chapter_specs]
    if starts != sorted(starts):
        raise SeedError(f"[{title}] chapters are not in chronological order")

    chapters = [
        ChapterDraft(
            title=chapter["title"],
            intro=chapter.get("intro", ""),
            start_ms=starts[index],
            end_ms=starts[index + 1] if index + 1 < len(starts) else end_of_meeting,
            points=[
                PointDraft(
                    text=point["text"],
                    start_ms=resolve(point["at"]) if point.get("at") else None,
                    children=point.get("children", []),
                )
                for point in chapter["points"]
            ],
        )
        for index, chapter in enumerate(chapter_specs)
    ]
    action_items = [
        ActionItemDraft(
            text=item["text"],
            assignee=item.get("assignee"),
            start_ms=resolve(item["at"]) if item.get("at") else None,
            completed=item.get("completed", False),
        )
        for item in spec["action_items"]
    ]
    return SummaryDraft(
        overview=spec["overview"],
        gist=spec["gist"],
        keywords=spec["keywords"],
        chapters=chapters,
        action_items=action_items,
    )


def _seed_people(session: Session) -> dict[str, Person]:
    people: dict[str, Person] = {}
    for entry in _load_json(DATA_DIR / "people.json"):
        person = get_or_create_person(session, entry["name"], entry["email"])
        session.flush()
        is_user = session.scalar(select(User).where(User.person_id == person.id)) is not None
        if entry.get("workspace_user") and not is_user:
            session.add(User(person=person))
        people[entry["email"]] = person
    session.flush()
    return people


def _seed_meeting(session: Session, spec: dict[str, Any], people: dict[str, Person]) -> Meeting:
    title = spec["title"]
    by_name = {person.name: person for person in people.values()}
    utterances = _parse_transcript(spec["transcript"], title)
    unknown = {u.speaker for u in utterances} - by_name.keys()
    if unknown:
        raise SeedError(f"[{title}] speakers missing from people.json: {sorted(unknown)}")

    host_person = people[spec["host"]]
    host_user = session.scalar(select(User).where(User.person_id == host_person.id))
    if host_user is None:
        raise SeedError(f"[{title}] host {spec['host']} is not a workspace user")

    now = utcnow().replace(second=0, microsecond=0)
    started_at = now - timedelta(days=spec["days_ago"], hours=spec.get("hours_ago", 0))
    meeting = Meeting(
        public_id=stable_public_id(f"seed:{title}"),
        title=title,
        host=host_user,
        host_user_id=host_user.id,
        started_at=started_at.replace(minute=(started_at.minute // 5) * 5),
        language="en",
        source=MeetingSource(spec["source"]).value,
        created_at=started_at,
    )

    participants = [people[email] for email in spec["participants"]]
    absent = {people[email].id for email in spec.get("absent", [])}
    set_participants(
        meeting,
        host=host_person,
        people=participants,
        attended={p.id for p in [host_person, *participants]} - absent,
    )

    sentences = build_sentences(utterances)
    write_transcript(meeting, sentences, {u.speaker: by_name[u.speaker] for u in utterances})
    session.add(meeting)
    session.flush()

    draft = _summary_draft(spec["summary"], sentences, title)
    apply_summary(session, meeting, draft, SummaryGenerator.SEED.value, by_name)
    return meeting


def seed(session: Session) -> int:
    """Seeds people, users and every meeting fixture. Returns the number of meetings created."""
    ensure_default_user(session)
    people = _seed_people(session)
    meeting_files = sorted(DATA_DIR.glob("meeting_*.json"))
    for path in meeting_files:
        _seed_meeting(session, _load_json(path), people)
    session.commit()
    return len(meeting_files)


def is_empty(session: Session) -> bool:
    return session.scalar(select(Meeting.id).limit(1)) is None


def run(engine: Engine, reset: bool = False) -> int:
    if reset:
        drop_db(engine)
    init_db(engine)
    with Session(engine) as session:
        if not reset and not is_empty(session):
            return 0
        return seed(session)


def main() -> None:
    from app.db.session import engine

    parser = argparse.ArgumentParser(description="Seed the demo database.")
    parser.add_argument("--reset", action="store_true", help="drop all data before seeding")
    args = parser.parse_args()
    count = run(engine, reset=args.reset)
    print(f"Seeded {count} meetings." if count else "Database already contains data; skipped.")


if __name__ == "__main__":
    main()
