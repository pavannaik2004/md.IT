# md.IT on Kubernetes

Hand-written manifests (PRD §10.2), layered with Kustomize (`kubectl -k`, no extra tools).

```text
k8s/
├── base/               shared by every environment
│   ├── backend.yaml        Deployment (2 replicas, probes, limits) + Service :8000
│   ├── frontend.yaml       Deployment (2 replicas) + Service :80
│   ├── migrate-job.yaml    Job: alembic upgrade head (database settings only)
│   ├── gateway.yaml        Gateway API: /api → backend, / → frontend, limits
│   └── kustomization.yaml  namespace mdit, non-secret settings (ConfigMap)
├── cluster/            cluster add-ons that aren't namespaced (GatewayClass `eg`)
└── overlays/
    └── local/          Docker Desktop: adds MySQL and Azurite, local settings, the Secret
```

Routing uses the Gateway API on [Envoy Gateway](https://gateway.envoyproxy.io/) v1.9.3. The PRD names ingress-nginx, which was retired upstream in March 2026.

## Local cluster (Docker Desktop)

One-time setup: Docker Desktop → **Settings → Kubernetes** → **Enable Kubernetes**, provisioning method **kubeadm** (it uses the images Compose builds and serves LoadBalancers on `localhost`) → **Apply & restart**.

```sh
scripts/k8s_local.sh up      # install Envoy Gateway if needed, build images, deploy, migrate
scripts/k8s_local.sh smoke   # check routing, headers, readiness and limits
scripts/k8s_local.sh down    # delete the mdit namespace, including its database and blobs
```

Run it from Git Bash on Windows. The app is at **http://localhost** (port 80; Compose stays on :8080, so both can run). `up` again after a code change: it rebuilds, re-runs the migration Job and restarts the pods.

`up` creates `overlays/local/secret.env` from `secret.example.env` with a random database password and session secret. It is git-ignored. MySQL keeps the password it was first created with, so after deleting `secret.env` run `down` before `up`.

Useful commands:

```sh
kubectl -n mdit get pods
kubectl -n mdit logs deploy/backend
kubectl -n mdit logs job/mdit-migrate
kubectl -n mdit get gateway,httproute,backendtrafficpolicy
```

### Sign-in

The dev login is never in the manifests (P-058). To sign in on the cluster, create a GitHub OAuth app (Settings → Developer settings → OAuth Apps) with homepage `http://localhost` and callback `http://localhost/api/auth/callback/github`, put its ID and secret in `overlays/local/secret.env`, and run `up`. Google works the same way with `http://localhost/api/auth/callback/google`.

To run `scripts/api_smoke.py` against the cluster, turn the dev login on for the test only and off again afterwards:

```sh
kubectl -n mdit set env deployment/backend DEV_LOGIN=1
kubectl -n mdit rollout status deployment/backend
python scripts/api_smoke.py http://localhost
kubectl -n mdit set env deployment/backend DEV_LOGIN-
```

## Limits at the gateway

| Route | Limit |
| --- | --- |
| All of `/api` | request bodies up to 6 MiB, read in full before the backend sees them (413 above) |
| `/api/auth/login`, `/api/auth/callback` | 30 requests a minute per client address |
| `PUT /api/blobs` | 300 requests a minute per client address |

`smoke` uses up the sign-in allowance for a minute.

## Phase 7 (AKS)

An `overlays/aks` adds: `DB_HOST` of the Azure MySQL server with `DB_SSL=true`, `PUBLIC_BASE_URL` with the public host name, the ACR image names tagged with the commit SHA, an HTTPS listener with a cert-manager certificate, and the Secret created by the deploy workflow. Envoy's Service needs `externalTrafficPolicy: Local` there, or every client shares one address and one rate limit.
