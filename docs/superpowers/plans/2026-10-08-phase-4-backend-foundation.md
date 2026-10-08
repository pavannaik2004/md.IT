# Phase 4 — Backend foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** md.IT gets a FastAPI backend with health endpoints, the full PRD §9.2 MySQL schema under Alembic, a tested Blob Storage wrapper, a Docker Compose stack (MySQL, Azurite, migrate, backend, frontend, gateway) that `docker compose up` starts, and CI that tests all of it.

**Architecture:** `backend/app` is a small FastAPI application built by `create_app()` (run by Uvicorn with `--factory`). Settings come only from environment variables. `db/` holds the SQLAlchemy models and engine, `storage/` the Blob Storage wrapper, `readiness.py` the dependency checks, and `routes/health.py` the two health endpoints. Migrations run as their own Compose service before the backend starts. A Compose `gateway` (nginx) routes `/api/` to the backend and everything else to the unchanged frontend image, the way the Kubernetes Ingress will in Phase 6. Integration tests run against the real MySQL and Azurite from the same Compose file.

**Tech Stack:** Python 3.14, uv 0.12 (`uv.lock`), FastAPI 0.142 (Starlette 1.7), Uvicorn 0.54, Pydantic 2.13, pydantic-settings 2.15, SQLAlchemy 2.0.54 (sync), PyMySQL 1.2 + cryptography 50, Alembic 1.20, azure-storage-blob 12.31; pytest 9.1, httpx2 2.13, ruff 0.16, mypy 2.4; MySQL 8.4, Azurite 3.37.0, nginx 1.28; GitHub Actions with dorny/paths-filter v4 and astral-sh/setup-uv v10.2.0. Frontend unchanged apart from a Vite dev proxy.

**Spec:** `docs/superpowers/specs/2026-10-08-phase-4-backend-foundation-design.md` (read it with this plan). Decisions P-044…P-054 in `decisions.md`.

## Global Constraints

- Commands run from the repo root unless a step says `cd backend` or `cd frontend`. Shell is Git Bash on Windows; use forward slashes.
- uv is not on PATH on this machine: run it as `python -m uv …` (in CI and in Docker it is plain `uv`). Every `uv run …` below means `python -m uv run …` locally.
- **Progress logging (CLAUDE.md):** before a task, read `context.md` and the recent `decisions.md` entries. After it, append `- YYYY-MM-DD — Phase 4 Task N: <what> (<files>; <backend tests passed/skipped>)` (real date) to the **Log**, keep **Current state** accurate, add any new decision to `decisions.md`, and commit those edits with the task's code.
- Branch `phase-4-backend-foundation`; never commit to `main`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Backend checks (from `backend/`): `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy app`, `uv run pytest`. Every backend task ends with all four green. Run `uv run ruff format .` before checking if formatting changed.
- Integration tests need `docker compose up -d --wait mysql azurite` (from Task 2 on). Without them those tests **skip** locally; with `MDIT_REQUIRE_SERVICES=1` they **fail**. Before a task's final check, run the services so integration tests actually run; report passed and skipped counts.
- Error shape: `{"error": {"code": str, "message": str}}`, plus `details: [{"field", "message"}]` for 422. Messages are sentence case and end with a full stop.
- Configuration names: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `BLOB_CONNECTION_STRING`, `BLOB_CONTAINER`, `LOG_LEVEL`. Compose dev defaults: database `mdit`, user `mdit`, password `mdit-dev-password`, container `mdit-blobs`, level `INFO`. Test database `mdit_test`.
- Nothing logs request bodies, headers, cookies, connection strings or passwords. Secrets are `SecretStr`.
- Pinned images: `mysql:8.4`, `mcr.microsoft.com/azure-storage/azurite:3.37.0` (always with `--skipApiVersionCheck`), `python:3.14-slim`, `ghcr.io/astral-sh/uv:0.12`, `nginx:1.28-alpine`.
- `backend/app/db/` and `backend/app/storage/` never import from `app/routes/` or `app/main.py`.
- Frontend: `frontend/Dockerfile` and `frontend/nginx/` do not change. After the Vite change, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` stay green.

## Review Focus

1. **Readiness while a dependency is down** (database stopped, Azurite not started yet): `/api/health/ready` answers 503 within a few seconds with only that check `unavailable`, and `/api/health` stays 200. The SDK's default retries would take ~90 s. Tests: Task 4 `test_unreachable_storage_is_reported_quickly`, Task 6 `test_database_check_reports_an_unreachable_database`.
2. **A backend that starts before Azurite** has no container yet: readiness creates it on the next check rather than failing forever. Test: Task 6 `test_startup_creates_the_blob_container` plus `ensure_container` creating when missing (Task 4 `test_ensure_container_creates_a_missing_container`).
3. **A database password with `@ : / # %`**: the URL is built, not formatted, so connecting works. Test: Task 1 `test_database_url_keeps_special_characters_in_password`.
4. **An exception carrying secrets** (e.g. a driver error with a password in it): the 500 body is only `Something went wrong.` Test: Task 5 `test_unhandled_errors_hide_details`.
5. **Integration tests with services down**: local runs skip with the start hint, CI fails. Test: Task 2 `test_services_unavailable_skips_or_fails`.

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `backend/pyproject.toml`, `uv.lock`, `.python-version` | 1 | dependencies, ruff / mypy / pytest config |
| `backend/app/config.py` | 1 | `Settings`, `database_url()` |
| `backend/tests/test_config.py` | 1 | settings tests |
| `docker-compose.yml` | 2, 7 | Task 2: mysql + azurite; Task 7: migrate, backend, frontend, gateway |
| `mysql/init/01-test-db.sh` | 2 | creates `mdit_test` |
| `backend/app/db/session.py` | 2 | `create_db_engine()`, `get_session()` |
| `backend/tests/support.py`, `conftest.py` | 2, 3, 4 | test settings, service availability, alembic config, fixtures |
| `backend/tests/test_db_session.py` | 2 | engine and session tests |
| `backend/app/db/base.py`, `models.py` | 3 | declarative base with naming convention; five tables |
| `backend/alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/0001_initial_schema.py` | 3 | migrations |
| `backend/tests/test_migrations.py`, `test_schema.py` | 3 | migration and schema rule tests |
| `backend/app/storage/blobs.py` | 4 | `BlobStore` |
| `backend/tests/test_blobs.py` | 4 | blob tests |
| `backend/app/errors.py` | 5 | error shape and handlers |
| `backend/tests/test_errors.py` | 5 | error tests |
| `backend/app/logging.py`, `readiness.py`, `routes/health.py`, `main.py` | 6 | logging, readiness checks, health routes, app factory |
| `backend/tests/test_health.py`, `test_readiness.py`, `test_app.py` | 6 | unit and integration tests |
| `backend/Dockerfile`, `.dockerignore`, `gateway/default.conf`, `.env.example`, `frontend/vite.config.ts` | 7 | images, gateway, dev proxy |
| `.github/workflows/ci.yml` | 8 | CI |
| `README.md`, `context.md`, `decisions.md` | 9 | docs and verification |

---

### Task 1: Backend project and settings

**Files:**
- Create: `backend/pyproject.toml`, `backend/.python-version`, `backend/uv.lock` (generated), `backend/app/__init__.py`, `backend/app/config.py`, `backend/tests/__init__.py`, `backend/tests/test_config.py`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `class Settings(BaseSettings)` with fields `db_host: str`, `db_port: int = 3306`, `db_name: str = "mdit"`, `db_user: str = "mdit"`, `db_password: SecretStr`, `blob_connection_string: SecretStr`, `blob_container: str = "mdit-blobs"`, `log_level: Literal["DEBUG","INFO","WARNING","ERROR"] = "INFO"` (frozen); `database_url(settings: Settings) -> sqlalchemy.URL`.

- [ ] **Step 1: Create the project files**

`backend/.python-version`:

```text
3.14
```

`backend/pyproject.toml`:

```toml
[project]
name = "mdit-backend"
version = "0.1.0"
description = "md.IT version service"
requires-python = ">=3.14,<3.15"
dependencies = [
  "fastapi>=0.142.4,<0.143",
  "uvicorn[standard]>=0.54,<0.55",
  "pydantic>=2.13,<2.14",
  "pydantic-settings>=2.15,<2.16",
  "sqlalchemy>=2.0.54,<2.1",
  "pymysql>=1.2,<1.3",
  "cryptography>=50,<51",
  "alembic>=1.20,<1.21",
  "azure-storage-blob>=12.31,<12.32",
]

[dependency-groups]
dev = [
  "pytest>=9.1,<9.2",
  "httpx2>=2.13,<2.14",
  "ruff>=0.16,<0.17",
  "mypy>=2.4,<2.5",
]

[tool.uv]
package = false

[tool.ruff]
line-length = 100
target-version = "py314"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.mypy]
strict = true
python_version = "3.14"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
addopts = "-ra"
markers = ["integration: needs MySQL and Azurite (docker compose up -d --wait mysql azurite)"]
```

