# Phase 7 — Azure: design

Date: 2026-11-13 · Branch: `phase-7-aks` · Decisions: P-116…P-119 (and those this spec adds)

## Intent

Host md.IT on Azure so it can be shown at the user's internship reviews. The deployment exists only around a review: one command builds everything before a review, one command removes it after (P-119). It has to come up reliably on review day and cost close to nothing in between, because the subscription is a college CSP subscription with no spending limit: every charge is real money on the college's bill.

The PRD's Phase 7 (Terraform modules, AKS, ACR, MySQL, Storage, TLS, deploy and infra workflows; "merge to main deploys to AKS automatically") stays the target, adjusted for what the account allows.

## Goals

1. `scripts/azure.sh up` takes an empty resource group to a working site at a fixed HTTPS address, **`https://mdit.centralindia.cloudapp.azure.com`** (label `mdit`, user's choice, P-120), with no hand steps. The label is only held while the deployment exists, so `up` first checks it is free (`CheckDnsNameAvailability`) and stops with a clear message if not; the fix is a new label in `infra/azure.env` plus new OAuth callback URLs.
2. `scripts/azure.sh down` removes every billed resource; only the Terraform state storage (cents per month) stays.
3. While the cluster exists, a merge to `main` that touches the app or `k8s/` builds both images, pushes them to ACR tagged with the commit SHA, runs the migration Job and rolls out (PRD §11). While it doesn't exist, the same workflow skips with a notice and stays green.
4. The same images and the same `k8s/base` as Phase 6; Azure differences live in `k8s/overlays/aks`.
5. HTTPS with a Let's Encrypt certificate; HTTP redirects to HTTPS.
6. GitHub and Google sign-in work on the deployed site (callbacks don't change between builds because the address doesn't).

## Non-goals

- Keeping data between reviews: each `up` starts with an empty database and blob store; sign-in and saving are shown live (user, 2026-11-13). Projects in a browser are local-first and unaffected.
- Separate `dev` and `prod` environments (PRD §11): one environment, `prod`.
- Key Vault, Helm, autoscaling, Argo CD (Phase 8).
- Monitoring add-ons (Container Insights / Log Analytics): they bill per GB and aren't needed for a demo.

## Anti-goals

- Anything left running or billing after `down`. `down` must report what, if anything, is still in the subscription under our names.
- Touching other teams' resources. The subscription is shared (other resource groups, another AKS cluster): everything of ours is in resource groups named `mdit-*`, and the scripts never act outside them.
- Secrets in Git: subscription ID, OAuth secrets, database password, registry and cluster credentials stay in git-ignored files, Terraform state, the cluster, or GitHub Secrets.
- Deploying the `latest` tag (PRD §11).

## Constraints

- **Role: Contributor** on the subscription through the group WiC-Internship. No role assignments (P-116), so: no AcrPull role for AKS (registry credential as an image pull secret instead), no Azure sign-in from GitHub Actions (OIDC impossible), Terraform runs on the user's machine.
- **Region Central India; AKS on one Standard_B2s node; MySQL Flexible Server Burstable Standard_B1ms** (P-118). Quota is 50 vCPUs, all needed providers registered, no policies.
- **Tools run in Docker** (the user installs nothing): the Azure CLI image with the sign-in kept in the Docker volume `mdit-azure`. `gh` is already signed in on the host and is used for GitHub Secrets and starting workflows.
- **The repo is public**, so a GitHub Environment can require approval at no cost.
- **Let's Encrypt** issues about 5 certificates per week for the same name: trial runs use its staging issuer.
- Phase 6 carry-overs (context.md): AKS OS disk ~30 GB (the 128 GB default is a paid disk); keep Envoy Gateway's `externalTrafficPolicy: Local`; `DB_HOST` is the MySQL server's FQDN (TLS checks the name; `DB_SSL=true`, P-114); app routes bind to the HTTPS listener with `sectionName`; smaller Envoy requests to fit one B2s node; CI renders `overlays/aks`; `deploy.yml` repeats `up`'s order (delete Job, apply, wait, roll out) and removes old hash-suffixed ConfigMaps.

## Approaches

How the deployment lives between reviews:

| | Approach | Trade-off |
|---|---|---|
| **Chosen** | **Build before each review, destroy after** (`terraform apply` / `destroy`) | ~$0 idle; a build takes ~25–30 min and starts with an empty database; new certificate each build |
| | Keep everything, stop AKS and MySQL between reviews | ~$10–15/month idle, data kept, 5–10 min start; MySQL restarts itself after 30 days stopped |
| | Always on | No start step; ~$75–80/month |

The user chose the first (P-119): the site is for reviews, and the college pays.

How CI reaches Azure, given Contributor only (P-116, user's choice): **stored credentials** (ACR push credentials and a kubeconfig limited to the app namespace in GitHub Secrets, refreshed by every `up`) rather than waiting for an admin to grant roles for OIDC.

## Design

### Layout

```
infra/
  bootstrap.sh            one-time: resource group mdit-tfstate + storage account + container for state
  tools/Dockerfile        Azure CLI + Terraform + kubectl, pinned (one image the scripts run)
  terraform/
    main.tf, variables.tf, outputs.tf, versions.tf, backend.tf
    modules/{network?, acr, aks, mysql, storage}   (see "Left to the builder" on network)
  azure.example.env       keys for the git-ignored infra/azure.env
scripts/azure.sh          up | down | status
scripts/k8s_deploy.sh     the deploy order, shared by azure.sh up and deploy.yml
k8s/overlays/aks/         kustomization, HTTPS listener + redirect, cert-manager issuer, EnvoyProxy, pull-secret patch
k8s/cluster/              + EnvoyProxy/GatewayClass parameters if the AKS overlay needs cluster-scoped pieces
.github/workflows/deploy.yml, infra.yml
```

`infra/azure.env` (git-ignored) holds the subscription ID, the DNS label, the issuer (`staging` | `prod`) and the OAuth client IDs and secrets. *Builder's call:* the Let's Encrypt account has no e-mail (ACME allows it; it keeps personal data out of config); the cost is no expiry reminders, which don't matter for certificates that live a day.

### Azure resources (Terraform)

- **State:** `azurerm` backend in the storage account `bootstrap.sh` creates once in resource group `mdit-tfstate` (outside `destroy`). Access by account key, which Contributor can read.
- **Resource group `mdit-rg`** holds everything else, so `destroy` is one group.
- **ACR**, Basic tier, admin user enabled (its credentials are the push and pull credentials). Globally unique name with a random suffix.
- **AKS**, Free tier, Kubernetes 1.36 (matches Phase 6's v1.36.1 and Envoy Gateway v1.9's 1.33–1.36), one `Standard_B2s` node in the system pool, OS disk ~30 GB managed or ephemeral (whichever B2s allows without the paid 128 GB default), AKS-managed network (a custom subnet would need a role assignment), local accounts on, no monitoring add-on.
- **MySQL Flexible Server**, Burstable `Standard_B1ms`, MySQL 8.4 if Azure offers it in Central India (else 8.0, recorded as a decision), 20 GB storage, no HA, public access with a firewall rule for the AKS cluster's outbound IP only, TLS required (Azure default). Database `mdit`; random admin password from Terraform. *Builder's call:* the admin login is `mdit` and the app and migrations use it, so the base's `DB_USER=mdit` holds and nothing creates a second MySQL user — acceptable for a review-only deployment whose database is thrown away; a least-privilege app user is a later improvement.
- **Storage account** (Standard LRS) for blobs; the backend gets its connection string and creates the container itself (`ensure_container`, P-054).
- **Outputs:** ACR login server and credentials, MySQL FQDN, blob connection string, DB password, cluster name — marked sensitive where they are secrets. They feed `azure.sh`, never Git.

### `scripts/azure.sh`

Runs on the host (Git Bash), calling the tools image for `az`, `terraform`, `kubectl`, and the host's `gh`.

- **`up`:** check sign-in and config → `terraform apply` → fetch the cluster's admin kubeconfig into a git-ignored path → install Envoy Gateway v1.9.3 (same as Phase 6) and cert-manager (pinned, Gateway API support on) → apply `k8s/cluster` → create namespace `mdit`, Secret `mdit-secrets` (DB password, session secret, blob connection string, OAuth values) and the registry pull secret from Terraform outputs and `azure.env` → create the CI ServiceAccount, its Role (only namespace `mdit`, only the kinds the overlay applies plus Jobs and pods/log) and token → write GitHub Secrets (`KUBECONFIG_B64`, ACR server and push credentials) and set the repo variable `MDIT_CLUSTER=up` → **deploy the current checkout from the host**: build the two images one at a time (Phase 6: building both at once crashed Docker Desktop), tag them with `git rev-parse HEAD` (refuse a dirty tree), push to ACR, then run `scripts/k8s_deploy.sh` → print the site URL. Re-running `up` is safe (everything idempotent). Deploying from the host means the first hosting doesn't wait for `deploy.yml` to reach `main` (GitHub can only start a workflow by hand once its file is on the default branch) or for an approval.
- **`down`:** set `MDIT_CLUSTER=down` and delete those GitHub Secrets first, then `terraform destroy`, then list anything still named `mdit-*` outside `mdit-tfstate` (including AKS's node resource group) and say so if it isn't empty.
- **`status`:** what exists, the site URL, and whether `/api/health` answers.

### `k8s/overlays/aks`

- `../../base` plus: ConfigMap merge with `DB_SSL=true`, `PUBLIC_BASE_URL=https://<label>.centralindia.cloudapp.azure.com`; `DB_HOST` comes from the cluster (the server name has a random suffix), so it is a value `azure.sh` writes into a small ConfigMap or the Secret rather than a literal in Git.
- No `secretGenerator`: `mdit-secrets` is created by `azure.sh` (fixed name).
- Images: `kustomize edit set image` in `deploy.yml` to `<acr>/mdit-backend:<sha>` and `<acr>/mdit-frontend:<sha>`; the checked-in overlay names a placeholder tag that CI's "never latest" check accepts.
- `imagePullSecrets` on the namespace's `default` ServiceAccount (patch).
- Gateway: HTTPS listener on 443 with the certificate Secret, HTTP listener kept for the ACME challenge and a `RequestRedirect` (301 to https) route; app routes get `sectionName: https`.
- cert-manager `Issuer` (staging and prod, picked by `azure.env`) with the HTTP-01 Gateway API solver on the `http` listener, and a `Certificate` for the hostname.
- `EnvoyProxy` (referenced from the Gateway) with the Service annotation `service.beta.kubernetes.io/azure-dns-label-name: <label>` and smaller requests; `externalTrafficPolicy` left at Envoy Gateway's `Local`.

### Workflows

- **`deploy.yml`** — on push to `main` (path filter: `backend/`, `frontend/`, `k8s/`) and on manual run. Environment `prod` with the user as required reviewer. First step: if `vars.MDIT_CLUSTER != 'up'`, write a notice ("no cluster — run scripts/azure.sh up") and stop green. Otherwise: build both images, push to ACR tagged with `github.sha`, then `scripts/k8s_deploy.sh <acr> <sha>` — the one deploy script `azure.sh up` also uses: `kustomize edit set image` on a temporary copy of the overlay, render, then the Phase 6 order: delete the migration Job (foreground) → `kubectl apply` → wait for the Job (fail the run if it fails) → `rollout status` for backend and frontend → delete `mdit-config-*` ConfigMaps no Deployment references. Rollback = re-run the workflow for an earlier SHA.
- **`infra.yml`** — on PRs touching `infra/`: `terraform fmt -check`, `terraform validate` (no backend, no Azure sign-in). Plan and apply run from the user's machine (P-116).
- **`ci.yml`** — the `k8s` job also renders `overlays/aks` with placeholder secrets and runs the same "no DEV_LOGIN" and "explicit tag" checks.

### Cost (estimate, checked against Azure pricing during planning)

Per running day ≈ US$2.5 (B2s node, load balancer + public IP, MySQL B1ms, ACR Basic, storage). Between reviews: the state storage account only.

## End-to-end check

On a real `up` with the staging issuer, then again with prod: `azure.sh status` green; the Phase 6 smoke checks against the HTTPS address (landing 200, CSP header, deep link, `/api/health/live` and `/ready` 200, 401 without session, dev login 404, 7 MB upload 413, sign-in 429 after the limit, HTTP → HTTPS 301, valid certificate); `scripts/api_smoke.py` is not run on Azure (it needs DEV_LOGIN); real GitHub sign-in by the user; a push to `main` deploys a new SHA with no downtime; `down` leaves nothing named `mdit-*` except `mdit-tfstate`; a push after `down` gives a green skipped deploy. Record the real time `up` takes.

## Left to the builder

- Exact pinned versions (Terraform, azurerm provider, cert-manager, Azure CLI, kubectl), each at least two weeks old, recorded as a decision.
- Whether AKS on B2s allows an ephemeral OS disk; otherwise a 30 GB managed disk.
- Whether MySQL 8.4 is offered; whether the firewall needs the outbound IP from the load balancer profile or a data source.
- Module granularity (a `network` module only if one is needed).
- The ServiceAccount's exact Role rules (`kubectl auth can-i` against the rendered overlay).
- Whether cert-manager's Gateway API support needs the experimental flag on v1.x chosen.
- How the deploy job waits for the approval when `up` starts it (print the run URL; the user approves).
