from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DbSession

router = APIRouter(tags=["health"])


@router.api_route("/health", methods=["GET", "HEAD"])
def health(db: DbSession) -> JSONResponse:
    """Liveness + database check, used by the hosting platform's health probe and the uptime
    monitor that keeps the free instance awake (some monitors send HEAD instead of GET)."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "error", "database": "down"})
    return JSONResponse(content={"status": "ok", "database": "ok"})