Empty files: `backend/app/__init__.py`, `backend/tests/__init__.py`.

Append to `.gitignore`:

```text
.pytest_cache/
.mypy_cache/
.ruff_cache/
```

- [ ] **Step 2: Install and lock**

Run: `cd backend && python -m uv sync`
Expected: Python 3.14 downloaded if needed, `.venv/` created, `uv.lock` written. `uv run python --version` prints `Python 3.14.x`.

- [ ] **Step 3: Write the failing tests** — `backend/tests/test_config.py`

```python
"""Settings come only from environment variables (PRD 10.4, P-052)."""

import pytest
from pydantic import ValidationError

from app.config import Settings, database_url

NAMES = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "BLOB_CONNECTION_STRING",
    "BLOB_CONTAINER",
    "LOG_LEVEL",
]
REQUIRED = {
    "DB_HOST": "db.internal",
    "DB_PASSWORD": "secret-password",
    "BLOB_CONNECTION_STRING": "UseDevelopmentStorage=true",
}


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch):
    for name in NAMES:
        monkeypatch.delenv(name, raising=False)

    def set_env(**values: str) -> None:
        for name, value in values.items():
            monkeypatch.setenv(name, value)

    return set_env


def test_reads_required_values_and_defaults(env) -> None:
    env(**REQUIRED)
    settings = Settings()
    assert settings.db_host == "db.internal"
    assert settings.db_port == 3306
    assert settings.db_name == "mdit"
    assert settings.db_user == "mdit"
    assert settings.db_password.get_secret_value() == "secret-password"
    assert settings.blob_container == "mdit-blobs"
    assert settings.log_level == "INFO"


def test_missing_required_values_fail(env) -> None:
    with pytest.raises(ValidationError) as info:
        Settings()
    missing = {error["loc"][0] for error in info.value.errors()}
    assert missing == {"db_host", "db_password", "blob_connection_string"}


def test_secrets_stay_out_of_repr(env) -> None:
    env(**REQUIRED)
    text = repr(Settings())
    assert "secret-password" not in text
    assert "UseDevelopmentStorage" not in text


def test_log_level_ignores_case(env) -> None:
    env(**REQUIRED, LOG_LEVEL="debug")
    assert Settings().log_level == "DEBUG"


def test_rejects_an_unknown_log_level(env) -> None:
    env(**REQUIRED, LOG_LEVEL="loud")
    with pytest.raises(ValidationError):
        Settings()


def test_database_url_keeps_special_characters_in_password(env) -> None:
    env(**{**REQUIRED, "DB_PASSWORD": "p@ss:/w#rd%", "DB_PORT": "3307"})
    url = database_url(Settings())
    assert url.drivername == "mysql+pymysql"
    assert url.username == "mdit"
    assert url.password == "p@ss:/w#rd%"
    assert url.host == "db.internal"
    assert url.port == 3307
    assert url.database == "mdit"
    assert dict(url.query) == {"charset": "utf8mb4"}
    assert "p@ss" not in url.render_as_string(hide_password=True)
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd backend && python -m uv run pytest tests/test_config.py -q`
Expected: collection error `ModuleNotFoundError: No module named 'app.config'`.

- [ ] **Step 5: Implement** — `backend/app/config.py`

```python
"""Settings read from environment variables only (PRD section 10.4, P-052)."""

from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, extra="ignore")

    db_host: str
    db_port: int = 3306
    db_name: str = "mdit"
    db_user: str = "mdit"
    db_password: SecretStr
    blob_connection_string: SecretStr
    blob_container: str = "mdit-blobs"
    log_level: LogLevel = "INFO"

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value


def database_url(settings: Settings) -> URL:
    """Built, not formatted, so passwords need no escaping."""
    return URL.create(
        "mysql+pymysql",
        username=settings.db_user,
        password=settings.db_password.get_secret_value(),
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
        query={"charset": "utf8mb4"},
    )
```

- [ ] **Step 6: Run the checks**

Run: `cd backend && python -m uv run pytest -q && python -m uv run ruff check . && python -m uv run ruff format --check . && python -m uv run mypy app`
Expected: `6 passed`; ruff and mypy clean. (If ruff rejects `target-version = "py314"`, use `"py313"` and note it in the log.)

- [ ] **Step 7: Log and commit**

Append the Task 1 log line to `context.md`; set **Phase** to `4 (backend foundation) — building (Task 1 of 9 done)`.

```bash
git add .gitignore backend/pyproject.toml backend/uv.lock backend/.python-version backend/app backend/tests context.md
git commit -m "feat(backend): project with uv, settings from environment variables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Local MySQL and Azurite, database engine, test fixtures

**Files:**
- Create: `docker-compose.yml`, `mysql/init/01-test-db.sh`, `backend/app/db/__init__.py`, `backend/app/db/session.py`, `backend/tests/support.py`, `backend/tests/conftest.py`, `backend/tests/test_db_session.py`, `backend/tests/test_support.py`

**Interfaces:**
- Consumes: `Settings`, `database_url` (Task 1).
- Produces: `create_db_engine(settings: Settings) -> Engine` (pool pre-ping, `connect_timeout=2`, session time zone `+00:00`); `get_session(request: Request) -> Iterator[Session]` (uses `request.app.state.engine`); `tests.support`: `AZURITE_ACCOUNT_KEY`, `azurite_connection_string(host="127.0.0.1", port=10000) -> str`, `make_test_settings() -> Settings` (database `mdit_test`, unique container `test-<12 hex>`), `fake_settings(**overrides) -> Settings` (points at port 1, nothing listens), `services_unavailable(reason: str) -> NoReturn`; fixtures `test_settings` (session), `engine` (session; skips/fails when MySQL is down).

- [ ] **Step 1: Compose with MySQL and Azurite** — `docker-compose.yml`

```yaml
# md.IT local stack (PRD 10.1). `docker compose up` starts everything; defaults are for
# local development only. Override them in a .env file (see .env.example).
name: mdit

services:
  mysql:
    image: mysql:8.4
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_0900_ai_ci"]
    environment:
      MYSQL_RANDOM_ROOT_PASSWORD: "yes"
      MYSQL_DATABASE: ${DB_NAME:-mdit}
      MYSQL_USER: ${DB_USER:-mdit}
      MYSQL_PASSWORD: ${DB_PASSWORD:-mdit-dev-password}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./mysql/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      # TCP, so the temporary server MySQL runs during first-time setup doesn't count.
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "--silent"]
      interval: 3s
      timeout: 5s
      retries: 40
    ports:
      - "127.0.0.1:${MYSQL_PORT:-3306}:3306"

  azurite:
    image: mcr.microsoft.com/azure-storage/azurite:3.37.0
    # azure-storage-blob 12.31 sends an API version Azurite 3.37 doesn't know yet (P-054).
    command: ["azurite-blob", "--blobHost", "0.0.0.0", "--location", "/data", "--skipApiVersionCheck"]
    volumes:
      - azurite-data:/data
    ports:
      - "127.0.0.1:10000:10000"

volumes:
  mysql-data:
  azurite-data:
```

`mysql/init/01-test-db.sh` (LF line endings; `.gitattributes` already forces them):

```bash
#!/bin/bash
# Creates the database the backend integration tests use (P-047). Calls the mysql client
# directly so it works whether the entrypoint runs this file (Windows mounts look
# executable) or sources it (Linux checkouts).
mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS mdit_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON mdit_test.* TO '$MYSQL_USER'@'%';
SQL
```

- [ ] **Step 2: Start the services and check the init script**

Run: `docker compose up -d --wait mysql azurite && docker compose exec mysql sh -c 'mysql -umdit -pmdit-dev-password -N -e "SHOW DATABASES; SELECT @@character_set_server, @@collation_server"'`
Expected: both containers healthy/running; output lists `mdit` and `mdit_test`, then `utf8mb4	utf8mb4_0900_ai_ci`. (The init script runs only on a fresh volume; if `mdit_test` is missing from an old volume, `docker compose down -v` and retry.)

- [ ] **Step 3: Write the test support module** — `backend/tests/support.py`

```python
"""Helpers shared by tests: settings for the test services and their availability (P-047)."""

import os
import uuid
from typing import Any, NoReturn

import pytest
from pydantic import SecretStr

from app.config import Settings

# Azurite's published development key, not a secret.
AZURITE_ACCOUNT_KEY = (
    "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
)
START_HINT = "Start them with: docker compose up -d --wait mysql azurite"


def azurite_connection_string(host: str = "127.0.0.1", port: int = 10000) -> str:
    return (
        "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;"
        f"AccountKey={AZURITE_ACCOUNT_KEY};"
        f"BlobEndpoint=http://{host}:{port}/devstoreaccount1;"
    )


