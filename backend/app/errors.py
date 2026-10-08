"""One error shape for every failure: {"error": {"code", "message"}} (P-052)."""

from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_CODES = {404: "not_found", 405: "method_not_allowed"}


def error_response(
    status: int, code: str, message: str, details: list[dict[str, str]] | None = None
) -> JSONResponse:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return JSONResponse({"error": error}, status_code=status)


def _message(status: int, detail: object) -> str:
    phrase = HTTPStatus(status).phrase
    if isinstance(detail, str) and detail and detail != phrase:
        return detail
    return phrase.capitalize() + "."


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        status = exc.status_code
        response = error_response(
            status, _CODES.get(status, f"http_{status}"), _message(status, exc.detail)
        )
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"field": ".".join(str(part) for part in err["loc"]), "message": str(err["msg"])}
            for err in exc.errors()
        ]
        return error_response(422, "invalid_request", "The request is not valid.", details)

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        # Starlette re-raises after this response is sent, so Uvicorn logs the traceback.
        return error_response(500, "internal_error", "Something went wrong.")
