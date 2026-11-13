# Phase 6 — Kubernetes locally Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The md.IT backend and frontend images run end to end on Docker Desktop's Kubernetes from hand-written Kustomize YAML, behind Envoy Gateway.

**Architecture:** `k8s/base` holds what every environment shares (Deployments, Services, migration Job, Gateway API routing); `k8s/overlays/local` adds in-cluster MySQL and Azurite plus local config and a git-ignored secret file. `scripts/k8s_local.sh` installs the add-on, builds, applies, re-runs the migration Job and smoke-tests.

**Tech Stack:** Kubernetes (Docker Desktop, kubeadm mode), Kustomize via `kubectl -k`, Gateway API + Envoy Gateway v1.9.3, existing images (`python:3.14-slim` backend, `nginx:1.28-alpine` frontend), `mysql:8.4`, `azurite:3.37.0`.

**Spec:** `docs/superpowers/specs/2026-11-13-phase-6-kubernetes-local-design.md`

## Global Constraints

- No `DEV_LOGIN` in any file under `k8s/` (P-058).
- No real secret committed; `k8s/overlays/local/secret.env` is git-ignored.
- No `latest` tag; local images are `mdit-backend:local` and `mdit-frontend:local` (the Compose names).
- Migrations run only in the Job; the Job receives DB settings only (P-051, P-070).
- `enableServiceLinks: false` on every pod spec.
- Namespace `mdit`; entry point `http://localhost` (port 80).
- Envoy Gateway pinned to `v1.9.3` in one place (`scripts/k8s_local.sh`); verify the release exists before use.
- Same images as Compose; no Dockerfile changes.

## Review Focus

- MySQL slow on first start (initialising its volume): the Job must retry until it succeeds, not fail the rollout. → Task 4 runs `up` on an empty volume.
- Re-running `up` after a code change: migrations must run again and pods must pick up the rebuilt image. → Task 4 step "second `up`".
- A dependency down (MySQL scaled to 0): backend pods go unready but are not restarted (P-050). → Task 4 step.
- An upload over 6 MB: refused at the edge with 413, not streamed to the backend. → Task 3 smoke check.
- Port 80 already taken on the host: `up` must say so plainly instead of hanging. → Task 4, `up` checks the Gateway gets an address within a timeout and prints the hint.

---

### Task 1: `DB_SSL` setting

**Files:**
- Modify: `backend/app/config.py` (`DatabaseSettings`)
- Modify: `backend/app/db/session.py`
- Test: `backend/tests/test_db_session.py`

**Interfaces:**
- Produces: `DatabaseSettings.db_ssl: bool = False` (env `DB_SSL`); `connect_args(settings: DatabaseSettings, io_timeout: int) -> dict[str, Any]` in `app/db/session.py`, used by `create_db_engine`.

- [ ] **Step 1: Failing tests** in `test_db_session.py`:
  - `test_connect_args_have_no_ssl_by_default`: `"ssl" not in connect_args(settings, 30)`; timeouts and `init_command` unchanged.
  - `test_db_ssl_verifies_server_certificate`: with `db_ssl=True`, `args["ssl"]` is an `ssl.SSLContext` with `verify_mode == ssl.CERT_REQUIRED` and `check_hostname is True`.
  - `test_db_ssl_reads_env`: `DB_SSL=true` in env → `DatabaseSettings().db_ssl is True`.
- [ ] **Step 2: Run, expect FAIL** (`connect_args` not defined).
- [ ] **Step 3: Implement.** `connect_args` returns today's dict plus `"ssl": ssl.create_default_context()` when `db_ssl`; `create_db_engine` uses it.
- [ ] **Step 4: Run the backend suite, ruff and mypy; expect all pass.**
- [ ] **Step 5: Commit** `feat(backend): DB_SSL turns on verified TLS to MySQL`.

### Task 2: Base and local manifests

**Files:**
- Create: `k8s/base/{kustomization.yaml,namespace.yaml,backend.yaml,frontend.yaml,migrate-job.yaml}`
- Create: `k8s/overlays/local/{kustomization.yaml,mysql.yaml,azurite.yaml}`, `k8s/overlays/local/secret.example.env`
- Modify: `.gitignore` (add `k8s/**/secret.env`)

**Interfaces:**
- Produces: ConfigMap `mdit-config` and Secret `mdit-secrets` (both generated, hash-suffixed); Services `backend:8000`, `frontend:80`, `mysql:3306`, `azurite:10000`; Job `mdit-migrate`; label `app.kubernetes.io/name: <backend|frontend|mysql|azurite|migrate>`.
- Secret keys: `DB_PASSWORD`, `BLOB_CONNECTION_STRING`, `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- ConfigMap keys (base): `DB_PORT=3306`, `DB_NAME=mdit`, `DB_USER=mdit`, `DB_SSL=false`, `BLOB_CONTAINER=mdit-blobs`, `LOG_LEVEL=INFO`, `SESSION_DAYS=30`, `COOKIE_SECURE=true`; local overlay merges `DB_HOST=mysql`, `PUBLIC_BASE_URL=http://localhost`.