def make_test_settings() -> Settings:
    """MySQL database mdit_test and Azurite from docker-compose.yml, overridable by TEST_* vars."""
    env = os.environ.get
    return Settings(
        db_host=env("TEST_DB_HOST", "127.0.0.1"),
        db_port=int(env("TEST_DB_PORT", "3306")),
        db_name=env("TEST_DB_NAME", "mdit_test"),
        db_user=env("TEST_DB_USER", "mdit"),
        db_password=SecretStr(env("TEST_DB_PASSWORD", "mdit-dev-password")),
        blob_connection_string=SecretStr(
            env("TEST_BLOB_CONNECTION_STRING", azurite_connection_string())
        ),
        blob_container=f"test-{uuid.uuid4().hex[:12]}",
    )


def fake_settings(**overrides: Any) -> Settings:
    """Settings for unit tests: everything points at port 1, where nothing listens."""
    values: dict[str, Any] = {
        "db_host": "127.0.0.1",
        "db_port": 1,
        "db_password": SecretStr("unused"),
        "blob_connection_string": SecretStr(azurite_connection_string(port=1)),
    }
    values.update(overrides)
    return Settings(**values)


def services_unavailable(reason: str) -> NoReturn:
    """Skip locally; fail when MDIT_REQUIRE_SERVICES=1 (CI) so CI can't pass by skipping."""
    message = f"{reason}. {START_HINT}"
    if os.environ.get("MDIT_REQUIRE_SERVICES") == "1":
        pytest.fail(message, pytrace=False)
    pytest.skip(message)
```

- [ ] **Step 4: Write the failing tests**

`backend/tests/test_support.py`:

```python
"""Integration tests skip locally but fail in CI when services are down (P-047)."""

import pytest

from tests.support import START_HINT, services_unavailable


def test_services_unavailable_skips_or_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MDIT_REQUIRE_SERVICES", raising=False)
    with pytest.raises(pytest.skip.Exception, match=START_HINT):
        services_unavailable("MySQL is not reachable")

    monkeypatch.setenv("MDIT_REQUIRE_SERVICES", "1")
    with pytest.raises(pytest.fail.Exception, match="MySQL is not reachable"):
        services_unavailable("MySQL is not reachable")
```

`backend/tests/conftest.py`:

```python
"""Fixtures for integration tests against MySQL and Azurite (P-047)."""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.db.session import create_db_engine
from tests.support import make_test_settings, services_unavailable


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    return make_test_settings()


@pytest.fixture(scope="session")
def engine(test_settings: Settings) -> Iterator[Engine]:
    engine = create_db_engine(test_settings)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError:
        engine.dispose()
        services_unavailable(
            f"MySQL is not reachable at {test_settings.db_host}:{test_settings.db_port}"
        )
    yield engine
    engine.dispose()
```

`backend/tests/test_db_session.py`:

```python
"""Engine and per-request sessions."""

from types import SimpleNamespace

import pytest
from sqlalchemy import Engine, text

from app.db.session import create_db_engine, get_session
from tests.support import fake_settings


def test_engine_uses_pymysql_without_connecting() -> None:
    engine = create_db_engine(fake_settings())
    assert engine.url.drivername == "mysql+pymysql"
    assert engine.url.port == 1
    engine.dispose()


@pytest.mark.integration
def test_connections_use_utc_and_utf8mb4(engine: Engine) -> None:
    with engine.connect() as connection:
        zone, charset = connection.execute(
            text("SELECT @@session.time_zone, @@character_set_connection")
        ).one()
    assert zone == "+00:00"
    assert charset == "utf8mb4"


@pytest.mark.integration
def test_get_session_yields_a_working_session(engine: Engine) -> None:
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(engine=engine)))
    sessions = get_session(request)  # type: ignore[arg-type]
    session = next(sessions)
    assert session.execute(text("SELECT 1")).scalar_one() == 1
    sessions.close()
```

- [ ] **Step 5: Run to verify they fail**

Run: `cd backend && python -m uv run pytest -q`
Expected: collection error `No module named 'app.db'`.

- [ ] **Step 6: Implement** — `backend/app/db/__init__.py` (empty) and `backend/app/db/session.py`

```python
"""Database engine and per-request sessions."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.config import Settings, database_url


def create_db_engine(settings: Settings) -> Engine:
    """Lazy: nothing connects until first use. Stored times are UTC (P-049)."""
    return create_engine(
        database_url(settings),
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"connect_timeout": 2, "init_command": "SET time_zone = '+00:00'"},
    )


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, closed afterwards."""
    with Session(request.app.state.engine) as session:
        yield session
```

- [ ] **Step 7: Run the checks with and without services**

Run: `cd backend && python -m uv run pytest -q`
Expected (services up): `10 passed`.
Run: `docker compose stop mysql && cd backend && python -m uv run pytest -q; cd .. && docker compose up -d --wait mysql`
Expected: integration tests `skipped` with "MySQL is not reachable at 127.0.0.1:3306. Start them with: docker compose up -d --wait mysql azurite", others pass.
Then ruff check, ruff format --check, mypy: clean.

- [ ] **Step 8: Log and commit**

```bash
git add docker-compose.yml mysql backend/app/db backend/tests context.md
git commit -m "feat(backend): MySQL and Azurite in Compose, database engine, integration fixtures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Schema models and the initial migration

**Files:**
- Create: `backend/app/db/base.py`, `backend/app/db/models.py`, `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`, `backend/alembic/versions/0001_initial_schema.py`, `backend/tests/test_migrations.py`, `backend/tests/test_schema.py`
- Modify: `backend/tests/support.py`, `backend/tests/conftest.py`

**Interfaces:**
- Consumes: `create_db_engine`, `Settings` (Tasks 1–2); fixtures `engine`, `test_settings`.
- Produces: `Base` (with `NAMING_CONVENTION`), `TABLE_ARGS`; models `User`, `Project`, `Document`, `Blob`, `Version` with the columns in spec §6; `new_public_id() -> str`; Alembic head revision `"0001"`; `tests.support.alembic_config(connection: Connection) -> Config`; fixture `migrated` (session-scoped `Engine`, `mdit_test` rebuilt down-to-base then up-to-head once per run).

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/support.py` (imports at the top, function at the end):

```python
from pathlib import Path

from alembic.config import Config
from sqlalchemy import Connection

BACKEND_DIR = Path(__file__).resolve().parents[1]


def alembic_config(connection: Connection) -> Config:
    """Alembic config that migrates over the given connection instead of Settings()."""
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["connection"] = connection
    return config
```

Add to `backend/tests/conftest.py`:

```python
from alembic import command

from tests.support import alembic_config


@pytest.fixture(scope="session")
def migrated(engine: Engine) -> Engine:
    """mdit_test rebuilt once per run: down to base, then up to head."""
    with engine.begin() as connection:
        config = alembic_config(connection)
        command.downgrade(config, "base")
        command.upgrade(config, "head")
    return engine
```

`backend/tests/test_migrations.py`:

```python
"""Migrations on real MySQL: down, up again, and models that match (P-044, P-051)."""

import pytest
from alembic import command
from sqlalchemy import Engine, inspect, text

from tests.support import alembic_config

pytestmark = pytest.mark.integration

APP_TABLES = {"blobs", "documents", "projects", "users", "versions"}


