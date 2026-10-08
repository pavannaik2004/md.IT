"""Health endpoints (P-050). Both are public."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.readiness import ReadinessChecks

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
def health() -> dict[str, str]:
    """Liveness: the process answers. Never touches the database or Blob Storage."""
    return {"status": "ok"}


@router.get("/ready", responses={503: {"description": "A dependency is unavailable"}})
def ready(request: Request) -> JSONResponse:
    """Readiness: database, migrations at head, blob container. Details stay in the logs."""
    checks: ReadinessChecks = request.app.state.readiness
    results = {
        "database": checks.database(),
        "migrations": checks.migrations(),
        "blob": checks.blob(),
    }
    ok = all(results.values())
    body = {
        "status": "ok" if ok else "unavailable",
        "checks": {name: "ok" if passed else "unavailable" for name, passed in results.items()},
    }
    return JSONResponse(body, status_code=200 if ok else 503)
