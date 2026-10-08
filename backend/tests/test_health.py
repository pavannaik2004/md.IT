"""Health endpoints with fake readiness checks (P-050)."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.readiness import ReadinessChecks
from tests.support import fake_settings


def make_client(database: bool = True, migrations: bool = True, blob: bool = True) -> TestClient:
    checks = ReadinessChecks(
        database=lambda: database, migrations=lambda: migrations, blob=lambda: blob
    )
    return TestClient(create_app(fake_settings(), checks))


def test_liveness_needs_nothing() -> None:
    response = make_client(database=False, migrations=False, blob=False).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_when_every_check_passes() -> None:
    response = make_client().get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "migrations": "ok", "blob": "ok"},
    }


@pytest.mark.parametrize(
    ("failing", "unavailable"),
    [
        # Migrations can't be read without the database.
        ("database", {"database", "migrations"}),
        ("migrations", {"migrations"}),
        ("blob", {"blob"}),
    ],
)
def test_not_ready_when_one_check_fails(failing: str, unavailable: set[str]) -> None:
    response = make_client(**{failing: False}).get("/api/health/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["checks"] == {
        name: "unavailable" if name in unavailable else "ok"
        for name in ("database", "migrations", "blob")
    }


def test_migrations_are_not_checked_when_the_database_is_down() -> None:
    # Each check against an unreachable database can take seconds (DNS); don't pay twice.
    calls: list[str] = []

    def migrations() -> bool:
        calls.append("migrations")
        return True

    checks = ReadinessChecks(database=lambda: False, migrations=migrations, blob=lambda: True)
    response = TestClient(create_app(fake_settings(), checks)).get("/api/health/ready")
    assert response.status_code == 503
    assert response.json()["checks"]["migrations"] == "unavailable"
    assert calls == []


def test_openapi_and_docs_live_under_api() -> None:
    client = make_client()
    openapi = client.get("/api/openapi.json")
    assert openapi.status_code == 200
    assert "/api/health/ready" in openapi.json()["paths"]
    assert client.get("/api/docs").status_code == 200
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_unknown_api_route_uses_the_error_shape() -> None:
    response = make_client().get("/api/nope")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