def table_names(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def test_downgrade_then_upgrade_again(migrated: Engine) -> None:
    with migrated.begin() as connection:
        command.downgrade(alembic_config(connection), "base")
    assert table_names(migrated) == {"alembic_version"}

    with migrated.begin() as connection:
        command.upgrade(alembic_config(connection), "head")
    assert table_names(migrated) == APP_TABLES | {"alembic_version"}


def test_models_match_the_migrations(migrated: Engine) -> None:
    with migrated.connect() as connection:
        command.check(alembic_config(connection))  # raises AutoGenerateDiffsDetected


def test_tables_are_innodb_and_utf8mb4(migrated: Engine) -> None:
    query = text(
        "SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA = DATABASE()"
    )
    with migrated.connect() as connection:
        rows = {name: (engine, collation) for name, engine, collation in connection.execute(query)}
    for table in APP_TABLES:
        assert rows[table] == ("InnoDB", "utf8mb4_0900_ai_ci")
```

`backend/tests/test_schema.py`:

```python
"""Schema rules from PRD 9.3, checked on real MySQL (P-049)."""

import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Engine, delete, func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.db.models import Blob, Document, Project, User, Version

pytestmark = pytest.mark.integration

HASH_A = "a" * 64
HASH_B = "b" * 64
UUID4 = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")

DUPLICATE_KEY = 1062
CHECK_FAILED = 3819
ROW_IS_REFERENCED = 1451
NO_REFERENCED_ROW = 1452


@pytest.fixture
def session(migrated: Engine) -> Iterator[Session]:
    """Everything the test writes is rolled back afterwards."""
    connection = migrated.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()


def mysql_error(info: pytest.ExceptionInfo[DBAPIError]) -> int:
    return int(info.value.orig.args[0])


def make_document(session: Session) -> Document:
    session.add(Blob(hash=HASH_A, size=5, content_type="text/markdown"))
    user = User(provider="github", provider_user_id="42", email="ada@example.com")
    session.add(user)
    session.flush()
    project = Project(user_id=user.id, name="Operating Systems Notes")
    session.add(project)
    session.flush()
    document = Document(project_id=project.id, path="Processes.md")
    session.add(document)
    session.flush()
    return document


def add_version(
    session: Session, document: Document, number: int, parent: Version | None = None
) -> Version:
    version = Version(
        document_id=document.id,
        number=number,
        content_hash=HASH_A,
        parent_version_id=parent.id if parent else None,
    )
    session.add(version)
    session.flush()
    return version


def test_public_ids_are_random_uuid4_strings(session: Session) -> None:
    first = User(provider="github", provider_user_id="1")
    second = User(provider="google", provider_user_id="1")
    session.add_all([first, second])
    session.flush()
    assert UUID4.fullmatch(first.public_id)
    assert UUID4.fullmatch(second.public_id)
    assert first.public_id != second.public_id


def test_created_at_is_set_by_mysql_in_utc(session: Session) -> None:
    user = User(provider="github", provider_user_id="7")
    session.add(user)
    session.flush()
    session.refresh(user)
    now = datetime.now(UTC).replace(tzinfo=None)
    # Wide enough for clock drift, far below any time-zone offset.
    assert abs(user.created_at - now) < timedelta(minutes=2)


def test_text_round_trips_as_utf8mb4(session: Session) -> None:
    name = "Notes 😀 中文 — ünïcode"
    user = User(provider="github", provider_user_id="8")
    session.add(user)
    session.flush()
    project = Project(user_id=user.id, name=name)
    session.add(project)
    session.flush()
    project_id = project.id
    session.expire_all()
    assert session.scalar(select(Project.name).where(Project.id == project_id)) == name


def test_a_provider_account_maps_to_one_user(session: Session) -> None:
    session.add(User(provider="github", provider_user_id="42"))
    session.flush()
    session.add(User(provider="github", provider_user_id="42"))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == DUPLICATE_KEY


def test_the_same_account_id_on_another_provider_is_another_user(session: Session) -> None:
    session.add_all(
        [User(provider="github", provider_user_id="42"), User(provider="google", provider_user_id="42")]
    )
    session.flush()


def test_public_ids_are_unique(session: Session) -> None:
    first = User(provider="github", provider_user_id="1")
    session.add(first)
    session.flush()
    session.add(User(provider="github", provider_user_id="2", public_id=first.public_id))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == DUPLICATE_KEY


def test_provider_must_be_github_or_google(session: Session) -> None:
    session.add(User(provider="gitlab", provider_user_id="1"))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == CHECK_FAILED


def test_version_numbers_are_unique_per_document(session: Session) -> None:
    document = make_document(session)
    add_version(session, document, 1)
    other = Document(project_id=document.project_id, path="Threads.md")
    session.add(other)
    session.flush()
    add_version(session, other, 1)  # another document may reuse the number
    with pytest.raises(DBAPIError) as info:
        add_version(session, document, 1)
    assert mysql_error(info) == DUPLICATE_KEY


def test_documents_may_share_a_path(session: Session) -> None:
    document = make_document(session)
    session.add(Document(project_id=document.project_id, path=document.path))
    session.flush()


def test_versions_must_point_at_a_stored_blob(session: Session) -> None:
    document = make_document(session)
    session.add(Version(document_id=document.id, number=1, content_hash=HASH_B))
    with pytest.raises(DBAPIError) as info:
        session.flush()
    assert mysql_error(info) == NO_REFERENCED_ROW


def test_a_blob_in_use_cannot_be_deleted(session: Session) -> None:
    add_version(session, make_document(session), 1)
    with pytest.raises(DBAPIError) as info:
        session.execute(delete(Blob).where(Blob.hash == HASH_A))
    assert mysql_error(info) == ROW_IS_REFERENCED


def test_deleting_a_version_clears_its_childs_parent(session: Session) -> None:
    document = make_document(session)
    first = add_version(session, document, 1)
    second = add_version(session, document, 2, parent=first)
    session.execute(delete(Version).where(Version.id == first.id))
    session.refresh(second)
    assert second.parent_version_id is None


def test_deleting_a_user_removes_their_projects_documents_and_versions(session: Session) -> None:
    document = make_document(session)
    add_version(session, document, 1)
    document_id, project_id = document.id, document.project_id
    user_id = session.scalar(select(Project.user_id).where(Project.id == project_id))

    session.execute(delete(User).where(User.id == user_id))

    def count(model: type, *where: object) -> int:
        return session.scalar(select(func.count()).select_from(model).where(*where)) or 0

    assert count(Project, Project.id == project_id) == 0
    assert count(Document, Document.id == document_id) == 0
    assert count(Version, Version.document_id == document_id) == 0
    assert count(Blob, Blob.hash == HASH_A) == 1  # blobs are shared; cleanup is separate
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && python -m uv run pytest -q`
Expected: collection error `No module named 'app.db.models'`.

- [ ] **Step 3: Implement the models**

`backend/app/db/base.py`:

```python
"""Declarative base shared by every model, with stable constraint names (P-049)."""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

TABLE_ARGS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_0900_ai_ci",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
```

`backend/app/db/models.py`:

```python
"""Server tables from PRD section 9.2 (P-044, P-049)."""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.mysql import CHAR, DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TABLE_ARGS, Base


def new_public_id() -> str:
    """Random, not sequential; lowercase, so MySQL's case-insensitive collation is safe."""
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id"),
        CheckConstraint("provider IN ('github', 'google')", name="provider"),
        TABLE_ARGS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(CHAR(36), unique=True, default=new_public_id)
    provider: Mapped[str] = mapped_column(String(16))
    provider_user_id: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6), server_default=text("CURRENT_TIMESTAMP(6)")
    )


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (TABLE_ARGS,)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(CHAR(36), unique=True, default=new_public_id)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6), server_default=text("CURRENT_TIMESTAMP(6)")
    )


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (TABLE_ARGS,)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(CHAR(36), unique=True, default=new_public_id)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.id", ondelete="CASCADE")
    )
    # Not unique: a rename on another device must not fail a save.
    path: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6), server_default=text("CURRENT_TIMESTAMP(6)")
    )


class Blob(Base):
    """Content-addressed bytes in Blob Storage; shared across users, so nothing cascades here."""

    __tablename__ = "blobs"
    __table_args__ = (TABLE_ARGS,)

    hash: Mapped[str] = mapped_column(CHAR(64), primary_key=True)
    size: Mapped[int] = mapped_column(BigInteger)
    content_type: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6), server_default=text("CURRENT_TIMESTAMP(6)")
    )


class Version(Base):
    __tablename__ = "versions"
    __table_args__ = (UniqueConstraint("document_id", "number"), TABLE_ARGS)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(CHAR(36), unique=True, default=new_public_id)
    document_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("documents.id", ondelete="CASCADE")
    )
    # SET NULL: deleting a version never fails or cascades down the history.
    parent_version_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("versions.id", ondelete="SET NULL")
    )
    number: Mapped[int] = mapped_column(Integer)
    content_hash: Mapped[str] = mapped_column(
        CHAR(64), ForeignKey("blobs.hash", ondelete="RESTRICT")
    )
    message: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME(fsp=6), server_default=text("CURRENT_TIMESTAMP(6)")
    )
```

- [ ] **Step 4: Alembic configuration**

`backend/alembic.ini`:

```ini
# The database URL comes from Settings (environment variables), never from this file (P-052).
[alembic]
script_location = %(here)s/alembic
prepend_sys_path = .
path_separator = os

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console
qualname =

[logger_sqlalchemy]
level = WARNING
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

`backend/alembic/env.py`:

```python
"""Alembic environment. Migrations run as their own step, never at app startup (P-051)."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

from app.config import Settings
from app.db import models  # noqa: F401  (registers the tables on Base.metadata)
from app.db.base import Base
from app.db.session import create_db_engine

config = context.config
target_metadata = Base.metadata


def run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:  # tests pass their own connection
        run_migrations(connection)
        return
    if config.config_file_name is not None:
        fileConfig(config.config_file_name, disable_existing_loggers=False)
    engine = create_db_engine(Settings())  # type: ignore[call-arg]  # values come from env vars
    with engine.connect() as connection:
        run_migrations(connection)
    engine.dispose()


if context.is_offline_mode():
    raise SystemExit("Offline (--sql) migrations are not supported.")
run_migrations_online()
```

`backend/alembic/script.py.mako`:

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: str | Sequence[str] | None = ${repr(down_revision)}
branch_labels: str | Sequence[str] | None = ${repr(branch_labels)}
depends_on: str | Sequence[str] | None = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 5: The initial migration** — `backend/alembic/versions/0001_initial_schema.py`

