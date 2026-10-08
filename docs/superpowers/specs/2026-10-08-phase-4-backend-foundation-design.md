# Phase 4 — Backend foundation: design

Status: approved 2026-10-08, amended after planning probes (P-054) · Branch: `phase-4-backend-foundation` · PRD: §4, §8, §9.2–9.3, §10.1, §10.4, §11, §12, §13

## 1. Goal

md.IT gets the server half that Phase 5 (login and versions) builds on, running locally with the same containers production will use:

- A FastAPI service in `backend/` with liveness and readiness health endpoints, one error shape, and environment-only configuration
- MySQL 8.4 with the full PRD §9.2 schema created by the first Alembic migration
- A tested Blob Storage wrapper running against Azurite
- `docker-compose.yml` that starts MySQL, Azurite, migrations, backend, frontend and a gateway that routes `/api` the way the Ingress will
- CI that lints, type-checks and tests the backend against real MySQL and Azurite, and brings the whole Compose stack up

**Done when:** (PRD §13) `docker compose up` runs every service, and through http://localhost:8080 the app loads, `/api/health` and `/api/health/ready` return 200; CI is green on the PR. Every item in §12 of this spec passes.

**Out of scope:** OAuth, sessions, CSRF and every route except health (Phase 5); the frontend `sync/`, `auth/` and `api/` modules and OpenAPI client generation (Phase 5); how a version lists its image hashes (Phase 5 migration); CORS (same origin); rate limiting (Ingress, Phase 6); Kubernetes manifests (Phase 6); the orphan-blob cleanup job; the deferred Phase 1–3 minors listed in `context.md`.

## 2. Decisions this spec depends on

Recorded in `decisions.md`:

- **P-044** One spec → plan → PR cycle for Phase 4; the first migration creates the whole §9.2 schema.
- **P-045** A Compose `gateway` (nginx) stands in for the Ingress; the frontend image is unchanged; Vite dev server proxies `/api`.
- **P-046** Backend dependencies with uv and a committed `uv.lock`; ruff (lint + format), mypy strict, pytest.
- **P-047** Database and blob tests run against real MySQL 8.4 and Azurite; skipped locally when unreachable, required in CI.
- **P-048** Python 3.14 and SQLAlchemy 2.0.54 (not 2.1); pinned library and image versions.
- **P-049** Schema conventions: UUID4 `public_id` as `CHAR(36)`, `DATETIME(6)` UTC, parent version `SET NULL`, `content_hash` → `blobs` `RESTRICT`, `documents.path` not unique.
- **P-050** `/api/health` is liveness (no dependencies); `/api/health/ready` is readiness (database, migrations, blob).
- **P-051** Migrations run as their own step (Compose `migrate` service, later the Kubernetes Job), never at application startup.
- **P-052** Configuration names, one error shape, OpenAPI under `/api`.
- **P-053** CI: path-filtered `frontend` / `backend` jobs plus a `compose` job that runs the stack.

## 3. Repository layout (new and changed)

```
docker-compose.yml           all services (§4)
.env.example                 every overridable variable with its dev default
gateway/default.conf         nginx: /api/ → backend, / → frontend
mysql/init/01-test-db.sh     creates mdit_test and grants it to $MYSQL_USER
backend/
  app/
    main.py                  create_app() factory (uvicorn --factory): lifespan, routers, error handlers
    config.py                Settings (pydantic-settings)
    errors.py                error shape and exception handlers
    logging.py               stdlib logging setup
    readiness.py             ReadinessChecks and the real database, migration and blob checks
    routes/health.py         /api/health, /api/health/ready
    db/base.py               DeclarativeBase with naming convention
    db/models.py             User, Project, Document, Version, Blob
    db/session.py            engine factory, session dependency
    storage/blobs.py         BlobStore
  alembic/                   env.py, script.py.mako, versions/0001_initial_schema.py
  alembic.ini
  tests/                     conftest.py, unit and integration tests
  pyproject.toml  uv.lock  .python-version  Dockerfile  .dockerignore
frontend/vite.config.ts      dev-server proxy for /api
.github/workflows/ci.yml     changes, frontend, backend, compose jobs
README.md                    run everything; backend commands
```