- [ ] **Step 1: Check that fails:** `kubectl kustomize k8s/overlays/local` → error (no kustomization).
- [ ] **Step 2: Write the manifests.**
  - backend: 2 replicas, `envFrom` config + secret, liveness `/api/health`, readiness `/api/health/ready` (`timeoutSeconds: 6`, readiness takes ~4 s with a dependency stopped), requests 100m/192Mi, limit 384Mi, `runAsNonRoot`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` with an `emptyDir` on `/tmp`; rolling update `maxUnavailable: 0`.
  - frontend: 2 replicas, probe `/`, requests 20m/32Mi, limit 64Mi.
  - migrate Job: same backend image, `command: [alembic, upgrade, head]`, config from ConfigMap, `DB_PASSWORD` only via `secretKeyRef`, `backoffLimit: 8`.
  - mysql: StatefulSet, the Compose `command` flags, `MYSQL_RANDOM_ROOT_PASSWORD=yes`, user/password from config + secret, 2Gi PVC, `mysqladmin ping` readiness over TCP.
  - azurite: Deployment, Compose `command` (incl. `--skipApiVersionCheck`), 1Gi PVC.
  - local `secretGenerator` reads `secret.env`; `secret.example.env` has placeholders and the Azurite dev connection string pointing at `http://azurite:10000/devstoreaccount1`.
- [ ] **Step 3: Verify:** with `secret.env` copied from the example, `kubectl kustomize k8s/overlays/local` renders; `grep -c DEV_LOGIN` on the output is 0; no `:latest`; `git check-ignore k8s/overlays/local/secret.env` succeeds.
- [ ] **Step 4: Commit** `feat(k8s): base and local manifests`.

### Task 3: Gateway API routing with Envoy Gateway

**Files:**
- Create: `k8s/base/gateway.yaml`; Modify: `k8s/base/kustomization.yaml`

**Interfaces:**
- Consumes: Services `backend:8000`, `frontend:80` (Task 2).
- Produces: GatewayClass `eg` (controller `gateway.envoyproxy.io/gatewayclass-controller`), Gateway `mdit` (HTTP listener :80), HTTPRoutes `api`, `api-signin` (`/api/auth/login`, `/api/auth/callback`), `api-upload` (`PUT /api/blobs`), `web`.

- [ ] **Step 1:** Install Envoy Gateway v1.9.3 on the cluster (`kubectl apply --server-side -f https://github.com/envoyproxy/gateway/releases/download/v1.9.3/install.yaml`), wait for `deployment/envoy-gateway` available.
- [ ] **Step 2:** Confirm field names on the installed CRDs: `kubectl explain backendtrafficpolicy.spec.rateLimit` and the request-buffer / body-limit field. Use what exists; if a 6 MB body limit can't be set at the edge, record it in `decisions.md` and the deferred list.
- [ ] **Step 3: Write `gateway.yaml`:** routes `/api` → backend, `/` → frontend; `X-Forwarded-Proto` passes through (Envoy sets it); BackendTrafficPolicy on `api-limited`: local rate limit 20 requests/minute per client IP; 6 MB request buffer on `api`/`api-limited`; request timeout 60 s.
- [ ] **Step 4: Verify** after Task 4's `up`: `curl -sI http://localhost/` has the CSP header; `/api/health` 200; a 7 MB POST to `/api/blobs/...` → 413; 21 quick requests to `/api/auth/providers` (or an existing auth GET) → at least one 429.
- [ ] **Step 5: Commit** `feat(k8s): Gateway API routing with Envoy Gateway`.

### Task 4: `scripts/k8s_local.sh` and the end-to-end run

**Files:**
- Create: `scripts/k8s_local.sh`

**Interfaces:**
- `scripts/k8s_local.sh up` — checks context is `docker-desktop`; installs Envoy Gateway if missing; `docker compose build backend frontend`; creates `secret.env` from the example with a fresh `SESSION_SECRET` and DB password if missing; applies the overlay; deletes and re-creates Job `mdit-migrate`, waits for it; `kubectl rollout restart` + `rollout status` backend and frontend; waits up to 120 s for the Gateway to be Programmed, else prints the port-80 hint.
- `down` — deletes namespace `mdit` (data goes with the PVCs; says so).
- `smoke` — the Task 3 Step 4 checks plus `/api/health/ready` 200 and `/api/me` 401; exits 1 on the first failure.

- [ ] **Step 1:** `smoke` against a cluster without the app → FAIL.
- [ ] **Step 2:** Write the script (POSIX `sh`, `set -eu`).
- [ ] **Step 3:** `up` on an empty cluster → Job completes after retries, pods Ready; `smoke` passes.
- [ ] **Step 4:** Full flow: `kubectl -n mdit set env deployment/backend DEV_LOGIN=1`, `python scripts/api_smoke.py http://localhost` passes, then `kubectl -n mdit set env deployment/backend DEV_LOGIN-` and confirm `/api/auth/login/dev` is 404.
- [ ] **Step 5:** Second `up` after touching a backend file: Job runs again, pods restart on the new image.
- [ ] **Step 6:** `kubectl -n mdit scale statefulset/mysql --replicas=0`: backend pods become not Ready with restart count unchanged; scale back to 1, they recover.
- [ ] **Step 7: Commit** `feat(scripts): k8s_local.sh up, down and smoke`.

### Task 5: CI check and documentation

**Files:**
- Modify: `.github/workflows/ci.yml` (job `k8s`, path filter `k8s/**`)
- Create: `k8s/README.md`; Modify: `README.md`, `context.md`, `decisions.md`

- [ ] **Step 1:** CI job `k8s`: copy `secret.example.env` to `secret.env`, `kubectl kustomize k8s/overlays/local > out.yaml`, fail if `DEV_LOGIN` or `:latest` appears.
- [ ] **Step 2:** `k8s/README.md`: prerequisites (Docker Desktop → Settings → Kubernetes → kubeadm), `up`/`smoke`/`down`, sign-in with a GitHub OAuth app (`http://localhost/api/auth/callback/github`), what Phase 7 adds. README links to it.
- [ ] **Step 3:** `decisions.md` entries for every call in the spec; `context.md` state, checklist and log.
- [ ] **Step 4: Commit** `docs: Phase 6 Kubernetes locally`.