(This is the probed autogenerate output, tidied. Do not regenerate it; if you do, check it matches this file.)

```python
"""Initial schema: users, projects, documents, versions, blobs (PRD 9.2).

Revision ID: 0001
Revises:
Create Date: 2026-10-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE_OPTIONS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_0900_ai_ci",
}


def created_at() -> sa.Column[mysql.DATETIME]:
    return sa.Column(
        "created_at",
        mysql.DATETIME(fsp=6),
        server_default=sa.text("CURRENT_TIMESTAMP(6)"),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "blobs",
        sa.Column("hash", mysql.CHAR(length=64), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        created_at(),
        sa.PrimaryKeyConstraint("hash", name=op.f("pk_blobs")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        created_at(),
        sa.CheckConstraint("provider IN ('github', 'google')", name=op.f("ck_users_provider")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint(
            "provider", "provider_user_id", name=op.f("uq_users_provider_provider_user_id")
        ),
        sa.UniqueConstraint("public_id", name=op.f("uq_users_public_id")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        created_at(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_projects_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
        sa.UniqueConstraint("public_id", name=op.f("uq_projects_public_id")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("path", sa.String(length=1024), nullable=False),
        created_at(),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_documents_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
        sa.UniqueConstraint("public_id", name=op.f("uq_documents_public_id")),
        **TABLE_OPTIONS,
    )
    op.create_table(
        "versions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("document_id", sa.BigInteger(), nullable=False),
        sa.Column("parent_version_id", sa.BigInteger(), nullable=True),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("content_hash", mysql.CHAR(length=64), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=True),
        created_at(),
        sa.ForeignKeyConstraint(
            ["content_hash"],
            ["blobs.hash"],
            name=op.f("fk_versions_content_hash_blobs"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_versions_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_version_id"],
            ["versions.id"],
            name=op.f("fk_versions_parent_version_id_versions"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_versions")),
        sa.UniqueConstraint(
            "document_id", "number", name=op.f("uq_versions_document_id_number")
        ),
        sa.UniqueConstraint("public_id", name=op.f("uq_versions_public_id")),
        **TABLE_OPTIONS,
    )


def downgrade() -> None:
    op.drop_table("versions")
    op.drop_table("documents")
    op.drop_table("projects")
    op.drop_table("users")
    op.drop_table("blobs")
```

- [ ] **Step 6: Run the tests**

Run: `cd backend && python -m uv run pytest -q`
Expected (services up): `26 passed` (10 earlier + 3 migrations + 13 schema). If `test_models_match_the_migrations` fails, the error lists the difference; fix the model or migration so both describe spec §6.

- [ ] **Step 7: Run a migration the way Compose will**

Run: `cd backend && DB_HOST=127.0.0.1 DB_NAME=mdit DB_PASSWORD=mdit-dev-password BLOB_CONNECTION_STRING=x python -m uv run alembic upgrade head && DB_HOST=127.0.0.1 DB_NAME=mdit DB_PASSWORD=mdit-dev-password BLOB_CONNECTION_STRING=x python -m uv run alembic current`
Expected: `Running upgrade  -> 0001, Initial schema…` then `0001 (head)`. Then `docker compose exec mysql sh -c 'mysql -umdit -pmdit-dev-password mdit -N -e "SHOW TABLES"'` lists `alembic_version blobs documents projects users versions`.

- [ ] **Step 8: Checks, log, commit**

ruff check, ruff format --check, mypy app: clean.

```bash
git add backend context.md
git commit -m "feat(backend): PRD 9.2 schema models and the initial Alembic migration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Blob store

**Files:**
- Create: `backend/app/storage/__init__.py`, `backend/app/storage/blobs.py`, `backend/tests/test_blobs.py`
- Modify: `backend/tests/conftest.py`

**Interfaces:**
- Consumes: `test_settings` fixture, `azurite_connection_string`, `services_unavailable` (Task 2).
- Produces: `class BlobStore` with `from_connection_string(connection_string: str, container: str) -> BlobStore`, `ensure_container() -> bool` (never raises; fast), `exists(hash: str) -> bool`, `put(hash: str, data: bytes, content_type: str) -> None` (no-op when present), `get(hash: str) -> bytes | None`; invalid hash → `ValueError("Blob names must be 64 lowercase hex characters.")`. Fixture `blob_store` (session; per-run container, deleted afterwards).

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/conftest.py`:

```python
from azure.storage.blob import ContainerClient

from app.storage.blobs import BlobStore


@pytest.fixture(scope="session")
def blob_store(test_settings: Settings) -> Iterator[BlobStore]:
    connection_string = test_settings.blob_connection_string.get_secret_value()
    store = BlobStore.from_connection_string(connection_string, test_settings.blob_container)
    if not store.ensure_container():
        services_unavailable("Azurite is not reachable at the test blob endpoint")
    yield store
    ContainerClient.from_connection_string(
        connection_string, test_settings.blob_container
    ).delete_container()
```

`backend/tests/test_blobs.py`:

```python
"""BlobStore: hash checks and failures need no services; the rest runs against Azurite."""

import contextlib
import time
import uuid

import pytest
from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import ContainerClient

from app.config import Settings
from app.storage.blobs import BlobStore
from tests.support import azurite_connection_string


def unreachable_store() -> BlobStore:
    return BlobStore.from_connection_string(azurite_connection_string(port=1), "unused")


@pytest.mark.parametrize("name", ["A" * 64, "a" * 63, "g" * 64, "../" + "a" * 61])
def test_rejects_names_that_are_not_sha256_hex(name: str) -> None:
    with pytest.raises(ValueError, match="64 lowercase hex"):
        unreachable_store().exists(name)


def test_unreachable_storage_is_reported_quickly() -> None:
    started = time.monotonic()
    assert unreachable_store().ensure_container() is False
    assert time.monotonic() - started < 5


@pytest.mark.integration
def test_ensure_container_is_idempotent(blob_store: BlobStore) -> None:
    assert blob_store.ensure_container() is True
    assert blob_store.ensure_container() is True


@pytest.mark.integration
def test_ensure_container_creates_a_missing_container(
    blob_store: BlobStore, test_settings: Settings
) -> None:
    connection_string = test_settings.blob_connection_string.get_secret_value()
    name = f"test-{uuid.uuid4().hex[:12]}"
    container = ContainerClient.from_connection_string(connection_string, name)
    try:
        assert BlobStore.from_connection_string(connection_string, name).ensure_container()
        assert container.exists()
    finally:
        with contextlib.suppress(ResourceNotFoundError):
            container.delete_container()


@pytest.mark.integration
def test_put_then_get(blob_store: BlobStore, test_settings: Settings) -> None:
    digest = "0123456789abcdef" * 4
    blob_store.put(digest, b"# Hello\n", "text/markdown")
    assert blob_store.exists(digest) is True
    assert blob_store.get(digest) == b"# Hello\n"
    container = ContainerClient.from_connection_string(
        test_settings.blob_connection_string.get_secret_value(), test_settings.blob_container
    )
    properties = container.get_blob_client(digest).get_blob_properties()
    assert properties.content_settings.content_type == "text/markdown"


@pytest.mark.integration
def test_missing_blob(blob_store: BlobStore) -> None:
    assert blob_store.exists("f" * 64) is False
    assert blob_store.get("f" * 64) is None


@pytest.mark.integration
def test_existing_blob_is_not_replaced(blob_store: BlobStore) -> None:
    digest = "1" * 64
    blob_store.put(digest, b"first", "text/plain")
    blob_store.put(digest, b"second", "text/plain")
    assert blob_store.get(digest) == b"first"
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && python -m uv run pytest tests/test_blobs.py -q`
Expected: collection error `No module named 'app.storage'`.

- [ ] **Step 3: Implement** — `backend/app/storage/__init__.py` (empty) and `backend/app/storage/blobs.py`

```python
"""Blob Storage wrapper: content-addressed blobs named by SHA-256 hex (PRD 6.5)."""

import contextlib
import logging
import re

from azure.core.exceptions import AzureError, ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import BlobClient, BlobServiceClient, ContainerClient, ContentSettings

log = logging.getLogger(__name__)

_HASH = re.compile(r"[0-9a-f]{64}")


class BlobStore:
    def __init__(self, container: ContainerClient) -> None:
        self._container = container

    @classmethod
    def from_connection_string(cls, connection_string: str, container: str) -> BlobStore:
        service = BlobServiceClient.from_connection_string(
            connection_string, retry_total=3, connection_timeout=5, read_timeout=30
        )
        return cls(service.get_container_client(container))

    def ensure_container(self) -> bool:
        """Create the container if missing. Never raises; False when storage is unreachable."""
        # Health checks must answer quickly; default retries take ~90 s on a dead host.
        try:
            if not self._container.exists(retry_total=0, connection_timeout=2, read_timeout=2):
                self._container.create_container(
                    retry_total=0, connection_timeout=2, read_timeout=2
                )
        except ResourceExistsError:
            pass
        except AzureError:
            log.warning("Blob storage is unavailable", exc_info=True)
            return False
        return True

    def exists(self, hash: str) -> bool:
        return self._blob(hash).exists()

    def put(self, hash: str, data: bytes, content_type: str) -> None:
        """Store bytes under their hash; an existing blob is kept (deduplication).

        Callers verify the hash first (the Phase 5 upload route recomputes SHA-256).
        """
        with contextlib.suppress(ResourceExistsError):
            self._blob(hash).upload_blob(
                data, overwrite=False, content_settings=ContentSettings(content_type=content_type)
            )

    def get(self, hash: str) -> bytes | None:
        try:
            return self._blob(hash).download_blob().readall()
        except ResourceNotFoundError:
            return None

    def _blob(self, hash: str) -> BlobClient:
        if not _HASH.fullmatch(hash):
            raise ValueError("Blob names must be 64 lowercase hex characters.")
        return self._container.get_blob_client(hash)
```