`app/` modules follow PRD §8. Routes depend on `db/session.py` and `storage/blobs.py` through FastAPI dependencies so tests can replace them. Nothing in `db/` or `storage/` imports from `routes/`.

## 4. Docker Compose

`docker compose up` works with no `.env`: every variable has a development default in the Compose file (`${VAR:-default}`), and `.env.example` documents them. Default credentials are for local development only.

| Service | Image | Notes |
| --- | --- | --- |
| `mysql` | `mysql:8.4` | `--character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci`; database `mdit`, user `mdit`; named volume `mysql-data`; `mysql/init/` mounted at `/docker-entrypoint-initdb.d` (a shell script calls the `mysql` client directly to create `mdit_test` and grant it to `$MYSQL_USER`, so it works whether the entrypoint runs it (Windows mounts look executable) or sources it); healthcheck `mysqladmin ping`; `127.0.0.1:3306:3306` |
| `azurite` | `mcr.microsoft.com/azure-storage/azurite:3.37.0` | `azurite-blob --blobHost 0.0.0.0 --location /data --skipApiVersionCheck` (azure-storage-blob 12.31 sends API version 2026-10-06, which Azurite 3.37 rejects otherwise); named volume `azurite-data`; `127.0.0.1:10000:10000` |
| `migrate` | built from `backend/` | command `alembic upgrade head`; `depends_on: mysql (service_healthy)`; `restart: "no"` |
| `backend` | built from `backend/` | `depends_on: migrate (service_completed_successfully), azurite (service_started)`; healthcheck runs a Python one-liner against `http://127.0.0.1:8000/api/health` (the slim image has no curl); `127.0.0.1:8000:8000` |
| `frontend` | built from `frontend/` (unchanged) | no published port |
| `gateway` | `nginx:1.28-alpine` | mounts `gateway/default.conf`; `depends_on: backend (service_healthy), frontend (service_started)`; `8080:80` |

Only the gateway is published on all interfaces. MySQL, Azurite and the backend are published on `127.0.0.1` for local tests and the Vite dev proxy.

**Gateway** (`gateway/default.conf`):

