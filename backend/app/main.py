from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.init_db import init_db
from app.db.session import engine
from app.seed.seed import is_empty, seed
from app.services.users import ensure_default_user


def prepare_database() -> None:
    """Creates the schema, guarantees the default user exists and seeds demo data on first run."""
    init_db(engine)
    with Session(engine) as session:
        if get_settings().seed_on_startup and is_empty(session):
            seed(session)
        else:
            ensure_default_user(session)
            session.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    prepare_database()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    # Transcripts are large, highly compressible JSON payloads.
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    register_error_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