- [ ] **Step 4: Run the checks**

Run: `cd backend && python -m uv run ruff format . && python -m uv run pytest -q`
Expected (services up): `36 passed` (26 + 10 blob, the parametrized name test counting 4). With Azurite stopped (`docker compose stop azurite`), the Azurite tests skip with the start hint; restart with `docker compose up -d --wait azurite`.
ruff check, ruff format --check, mypy app: clean.

- [ ] **Step 5: Log and commit**

```bash
git add backend context.md
git commit -m "feat(backend): BlobStore over azure-storage-blob, tested against Azurite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Error shape

**Files:**
- Create: `backend/app/errors.py`, `backend/tests/test_errors.py`

**Interfaces:**
- Produces: `error_response(status: int, code: str, message: str, details: list[dict[str, str]] | None = None) -> JSONResponse`; `install_error_handlers(app: FastAPI) -> None`.

- [ ] **Step 1: Write the failing tests** — `backend/tests/test_errors.py`

```python
"""Every failure has one shape: {"error": {"code", "message"}} (P-052)."""

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.errors import install_error_handlers


class Item(BaseModel):
    name: str
    size: int


def make_client() -> TestClient:
    app = FastAPI()
    install_error_handlers(app)

    @app.post("/items")
    def create(item: Item) -> Item:
        return item

    @app.get("/teapot")
    def teapot() -> None:
        raise HTTPException(418, "Short and stout.")

    @app.get("/gone")
    def gone() -> None:
        raise HTTPException(410)

    @app.get("/limited")
    def limited() -> None:
        raise HTTPException(429, "Slow down.", headers={"Retry-After": "5"})

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("connection failed for mdit:hunter2@mysql")

    return TestClient(app, raise_server_exceptions=False)


def test_unknown_route() -> None:
    response = make_client().get("/nope")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_wrong_method_keeps_the_allow_header() -> None:
    response = make_client().get("/items")
    assert response.status_code == 405
    assert response.json() == {
        "error": {"code": "method_not_allowed", "message": "Method not allowed."}
    }
    assert response.headers["allow"] == "POST"


def test_http_exception_with_a_message() -> None:
    response = make_client().get("/teapot")
    assert response.status_code == 418
    assert response.json() == {"error": {"code": "http_418", "message": "Short and stout."}}


def test_http_exception_without_a_message_uses_the_status_phrase() -> None:
    response = make_client().get("/gone")
    assert response.json() == {"error": {"code": "http_410", "message": "Gone."}}


def test_http_exception_headers_are_kept() -> None:
    response = make_client().get("/limited")
    assert response.status_code == 429
    assert response.headers["retry-after"] == "5"


def test_validation_errors_list_each_field() -> None:
    response = make_client().post("/items", json={"size": "big"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "invalid_request"
    assert error["message"] == "The request is not valid."
    fields = {detail["field"] for detail in error["details"]}
    assert fields == {"body.name", "body.size"}
    assert all(detail["message"] for detail in error["details"])


def test_malformed_json_is_a_validation_error() -> None:
    response = make_client().post(
        "/items", content=b"{bad", headers={"content-type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_unhandled_errors_hide_details() -> None:
    response = make_client().get("/boom")
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "internal_error", "message": "Something went wrong."}
    }
    assert "hunter2" not in response.text
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && python -m uv run pytest tests/test_errors.py -q`
Expected: collection error `No module named 'app.errors'`.

- [ ] **Step 3: Implement** — `backend/app/errors.py`

```python
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
```

- [ ] **Step 4: Run the checks**

Run: `cd backend && python -m uv run ruff format . && python -m uv run pytest -q`
Expected: `44 passed` (services up). ruff check, ruff format --check, mypy app: clean.

- [ ] **Step 5: Log and commit**

```bash
git add backend context.md
git commit -m "feat(backend): one error shape for HTTP, validation and unhandled errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Health endpoints and the app factory

**Files:**
- Create: `backend/app/logging.py`, `backend/app/readiness.py`, `backend/app/routes/__init__.py`, `backend/app/routes/health.py`, `backend/app/main.py`, `backend/tests/test_health.py`, `backend/tests/test_readiness.py`, `backend/tests/test_app.py`

**Interfaces:**
- Consumes: `Settings`, `create_db_engine`, `BlobStore`, `install_error_handlers`; fixtures `migrated`, `blob_store`, `test_settings`; `alembic_config`, `fake_settings`.
- Produces: `configure_logging(level: str) -> None` (handler on the `app` logger, stdout); `ReadinessChecks(database, migrations, blob)` — frozen dataclass of `Callable[[], bool]`; `database_check(engine: Engine) -> Callable[[], bool]`; `migrations_check(engine: Engine, head: str | None) -> Callable[[], bool]`; `head_revision() -> str | None`; `build_readiness(engine: Engine, blobs: BlobStore) -> ReadinessChecks`; `create_app(settings: Settings | None = None, readiness: ReadinessChecks | None = None) -> FastAPI` with `app.state.engine`, `app.state.blobs`, `app.state.readiness`; routes `GET /api/health`, `GET /api/health/ready`; OpenAPI at `/api/openapi.json`, docs at `/api/docs`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_health.py`:

```python
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


@pytest.mark.parametrize("failing", ["database", "migrations", "blob"])
def test_not_ready_when_one_check_fails(failing: str) -> None:
    response = make_client(**{failing: False}).get("/api/health/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["checks"] == {
        name: "unavailable" if name == failing else "ok"
        for name in ("database", "migrations", "blob")
    }


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
```

`backend/tests/test_readiness.py`:

```python
"""Real readiness checks against services that are down, and logging setup."""

import logging
import time
from collections.abc import Iterator

import pytest

from app.db.session import create_db_engine
from app.logging import configure_logging
from app.readiness import database_check, migrations_check
from tests.support import fake_settings


def test_database_check_reports_an_unreachable_database(caplog: pytest.LogCaptureFixture) -> None:
    engine = create_db_engine(fake_settings())
    started = time.monotonic()
    assert database_check(engine)() is False
    assert time.monotonic() - started < 5
    assert "Database is unavailable" in caplog.text
    engine.dispose()


def test_migrations_check_reports_an_unreachable_database() -> None:
    engine = create_db_engine(fake_settings())
    assert migrations_check(engine, "0001")() is False
    engine.dispose()


@pytest.fixture
def app_logger() -> Iterator[logging.Logger]:
    logger = logging.getLogger("app")
    handlers, level = logger.handlers[:], logger.level
    yield logger
    logger.handlers[:] = handlers
    logger.setLevel(level)


def test_app_logs_go_to_stdout_at_the_configured_level(
    app_logger: logging.Logger, capsys: pytest.CaptureFixture[str]
) -> None:
    configure_logging("WARNING")
    logging.getLogger("app.example").info("hidden line")
    logging.getLogger("app.example").warning("shown line")
    out = capsys.readouterr().out
    assert "shown line" in out
    assert "hidden line" not in out
```

`backend/tests/test_app.py`:

```python
"""The whole app against real MySQL and Azurite."""

import contextlib
import uuid

import pytest
from alembic import command
from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import ContainerClient
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.config import Settings
from app.main import create_app
from app.storage.blobs import BlobStore
from tests.support import alembic_config

pytestmark = pytest.mark.integration


def test_ready_against_real_services(
    migrated: Engine, blob_store: BlobStore, test_settings: Settings
) -> None:
    with TestClient(create_app(test_settings)) as client:
        response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "migrations": "ok", "blob": "ok"},
    }


def test_not_ready_until_migrated(
    migrated: Engine, blob_store: BlobStore, test_settings: Settings
) -> None:
    with migrated.begin() as connection:
        command.downgrade(alembic_config(connection), "base")
    try:
        with TestClient(create_app(test_settings)) as client:
            response = client.get("/api/health/ready")
    finally:
        with migrated.begin() as connection:
            command.upgrade(alembic_config(connection), "head")
    assert response.status_code == 503
    assert response.json()["checks"] == {
        "database": "ok",
        "migrations": "unavailable",
        "blob": "ok",
    }