- `location /api/` → `proxy_pass http://backend:8000;` with `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`
- `location /` → `proxy_pass http://frontend:80;` (the frontend's own nginx keeps its CSP and caching headers)
- `client_max_body_size 6m` (5 MB image limit from PRD §12 plus request overhead)
- `server_tokens off`

**Vite dev server:** `server.proxy` sends `/api` to `http://localhost:8000`, so `npm run dev` works against `docker compose up` too. No frontend application code calls the API in Phase 4 (PRD §4: only `sync` and `auth` do, from Phase 5).

## 5. Backend service

**Versions** (checked 2026-10-08; P-048): Python 3.14 (`.python-version`, `requires-python = ">=3.14,<3.15"`); FastAPI 0.142, Uvicorn 0.54 (`uvicorn[standard]`), Pydantic 2.13, pydantic-settings 2.15, SQLAlchemy 2.0.54, PyMySQL 1.2 with `cryptography` (MySQL 8.4's default `caching_sha2_password` needs it for the first login without TLS), Alembic 1.20, azure-storage-blob 12.31. Dev group: pytest 9.1, httpx2 2.13 (Starlette 1.7's TestClient deprecates `httpx` in favour of `httpx2`), ruff 0.16, mypy 2.4. Exact versions live in `uv.lock`.

**Configuration** (`config.py`, P-052): `Settings` reads environment variables only.

| Variable | Default (Compose) | Notes |
| --- | --- | --- |
| `DB_HOST` | `mysql` | ConfigMap in Kubernetes |
| `DB_PORT` | `3306` | |
| `DB_NAME` | `mdit` | |
| `DB_USER` | `mdit` | |
| `DB_PASSWORD` | `mdit-dev-password` | Secret in Kubernetes; `SecretStr`, never logged |
| `BLOB_CONNECTION_STRING` | Azurite's well-known development connection string, host `azurite` | Secret in Kubernetes; `SecretStr` |
| `BLOB_CONTAINER` | `mdit-blobs` | |
| `LOG_LEVEL` | `INFO` | |

`Settings` has no defaults for `DB_HOST`, `DB_PASSWORD` or `BLOB_CONNECTION_STRING`; the app fails to start with a clear message if they are missing. The database URL is built with `sqlalchemy.URL.create("mysql+pymysql", …, query={"charset": "utf8mb4"})`, so passwords with special characters need no escaping.

**Application** (`main.py`): `create_app(settings=None, readiness=None)` builds the app; Uvicorn runs it with `--factory`, so importing `app.main` never reads the environment and tests pass their own settings and fake readiness checks. It creates the engine (`pool_pre_ping=True`, `connect_timeout=2`, session time zone `+00:00`) and the `BlobStore`; the lifespan calls `ensure_container()` (never raises; if Azurite is not reachable yet, liveness stays up and readiness keeps retrying it) and disposes the engine on shutdown. OpenAPI is served at `/api/openapi.json` and the docs page at `/api/docs`; `redoc_url=None`. Uvicorn runs one process per container and handles SIGTERM gracefully.

**Logging** (`logging.py`): stdlib `logging` to stdout, `%(asctime)s %(levelname)s %(name)s %(message)s`, level from `LOG_LEVEL`. Uvicorn's access log stays on (method, path, status). Nothing logs request bodies, headers, cookies, connection strings or passwords (PRD §12).

**Dockerfile:** stage 1 copies `uv` from `ghcr.io/astral-sh/uv:0.12` into `python:3.14-slim`, runs `uv sync --locked --no-dev` (the backend is an application, `tool.uv.package = false`) on `pyproject.toml` + `uv.lock` (cached layer), then copies the source. Stage 2 is `python:3.14-slim` with the virtualenv and source copied in, a non-root `app` user, `PATH` pointing at the venv, `EXPOSE 8000`, and `CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]`. The same image runs `alembic upgrade head` for the `migrate` service.

## 6. Data model

The first revision `0001_initial_schema` creates the PRD §9.2 tables (P-044, P-049). The SQLAlchemy models (`Mapped[...]` declarative style) describe the same schema; a test checks they match.

Every table: `ENGINE=InnoDB`, `DEFAULT CHARSET=utf8mb4`, `COLLATE=utf8mb4_0900_ai_ci`. Every `public_id` is a lowercase UUID4 string, `CHAR(36)`, unique, generated by the application with `uuid.uuid4()`. Every `created_at` is `DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`, set by the server, in UTC (the MySQL session time zone is set to `+00:00` on connect).

| Table | Columns | Keys and constraints |
| --- | --- | --- |
| `users` | `id BIGINT AUTO_INCREMENT`, `public_id`, `provider VARCHAR(16)`, `provider_user_id VARCHAR(255)`, `email VARCHAR(320) NULL`, `created_at` | PK `id`; unique `public_id`; unique `(provider, provider_user_id)`; CHECK `provider IN ('github','google')` |
| `projects` | `id`, `public_id`, `user_id BIGINT`, `name VARCHAR(255)`, `created_at` | FK `user_id` → `users.id` ON DELETE CASCADE |
| `documents` | `id`, `public_id`, `project_id BIGINT`, `path VARCHAR(1024)`, `created_at` | FK `project_id` → `projects.id` ON DELETE CASCADE; `path` not unique (a rename on another device must not fail a save) |
| `versions` | `id`, `public_id`, `document_id BIGINT`, `parent_version_id BIGINT NULL`, `number INT`, `content_hash CHAR(64)`, `message VARCHAR(500) NULL`, `created_at` | FK `document_id` → `documents.id` ON DELETE CASCADE; unique `(document_id, number)`; FK `parent_version_id` → `versions.id` ON DELETE SET NULL; FK `content_hash` → `blobs.hash` ON DELETE RESTRICT |
| `blobs` | `hash CHAR(64)`, `size BIGINT`, `content_type VARCHAR(100)`, `created_at` | PK `hash` (lowercase hex SHA-256); shared and deduplicated across users, so no cascade reaches it |

Constraint and index names come from a `MetaData(naming_convention=…)` (`pk_%(table_name)s`, `fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s`, `uq_%(table_name)s_%(column_0_N_name)s`, `ix_%(column_0_label)s`, `ck_%(table_name)s_%(constraint_name)s`), so later migrations can drop or alter them by name.

What deleting a version means for its children is decided in Phase 5; `SET NULL` only guarantees a delete never fails or cascades down the history.

## 7. Migrations

- Alembic `env.py` builds the URL from `Settings` (never from `alembic.ini`) and uses `target_metadata = Base.metadata` with `compare_type=True`.
- `0001_initial_schema` is autogenerated, then edited by hand to state the charset/collation, server defaults and constraint names explicitly; `downgrade()` drops the tables in reverse order.
- Migrations run only as their own step (P-051): the Compose `migrate` service now, the Kubernetes Job in Phase 6. The backend never migrates at startup; readiness reports `migrations: unavailable` until the database is at head.

## 8. HTTP behaviour

**Health** (P-050), both public:

- `GET /api/health` → `200 {"status": "ok"}`. Touches nothing else, so a database outage never makes Kubernetes restart pods.
- `GET /api/health/ready` → `200` or `503` with `{"status": "ok" | "unavailable", "checks": {"database": "ok" | "unavailable", "migrations": "ok" | "unavailable", "blob": "ok" | "unavailable"}}`.
  - `database`: `SELECT 1`.
  - `migrations`: `SELECT version_num FROM alembic_version` equals the script directory's head revision (read once at startup).
  - `blob`: `BlobStore.ensure_container()` — the container exists, created if missing (so a backend that started before Azurite recovers on its own).
  - Each check has a 2-second budget (MySQL `connect_timeout`, Azure client timeouts). Failures are logged with their exception; the response never includes error text.

**Errors** (`errors.py`, P-052): every error response is `{"error": {"code": str, "message": str}}`, plus `details` for validation.

| Case | Status | `code` | `message` |
| --- | --- | --- | --- |
| `HTTPException` / Starlette HTTP errors (incl. unknown route) | its status | `not_found`, `method_not_allowed`, otherwise `http_<status>` | the exception's detail, or the standard phrase |
| Request validation | 422 | `invalid_request` | `The request is not valid.`; `details: [{"field": "body.name", "message": "…"}]` |
| Unhandled exception | 500 | `internal_error` | `Something went wrong.` (Starlette re-raises after the response, so Uvicorn logs the traceback) |

## 9. Blob storage

`storage/blobs.py` wraps `azure-storage-blob`'s `BlobServiceClient` (sync):

- `BlobStore.from_connection_string(conn, container)`
- `ensure_container() -> bool` — create the container if missing; idempotent; never raises: returns `False` (and logs a warning) when Blob Storage is unreachable. Its calls use `retry_total=0` and 2-second timeouts, because the SDK's default retries take about 90 seconds against a dead host; `put`/`get`/`exists` keep the client defaults (`retry_total=3`, `connection_timeout=5`, `read_timeout=30`).
- `exists(hash) -> bool`, `put(hash, data: bytes, content_type)`, `get(hash) -> bytes | None`
- Blob names are the hash; `hash` must match `^[0-9a-f]{64}$` or `ValueError` is raised. `put` with an existing hash does nothing (deduplication, PRD §6.5); it does not re-verify the bytes; the Phase 5 upload route verifies SHA-256 before calling it.

No blob routes in Phase 4; the wrapper is tested against Azurite so Phase 5 starts from a working connection.

## 10. Testing

pytest, with `pyproject.toml` config: `testpaths = ["tests"]`, marker `integration`.

- **Unit (no services):** settings parsing and required variables; URL building with a special-character password; error shapes for 404, 405, 422 and an unhandled exception (a test-only route); liveness; readiness with fake checks (all ok → 200; each one failing → 503 with only that check unavailable; no error text in the body); blob hash validation.
- **Integration (`@pytest.mark.integration`):** against MySQL database `mdit_test` and Azurite, configured by `TEST_DB_*` / `TEST_BLOB_CONNECTION_STRING` variables with localhost defaults matching Compose.
  - Migrations: `upgrade head` on an empty database, `downgrade base` leaves only the empty `alembic_version` table, `upgrade head` again; `alembic check` finds no difference from the models.
  - Schema: utf8mb4 round-trip (emoji, CJK); unique `(provider, provider_user_id)`, `public_id` and `(document_id, number)` reject duplicates; the provider CHECK rejects other values; deleting a user removes their projects, documents and versions and leaves blobs; deleting a parent version sets its child's `parent_version_id` to NULL; a version with an unknown `content_hash` is rejected; a referenced blob cannot be deleted.
  - Readiness against the real services: 200 at head; 503 with `migrations: unavailable` after `downgrade base`.
  - BlobStore: `ensure_container` twice returns `True`; against a port nothing listens on it returns `False` within 5 seconds (no services needed); put/exists/get round trip; `get` of a missing hash returns `None`; `put` of an existing hash keeps the first bytes; uses a per-run container name and deletes it afterwards.
- **Service availability:** a session fixture tries to connect once. Locally, if MySQL or Azurite is unreachable, integration tests are skipped with "Start them with: docker compose up -d mysql azurite". When `MDIT_REQUIRE_SERVICES=1` (set in CI), unreachable services fail the run instead (P-047).
- Integration tests reset `mdit_test` by migrating it down to base and up to head at the start of the session; schema tests run in transactions that are rolled back.

## 11. CI

`.github/workflows/ci.yml` (P-053) runs on pull requests touching `frontend/**`, `backend/**`, `gateway/**`, `mysql/**`, `docker-compose.yml` or the workflow file.

- **`changes`**: `dorny/paths-filter@v4` sets `frontend` and `backend` outputs.
- **`frontend`** (if `frontend` changed or the workflow changed): unchanged steps.
- **`backend`** (if `backend` changed or the workflow changed): `docker compose up -d --wait mysql azurite` (the repo's own Compose services, so CI gets the init script and Azurite's `--skipApiVersionCheck`; GitHub service containers cannot override a command); `astral-sh/setup-uv@v10.2.0` (setup-uv publishes no floating major tag) → `uv sync --locked` → `uv run ruff check .` → `uv run ruff format --check .` → `uv run mypy app` → `uv run pytest` with `MDIT_REQUIRE_SERVICES=1`; `docker build -t mdit-backend:ci backend`.
- **`compose`** (always): `docker compose up -d --build --wait`; then through `http://localhost:8080`: `/` returns HTML containing `<div id="root">`, `/api/health` and `/api/health/ready` return 200; `docker compose logs` on failure; `docker compose down -v` always.

## 12. Acceptance

1. `docker compose up` from a clean clone (no `.env`) starts mysql, azurite, migrate (exits 0), backend (healthy), frontend and gateway.
2. http://localhost:8080 serves the app with its CSP header; `/api/health` → 200 `{"status":"ok"}`; `/api/health/ready` → 200 with every check `ok`.
3. Stopping `mysql` makes `/api/health/ready` return 503 with `database: unavailable` while `/api/health` stays 200; starting it again returns readiness to 200.
4. The migrated `mdit` database has the five tables with the keys, cascades and utf8mb4 settings in §6.
5. `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest` passes with `docker compose up -d mysql azurite` running, and skips (not fails) integration tests without them.
6. `npm run dev` proxies `/api/health` to the backend.
7. Frontend lint, typecheck, tests and build still pass; `frontend/Dockerfile` and `frontend/nginx/` are unchanged.
8. CI is green on the PR: `frontend` (if run), `backend`, `compose`.
