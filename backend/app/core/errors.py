from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.services.transcript_parser import TranscriptParseError


class AppError(Exception):
    """Domain error with an HTTP status. `detail` is safe to show to end users."""

    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class InvalidInputError(AppError):
    status_code = 422


class PayloadTooLargeError(AppError):
    status_code = 413


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(TranscriptParseError)
    async def _parse_error(_request: Request, exc: TranscriptParseError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(exc)})