def test_startup_creates_the_blob_container(
    blob_store: BlobStore, test_settings: Settings
) -> None:
    settings = test_settings.model_copy(update={"blob_container": f"test-{uuid.uuid4().hex[:12]}"})
    container = ContainerClient.from_connection_string(
        settings.blob_connection_string.get_secret_value(), settings.blob_container
    )
    try:
        with TestClient(create_app(settings)):
            assert container.exists()
    finally:
        with contextlib.suppress(ResourceNotFoundError):
            container.delete_container()
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && python -m uv run pytest -q`
Expected: collection errors `No module named 'app.main'` / `'app.readiness'` / `'app.logging'`.

- [ ] **Step 3: Implement logging and readiness**

`backend/app/logging.py`:

```python
"""Application logs go to stdout (PRD 12: never bodies, headers, cookies or secrets)."""

import logging
import sys

FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def configure_logging(level: str) -> None:
    """Configure the `app` logger tree; Uvicorn keeps its own access and error logs."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(FORMAT))
    logger = logging.getLogger("app")
    logger.handlers[:] = [handler]
    logger.setLevel(level)
```

`backend/app/readiness.py`:

```python
"""Readiness checks (P-050): each answers within a few seconds, never raises, and logs why."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.storage.blobs import BlobStore

log = logging.getLogger(__name__)

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


@dataclass(frozen=True)
class ReadinessChecks:
    database: Callable[[], bool]
    migrations: Callable[[], bool]
    blob: Callable[[], bool]


def head_revision() -> str | None:
    return ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()


def database_check(engine: Engine) -> Callable[[], bool]:
    def check() -> bool:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            log.warning("Database is unavailable", exc_info=True)
            return False
        return True

    return check


def migrations_check(engine: Engine, head: str | None) -> Callable[[], bool]:
    def check() -> bool:
        try:
            with engine.connect() as connection:
                current = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one_or_none()
        except SQLAlchemyError:
            log.warning("Migration state is unavailable", exc_info=True)
            return False
        if current != head:
            log.warning("Database is at revision %s; expected %s", current, head)
            return False
        return True

    return check


def build_readiness(engine: Engine, blobs: BlobStore) -> ReadinessChecks:
    return ReadinessChecks(
        database=database_check(engine),
        migrations=migrations_check(engine, head_revision()),
        # Creates the container when missing, so a backend that started before Azurite recovers.
        blob=blobs.ensure_container,
    )
