# Phase 6 — Kubernetes locally: design

Date: 2026-11-13. The user opted out of the design questions ("do as you prefer"); every choice below is the implementer's call, recorded in `decisions.md`.

## Intent

Run the existing backend and frontend images on a local Kubernetes cluster from hand-written YAML, so Phase 7 (AKS on an Azure student subscription, $100 credit) is mostly a change of configuration. PRD §13: *done when the app works end to end in the local cluster.*

## Goals

- Manifests per PRD §10.2: namespace, non-secret config, secret example, backend and frontend Deployments and Services, migration Job, and routing (`/api` → backend, `/` → frontend).
- Probes per P-050: liveness `/api/health`, readiness `/api/health/ready`.
- Migrations only through the Job (P-051); the Job gets the DB settings and nothing else (P-070).
- Rate limiting on auth and upload endpoints at the edge (PRD §12); a 6 MB request body limit as in the Compose gateway.
- A `DB_SSL` setting, because Azure Database for MySQL requires TLS (needed in Phase 7, built now).
- One command to bring the local cluster up and one to check it.

## Non-goals

- Anything on Azure (Terraform, ACR, AKS, cert-manager, TLS, `deploy.yml`) — Phase 7.
- Helm, Key Vault, autoscaling — Phase 8.
- The orphan-blob cleanup job (§9.3) — still unowned; stays in the deferred list.

## Anti-goals

- `DEV_LOGIN` in any manifest (P-058).
- Real secrets in Git.
- The `latest` tag.

## Constraints

- No local installs beyond Docker Desktop (the user's setup). Docker Desktop's built-in Kubernetes in **kubeadm** mode: it sees images built by `docker compose build` and maps LoadBalancer Services to `localhost`.
- Student AKS later: one B2s node (2 vCPU, 4 GB), so requests stay small.

## Approaches (routing)

ingress-nginx, named in PRD §10.2, was retired upstream in March 2026, and AKS drops its managed copy on 2026-11-30.

1. **Gateway API with Envoy Gateway — chosen.** Current standard; same YAML on Docker Desktop and AKS; rate limiting and request buffering through its policy CRDs; cert-manager supports Gateway API for Phase 7. Costs a controller pod and one Envoy pod.
2. Traefik with Ingress resources. Closest to the PRD's `ingress.yaml` and lightest, but the Ingress API is the one being left behind.
3. AKS application routing (Istio-based Gateway API). Preview, AKS-only, can't be tested locally.

## Design

```text
k8s/
├── README.md                    how to run, cluster add-ons, versions
├── base/                        what every environment shares
│   ├── kustomization.yaml       namespace mdit, configMapGenerator (non-secret settings)
│   ├── namespace.yaml
│   ├── backend.yaml             Deployment (2 replicas) + ClusterIP Service :8000
│   ├── frontend.yaml            Deployment (2 replicas) + ClusterIP Service :80
│   ├── migrate-job.yaml         Job: alembic upgrade head
│   └── gateway.yaml             Gateway :80, HTTPRoutes, policies
├── cluster/gatewayclass.yaml    GatewayClass `eg` (cluster-scoped, outside the namespaced base)
└── overlays/local/
    ├── kustomization.yaml       adds MySQL + Azurite, local config, secretGenerator
    ├── mysql.yaml               StatefulSet + PVC + Service "mysql"
    ├── azurite.yaml             Deployment + PVC + Service "azurite"
    ├── secret.example.env       placeholders only (PRD's secret.example)
    └── secret.env               git-ignored; created from secret.example.env by `up`
scripts/k8s_local.sh             up | down | smoke
```

- **Kustomize** (built into `kubectl -k`) layers plain YAML; still hand-written manifests (PRD), no Helm. Phase 7 adds `overlays/aks`.
- Config and secrets come from generators, so a changed value rolls the pods (hash suffix).
- `enableServiceLinks: false` on every pod: Kubernetes would otherwise inject `MYSQL_PORT`-style variables (the Phase 4 note about naming a Service `db`).
- The migration Job is deleted and re-created by `scripts/k8s_local.sh up` (Jobs are immutable and the local tag never changes).
- Local entry point: `http://localhost` (port 80), so `PUBLIC_BASE_URL=http://localhost` and OAuth callbacks are `http://localhost/api/auth/callback/<provider>`. Browsers treat localhost as secure, so `COOKIE_SECURE=true` still works.
- `DB_SSL=true` makes PyMySQL use `ssl.create_default_context()` (system CAs, hostname checked).

## End-to-end check

`scripts/k8s_local.sh smoke` checks routing, headers, readiness and an anonymous 401. The full save-on-A/restore-on-B check (`scripts/api_smoke.py`) needs a signed-in user: it runs with `DEV_LOGIN=1` set on the live Deployment by `kubectl set env` for the test only, and removed afterwards; the manifests never contain it. Real GitHub sign-in on the cluster is the user's manual check (an OAuth app with a localhost callback).

## Left to the builder

Exact resource numbers, probe timings, Envoy Gateway policy field names (checked against the installed CRDs), rate-limit values.