```

- [ ] **Step 4: Implement the routes and the factory**

`backend/app/routes/__init__.py`: empty.

`backend/app/routes/health.py`:

```python
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
```

`backend/app/main.py`:

```python
"""md.IT API. Uvicorn builds it with `--factory app.main:create_app`, so importing this
module never reads the environment."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool

from app.config import Settings
from app.db.session import create_db_engine
from app.errors import install_error_handlers
from app.logging import configure_logging
from app.readiness import ReadinessChecks, build_readiness
from app.routes import health
from app.storage.blobs import BlobStore


def create_app(
    settings: Settings | None = None, readiness: ReadinessChecks | None = None
) -> FastAPI:
    settings = settings or Settings()  # type: ignore[call-arg]  # values come from env vars
    configure_logging(settings.log_level)
    engine = create_db_engine(settings)
    blobs = BlobStore.from_connection_string(
        settings.blob_connection_string.get_secret_value(), settings.blob_container
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Never raises; if Azurite isn't up yet, readiness creates the container later.
        await run_in_threadpool(blobs.ensure_container)
        yield
        engine.dispose()

    app = FastAPI(
        title="md.IT API",
        version="0.1.0",
        lifespan=lifespan,
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
    )
    app.state.engine = engine
    app.state.blobs = blobs
    app.state.readiness = readiness or build_readiness(engine, blobs)
    install_error_handlers(app)
    app.include_router(health.router)
    return app
```

- [ ] **Step 5: Run the checks**

Run: `cd backend && python -m uv run ruff format . && python -m uv run pytest -q`
Expected (services up): `57 passed` (44 + 7 health, the parametrized readiness test counting 3, + 3 readiness/logging + 3 app). ruff check, ruff format --check, mypy app: clean.

- [ ] **Step 6: Run the server locally**

Run (background): `cd backend && DB_HOST=127.0.0.1 DB_NAME=mdit DB_PASSWORD=mdit-dev-password "BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;" python -m uv run uvicorn app.main:create_app --factory --port 8000`
Then: `curl -sS localhost:8000/api/health` → `{"status":"ok"}`; `curl -sS localhost:8000/api/health/ready` → 200 with every check `ok` (the `mdit` database was migrated in Task 3 Step 7). Stop the server.

- [ ] **Step 7: Log and commit**

```bash
git add backend context.md
git commit -m "feat(backend): app factory, liveness and readiness endpoints, logging

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Backend image, the full Compose stack, gateway and Vite proxy

**Files:**
- Create: `backend/Dockerfile`, `backend/.dockerignore`, `gateway/default.conf`, `.env.example`
- Modify: `docker-compose.yml`, `frontend/vite.config.ts`

**Interfaces:**
- Consumes: the backend from Tasks 1–6; `frontend/Dockerfile` (unchanged).
- Produces: `docker compose up -d --build --wait` → services `mysql`, `azurite`, `migrate` (exits 0), `backend` (healthy), `frontend`, `gateway` on `:8080`; images `mdit-backend:local`, `mdit-frontend:local`.

- [ ] **Step 1: Backend image**

`backend/.dockerignore`:

```text
.venv
.pytest_cache
.mypy_cache
.ruff_cache
**/__pycache__
**/*.pyc
tests
```

`backend/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.14-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

FROM python:3.14-slim
RUN useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=build /app/.venv /app/.venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER app
EXPOSE 8000
# One process per container; Uvicorn shuts down gracefully on SIGTERM. The same image runs
# `alembic upgrade head` as the migrate step (P-051).
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
```

Run: `docker build -t mdit-backend:check backend`
Expected: builds; `docker run --rm mdit-backend:check whoami` prints `app`.

- [ ] **Step 2: Gateway** — `gateway/default.conf`

```nginx
# Stands in for the Kubernetes Ingress (P-045): /api/ goes to the backend, the rest to the
# frontend container, whose own nginx adds the CSP and caching headers.
server {
  listen 80;
  server_name _;
  server_tokens off;
  client_max_body_size 6m;

  location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $http_host;
  }

  location / {
    proxy_pass http://frontend:80;
    proxy_set_header Host $http_host;
  }
}
```

- [ ] **Step 3: Complete the Compose file**

In `docker-compose.yml`, add these services after `azurite` (keep `mysql`, `azurite` and `volumes` as they are):

```yaml
  migrate:
    build: ./backend
    image: mdit-backend:local
    command: ["alembic", "upgrade", "head"]
    environment: &backend-env
      DB_HOST: mysql
      DB_PORT: "3306"
      DB_NAME: ${DB_NAME:-mdit}
      DB_USER: ${DB_USER:-mdit}
      DB_PASSWORD: ${DB_PASSWORD:-mdit-dev-password}
      BLOB_CONNECTION_STRING: ${BLOB_CONNECTION_STRING:-DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;}
      BLOB_CONTAINER: ${BLOB_CONTAINER:-mdit-blobs}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    depends_on:
      mysql:
        condition: service_healthy
    restart: "no"

  backend:
    build: ./backend
    image: mdit-backend:local
    environment: *backend-env
    depends_on:
      migrate:
        condition: service_completed_successfully
      azurite:
        condition: service_started
    healthcheck:
      # The slim image has no curl.
      test: ["CMD", "python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).status == 200 else 1)"]
      interval: 5s
      timeout: 3s
      retries: 12
    ports:
      - "127.0.0.1:8000:8000"

  frontend:
    build: ./frontend
    image: mdit-frontend:local

  gateway:
    image: nginx:1.28-alpine
    volumes:
      - ./gateway/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      backend:
        condition: service_healthy
      frontend:
        condition: service_started
    ports:
      - "${GATEWAY_PORT:-8080}:80"
```

`.env.example`:

```text
# Copy to .env to override the development defaults in docker-compose.yml.
# MySQL only reads DB_* when its volume is first created; after changing them run
# `docker compose down -v` (this deletes local server data).
DB_NAME=mdit
DB_USER=mdit
DB_PASSWORD=mdit-dev-password
BLOB_CONTAINER=mdit-blobs
LOG_LEVEL=INFO
# Defaults to Azurite's development account at http://azurite:10000.
# BLOB_CONNECTION_STRING=
MYSQL_PORT=3306
GATEWAY_PORT=8080
```

Run: `docker compose config --quiet && echo valid`
Expected: `valid`.

- [ ] **Step 4: Vite dev proxy** — in `frontend/vite.config.ts`, add a `server` block after `plugins: [...],`:

```ts
  // `npm run dev` against `docker compose up`: /api goes to the backend (P-045).
  // 127.0.0.1, not localhost: Node may resolve localhost to ::1, and Compose publishes IPv4.
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
```

Run: `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`
Expected: all green; 417 tests pass.

- [ ] **Step 5: Bring the whole stack up and check acceptance 1–4**

Run: `docker compose down && docker compose up -d --build --wait`
Expected: exit 0. Then:

```bash
docker compose ps -a --format '{{.Service}} {{.State}} {{.ExitCode}}'
curl -sS -D - -o /dev/null http://localhost:8080/ | grep -i content-security-policy
curl -sS http://localhost:8080/ | grep -c 'id="root"'
curl -sS http://localhost:8080/p/x/d/y | grep -c 'id="root"'
curl -sS http://localhost:8080/api/health
curl -sS http://localhost:8080/api/health/ready
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/docs
docker compose exec mysql sh -c 'mysql -umdit -pmdit-dev-password mdit -N -e "SHOW TABLES"'
```

Expected: `migrate exited 0`, the others `running`; a CSP header; `1`, `1`; `{"status":"ok"}`; `{"status":"ok","checks":{"database":"ok","migrations":"ok","blob":"ok"}}`; `200`; tables `alembic_version blobs documents projects users versions`.

Acceptance 3:

```bash
docker compose stop mysql
curl -sS -w ' %{http_code}\n' http://localhost:8080/api/health/ready
curl -sS -w ' %{http_code}\n' http://localhost:8080/api/health
docker compose start mysql && docker compose up -d --wait mysql
curl -sS -w ' %{http_code}\n' http://localhost:8080/api/health/ready
```

Expected: readiness `503` with `"database":"unavailable"` and `"migrations":"unavailable"` within a few seconds; liveness `200`; after restart readiness `200`.

- [ ] **Step 6: Vite proxy (acceptance 6)**

Run (background): `cd frontend && npx vite --port 5173 --strictPort`; then `curl -sS http://127.0.0.1:5173/api/health` → `{"status":"ok"}`. Stop Vite.

- [ ] **Step 7: Log and commit**

```bash
git add backend/Dockerfile backend/.dockerignore gateway .env.example docker-compose.yml frontend/vite.config.ts context.md
git commit -m "feat: backend image, full Compose stack with migrate step and gateway, Vite /api proxy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Compose services (Tasks 2, 7), backend commands (Task 1), `MDIT_REQUIRE_SERVICES` (Task 2).
- Produces: jobs `changes`, `frontend`, `backend`, `compose`.

- [ ] **Step 1: Replace the workflow** — `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    paths:
      - 'frontend/**'
      - 'backend/**'
      - 'gateway/**'
      - 'mysql/**'
      - 'docker-compose.yml'
      - '.github/workflows/ci.yml'

permissions:
  contents: read
  pull-requests: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
    steps:
      - uses: dorny/paths-filter@v4
        id: filter
        with:
          filters: |
            frontend:
              - 'frontend/**'
              - '.github/workflows/ci.yml'
            backend:
              - 'backend/**'
              - 'mysql/**'
              - 'docker-compose.yml'
              - '.github/workflows/ci.yml'

  frontend:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Build image (no push)
        run: docker build -t mdit-frontend:ci .

  backend:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v5
      # The repo's own Compose services: CI gets the mdit_test init script and Azurite's
      # --skipApiVersionCheck, which GitHub service containers can't pass (P-054).
      - name: Start MySQL and Azurite
        working-directory: .
        run: docker compose up -d --wait mysql azurite
      - uses: astral-sh/setup-uv@v10.2.0
        with:
          working-directory: backend
          enable-cache: true
          cache-dependency-glob: backend/uv.lock
      - run: uv sync --locked
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run mypy app
      - name: Tests (services required)
        run: uv run pytest
        env:
          MDIT_REQUIRE_SERVICES: '1'
      - name: Build image (no push)
        run: docker build -t mdit-backend:ci .
      - name: Service logs
        if: failure()
        working-directory: .
        run: docker compose logs mysql azurite

  compose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Start the whole stack
        run: docker compose up -d --build --wait --wait-timeout 300
      - name: Check through the gateway
        run: |
          curl -fsS http://localhost:8080/ | grep -q '<div id="root">'
          curl -fsS http://localhost:8080/api/health
          curl -fsS http://localhost:8080/api/health/ready
      - name: Logs
        if: failure()
        run: docker compose logs
      - name: Stop
        if: always()
        run: docker compose down -v
```

- [ ] **Step 2: Lint the workflow**

Run: `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/repo" -w /repo rhysd/actionlint:1.7.12 -color` (`MSYS_NO_PATHCONV` stops Git Bash rewriting `/repo` into a Windows path)
Expected: no output, exit 0.

- [ ] **Step 3: Rehearse the jobs locally**

Backend job: `docker compose up -d --wait mysql azurite && cd backend && python -m uv sync --locked && python -m uv run ruff check . && python -m uv run ruff format --check . && python -m uv run mypy app && MDIT_REQUIRE_SERVICES=1 python -m uv run pytest -q && docker build -t mdit-backend:ci .`
Expected: all pass, `0 skipped`.

Compose job: `docker compose down -v && docker compose up -d --build --wait --wait-timeout 300 && curl -fsS http://localhost:8080/ | grep -q '<div id="root">' && curl -fsS http://localhost:8080/api/health && curl -fsS http://localhost:8080/api/health/ready && docker compose down -v`
Expected: both JSON bodies printed, exit 0. (`down -v` deletes local MySQL/Azurite data; that's expected here.)

- [ ] **Step 4: Log and commit**

```bash
git add .github/workflows/ci.yml context.md
git commit -m "ci: path-filtered frontend and backend jobs, backend on MySQL and Azurite, Compose stack check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: README, verification and docs

**Files:**
- Modify: `README.md`, `context.md`, `decisions.md` (only if verification produced a decision)

- [ ] **Step 1: README** — replace the `## Run it` section's requirements line and add two sections after the container block; add a Phase 4 status paragraph.

Requirements line:

```markdown
Requirements: Node 22+, npm, Docker with Compose v2, and [uv](https://docs.astral.sh/uv/) for backend work (`pip install uv`, or the installer from the uv docs).
```

After the container block:

````markdown
Everything (MySQL, Azurite, migrations, backend, frontend and a gateway that routes `/api` the way the Kubernetes Ingress will):

```bash
docker compose up --build   # http://localhost:8080, API at http://localhost:8080/api/docs
docker compose down         # add -v to delete local server data
```

Defaults are for local development only; copy `.env.example` to `.env` to change them.

Backend (from `backend/`; integration tests need `docker compose up -d --wait mysql azurite` and skip without it):

```bash
uv sync
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy app
uv run alembic upgrade head   # needs DB_HOST, DB_PASSWORD, BLOB_CONNECTION_STRING in the environment
```

`npm run dev` proxies `/api` to the backend on `127.0.0.1:8000`, so it works alongside `docker compose up`.
````

Status paragraph (after Phase 3's):

```markdown
Phase 4 (backend foundation) complete: FastAPI service with liveness (`/api/health`) and readiness (`/api/health/ready`) checks, MySQL 8.4 schema for users, projects, documents, versions and blobs under Alembic, a Blob Storage wrapper tested against Azurite, Docker Compose for the whole stack, and CI for both halves. Sign-in and versions come in Phase 5.
```

- [ ] **Step 2: Full verification from clean**

Run in order and record results:

1. `cd backend && rm -rf .venv && python -m uv sync --locked && python -m uv run ruff check . && python -m uv run ruff format --check . && python -m uv run mypy app`
2. `docker compose down -v && docker compose up -d --build --wait` (acceptance 1), then the Task 7 Step 5 checks (acceptance 2–4) and the stop/start readiness check (acceptance 3).
3. `cd backend && MDIT_REQUIRE_SERVICES=1 python -m uv run pytest -q` (acceptance 5: all pass, 0 skipped); then `docker compose stop mysql azurite && python -m uv run pytest -q` shows integration tests skipped, not failed; `docker compose start mysql azurite`.
4. Vite proxy (acceptance 6): Task 7 Step 6.
5. `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build` (acceptance 7: 417 tests); `git diff main -- frontend/Dockerfile frontend/nginx` is empty.
6. `docker image ls mdit-backend:local --format '{{.Size}}'` (record it).

Acceptance 8 (CI green) is checked on the PR.

- [ ] **Step 3: Update context.md**

- **Log:** one line with every result above (counts, sizes, anything that failed and how it was fixed).
- **Current state:** Phase `4 (backend foundation) — built, final review next`; next step `whole-branch review, then push and PR`.
- **Phase checklist:** `4. Backend foundation | Built — review and PR pending`.

- [ ] **Step 4: Commit**

```bash
git add README.md context.md decisions.md
git commit -m "docs: Phase 4 run instructions and verification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
