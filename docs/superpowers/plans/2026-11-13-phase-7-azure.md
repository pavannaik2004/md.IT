# Phase 7 — Azure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command (`scripts/azure.sh up`) builds md.IT on Azure at `https://mdit.centralindia.cloudapp.azure.com` before an internship review, one command (`down`) removes every billed resource after, and merges to `main` deploy while it exists.

**Architecture:** Terraform (run from a Docker tools image on the user's machine) creates resource group `mdit-rg` with ACR, AKS (one B2s node), MySQL Flexible Server and a Storage Account; state lives in `mdit-tfstate`, which `down` never touches. `k8s/overlays/aks` reuses `k8s/base` and adds HTTPS (cert-manager + Let's Encrypt) and Azure settings. `scripts/k8s_deploy.sh` is the one deploy order, used by `azure.sh up` from the host and by `deploy.yml` in GitHub Actions with stored credentials (no Azure role assignments, P-116).

**Tech Stack:** Terraform + `azurerm` 4.x + `random`, Azure CLI, kubectl/Kustomize, Envoy Gateway v1.9.3, cert-manager, GitHub Actions, `gh` on the host, Git Bash/POSIX sh.

**Spec:** `docs/superpowers/specs/2026-11-13-phase-7-azure-design.md`

## Global Constraints

- Every Azure resource of ours is in a resource group whose name starts with `mdit-` (plus AKS's node group `MC_mdit-rg_*`); scripts never act on any other group.
- No role assignments anywhere in Terraform (`azurerm_role_assignment` count = 0) (P-116).
- Region `centralindia`; AKS `Standard_B2s` × 1, OS disk 30 GB managed, Free tier, Kubernetes 1.36; MySQL `B_Standard_B1ms`, 20 GB, admin login `mdit`; ACR Basic with admin user; Storage Standard LRS (P-118, spec).
- Address `https://mdit.centralindia.cloudapp.azure.com`; label `mdit` is defined once, in `k8s/overlays/aks` (`PUBLIC_BASE_URL`), and scripts read it from there (P-120).
- No secrets in Git: `infra/azure.env`, `infra/.kube/`, `k8s/.deploy/` and Terraform state are git-ignored; `azure.example.env` holds placeholders only.
- Never deploy `latest`; images are `<acr>/mdit-backend:<git sha>` and `<acr>/mdit-frontend:<git sha>`.
- No `DEV_LOGIN` in any file under `k8s/` or `infra/` (P-058).
- Tools pinned to exact versions at least two weeks old, recorded as one decision; Envoy Gateway stays `v1.9.3`.
- No monitoring add-on, no HA, no zone redundancy (cost).
- The user's Docker Desktop builds one image at a time (Phase 6).
- Update `context.md` after each task and `decisions.md` for every choice (CLAUDE.md).

## Review Focus

- Re-running `up` on a deployment that already exists: must not fail on the DNS-label check (the label is ours), must not duplicate anything, and must restart pods when `mdit-secrets` changed (e.g. OAuth values added). → Task 6 test "second `up`".
- `down` when things are half there (a failed `apply`, or already destroyed): must finish, and must still report leftovers. → Task 8 step "`down` twice".
- `up` from a dirty tree or a commit not on GitHub: images would carry a SHA nobody can find; `up` refuses a dirty tree and warns when HEAD isn't on `origin`. → Task 6 test.
- Azure sign-in expired or Docker Desktop not running: every script stops in its first seconds with what to do (`docker`, `az login` command), not a Terraform stack trace. → Task 1 test.
- A merge to `main` while nothing is deployed: `deploy.yml` ends green with a notice and never waits for an approval. → Task 7 test.

---

### Task 1: Tools image, config and pinned versions

**Files:**
- Create: `infra/tools/Dockerfile`, `infra/azure.example.env`, `scripts/lib/azure_tools.sh`
- Modify: `.gitignore` (add `infra/azure.env`, `infra/.kube/`, `k8s/.deploy/`), `decisions.md`

**Interfaces:**
- Produces: image `mdit-tools:<version-tag>` built from `infra/tools/Dockerfile` (Azure CLI + Terraform + kubectl); shell library `scripts/lib/azure_tools.sh` with:
  - `tools <cmd...>` — `docker run --rm -i` the image with volume `mdit-azure:/root/.azure`, the repo at `/work`, workdir `/work`, `KUBECONFIG=/work/infra/.kube/config`, `MSYS_NO_PATHCONV=1`; passes `ARM_SUBSCRIPTION_ID`.
  - `load_config` — sources `infra/azure.env`; dies naming the missing key (`SUBSCRIPTION_ID`, `ACME_ISSUER`) or the file (“copy infra/azure.example.env”).
  - `preflight` — dies with a one-line fix if Docker isn't running, or if `tools az account show` fails (“run: scripts/azure.sh login”).
  - `site_label` / `site_url` — read from `k8s/overlays/aks/kustomization.yaml`'s `PUBLIC_BASE_URL` (Task 4); `site_label` prints `mdit`.
  - `say`, `die` as in `scripts/k8s_local.sh`.
- `azure.example.env` keys: `SUBSCRIPTION_ID=`, `TFSTATE_ACCOUNT=` (filled by bootstrap), `ACME_ISSUER=staging`, `GITHUB_CLIENT_ID=`, `GITHUB_CLIENT_SECRET=`, `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`.

- [ ] **Step 1:** Pick versions (each released ≥ 14 days before 2026-11-13, newest that qualifies): Azure CLI image tag, Terraform, `hashicorp/azurerm` 4.x, `hashicorp/random`, kubectl (1.36.x to match AKS), cert-manager. Check each release page/registry; add decision P-121 with the list and the date checked.
- [ ] **Step 2:** Write the Dockerfile: `FROM mcr.microsoft.com/azure-cli:<tag>`, download the Terraform and kubectl release binaries by exact version and verify their SHA256 sums in the build.
- [ ] **Step 3:** Write `scripts/lib/azure_tools.sh` and the config files; `cp infra/azure.example.env infra/azure.env` and fill `SUBSCRIPTION_ID` locally (never committed).
- [ ] **Step 4: Verify**
  Run: `docker build -t mdit-tools:p7 infra/tools && . scripts/lib/azure_tools.sh && tools terraform version && tools kubectl version --client && tools az account show --query name -o tsv`
  Expected: the pinned versions print; the subscription name prints.
  Run with Docker Desktop's engine stopped is impractical; instead run `DOCKER_HOST=tcp://127.0.0.1:1 sh -c '. scripts/lib/azure_tools.sh; preflight'` → one line naming Docker; and `tools az logout` against a throwaway volume (`MDIT_AZ_VOLUME=mdit-azure-test`) → `preflight` prints the login hint.
- [ ] **Step 5:** `git check-ignore infra/azure.env` succeeds; `shellcheck scripts/lib/azure_tools.sh` clean. Commit.

### Task 2: State storage bootstrap

**Files:**
- Create: `infra/bootstrap.sh`

**Interfaces:**
- Consumes: `tools`, `load_config`, `preflight` (Task 1).
- Produces: resource group `mdit-tfstate` (centralindia), storage account `mdittfstate<6 lowercase alnum>` (Standard LRS, TLS 1.2, no public blob access), container `tfstate`; writes `TFSTATE_ACCOUNT=<name>` into `infra/azure.env`.

- [ ] **Step 1:** Write `bootstrap.sh`: if `TFSTATE_ACCOUNT` is set and the account exists, print "already bootstrapped" and exit 0; otherwise create the three resources with `az` and write the name back.
- [ ] **Step 2: Verify** — run it twice.
  Expected: first run creates; second prints "already bootstrapped"; `tools az group show -n mdit-tfstate` succeeds; `TFSTATE_ACCOUNT` is in `infra/azure.env` and not in `git status`.
- [ ] **Step 3:** shellcheck; README note deferred to Task 8. Commit; log the account creation in `context.md`.

### Task 3: Terraform

**Files:**
- Create: `infra/terraform/{versions.tf,backend.tf,variables.tf,main.tf,outputs.tf}`, `infra/terraform/modules/{acr,aks,mysql,storage}/{main.tf,variables.tf,outputs.tf}`, `infra/terraform/.terraform.lock.hcl` (committed)

**Interfaces:**
- Consumes: `TFSTATE_ACCOUNT`, `SUBSCRIPTION_ID`.
- Produces: `terraform -chdir=infra/terraform init -backend-config=storage_account_name=$TFSTATE_ACCOUNT` (backend `azurerm`, resource group `mdit-tfstate`, container `tfstate`, key `mdit.tfstate`); outputs (used by Task 6): `resource_group`, `aks_name`, `node_resource_group`, `acr_login_server`, `acr_username`, `acr_password` (sensitive), `mysql_fqdn`, `db_password` (sensitive), `blob_connection_string` (sensitive).
- Variables: `subscription_id` (from `ARM_SUBSCRIPTION_ID`), `location = "centralindia"`, `prefix = "mdit"`.

- [ ] **Step 1:** Root: resource group `mdit-rg`; one `random_string` suffix (6, lower + digits, no special) shared by globally unique names; `random_password` for MySQL (32, `special = false`).
- [ ] **Step 2:** Modules, values from Global Constraints:
  - `acr`: `sku = "Basic"`, `admin_enabled = true`.
  - `aks`: `sku_tier = "Free"`, `kubernetes_version = "1.36"`, default pool `vm_size = "Standard_B2s"`, `node_count = 1`, `os_disk_size_gb = 30`, `os_disk_type = "Managed"` (B2s's 8 GB cache can't hold an ephemeral 30 GB disk), SystemAssigned identity, `network_plugin = "azure"` + `network_plugin_mode = "overlay"`, `load_balancer_sku = "standard"`, local accounts on, no `oms_agent`. Output the outbound public IP **address** (resolve `effective_outbound_ips` IDs with a `azurerm_public_ip` data source).
  - `mysql`: `sku_name = "B_Standard_B1ms"`, `version` = `"8.4"` if `az mysql flexible-server list-skus`/the provider accepts it in centralindia, else `"8.0.21"` (record as a decision), `storage.size_gb = 20`, `backup_retention_days = 1`, no HA, `administrator_login = "mdit"`; database `mdit`, `utf8mb4` / `utf8mb4_0900_ai_ci`; one firewall rule, start = end = AKS outbound IP.
  - `storage`: Standard LRS, `min_tls_version = "TLS1_2"`, `allow_nested_items_to_be_public = false`.
- [ ] **Step 3: Verify (no cost)**
  Run: `tools terraform -chdir=infra/terraform fmt -check -recursive && tools terraform -chdir=infra/terraform init -backend-config=... && tools terraform -chdir=infra/terraform validate && tools terraform -chdir=infra/terraform plan -out=/tmp/p`
  Expected: validate OK; plan shows only `create` actions, all in `mdit-rg`; `grep -c azurerm_role_assignment` over `terraform show -no-color` output = 0.
- [ ] **Step 4:** Commit (lock file included).

### Task 4: `k8s/overlays/aks`

**Files:**
- Create: `k8s/overlays/aks/{kustomization.yaml,gateway-https.yaml,redirect.yaml,envoyproxy.yaml,issuers.yaml,azure-config.patch.yaml}`, `scripts/check_aks_overlay.sh`
- Modify: none in `k8s/base`

**Interfaces:**
- Consumes: `k8s/base` (Gateway `mdit`; HTTPRoutes `api`, `api-signin`, `api-upload`, `web`; Deployments `backend`, `frontend`; Job `mdit-migrate`; Namespace `mdit`).
- Produces (used by Tasks 5–7):
  - ConfigMap merge: `DB_SSL=true`, `PUBLIC_BASE_URL=https://mdit.centralindia.cloudapp.azure.com`.
  - `backend` and `mdit-migrate` also read ConfigMap **`mdit-azure`** (key `DB_HOST`, created by `azure.sh`), via `envFrom` patch; `mdit-secrets` is referenced, not generated.
  - The Namespace object is removed (`$patch: delete`) — `azure.sh` creates it, so the CI ServiceAccount needs no cluster-scoped rights.
  - Gateway listeners `http` (80) and `https` (443, `certificateRefs: mdit-tls`); `infrastructure.parametersRef` → EnvoyProxy `mdit-proxy`.
  - HTTPRoute `http-redirect` on `sectionName: http`, `/` → `RequestRedirect {scheme: https, statusCode: 301}`; the four app routes get `parentRefs[0].sectionName: https`.
  - EnvoyProxy `mdit-proxy`: Service annotation `service.beta.kubernetes.io/azure-dns-label-name: mdit`; proxy container requests `cpu: 50m, memory: 128Mi`, limit `memory: 512Mi`; `externalTrafficPolicy` not set (Envoy Gateway's `Local` default stays).
  - Issuers `letsencrypt-staging` and `letsencrypt-prod` (ACME, no e-mail, HTTP-01 `gatewayHTTPRoute.parentRefs: [{name: mdit, sectionName: http}]`).
  - ServiceAccount `default` patched with `imagePullSecrets: [{name: acr-pull}]`.
  - Images `mdit-backend`/`mdit-frontend` → `newTag: set-by-deploy` (passes CI's explicit-tag check; never deployable as is).
- `scripts/check_aks_overlay.sh <rendered.yaml>` exits non-zero naming each failed assertion.

- [ ] **Step 1: Write the failing check** — `check_aks_overlay.sh` asserts on `kubectl kustomize k8s/overlays/aks` output: no `kind: Namespace`; no `kind: Secret`; `DB_SSL: "true"`; the exact `PUBLIC_BASE_URL`; each of `api api-signin api-upload web` has `sectionName: https`; `http-redirect` has `scheme: https` and `statusCode: 301`; Gateway has ports 80 and 443 and `mdit-tls`; the DNS-label annotation is `mdit`; `backend` and `mdit-migrate` reference `mdit-azure`; both Issuers exist with HTTP-01; `imagePullSecrets` `acr-pull`; no `DEV_LOGIN`.
- [ ] **Step 2:** Run it against the not-yet-written overlay → FAIL (render error).
- [ ] **Step 3:** Write the overlay.
- [ ] **Step 4:** `kubectl kustomize k8s/overlays/aks > /tmp/aks.yaml && scripts/check_aks_overlay.sh /tmp/aks.yaml` → all pass; the local overlay still renders unchanged (`git diff --stat` shows no `k8s/base` or `overlays/local` change). Server-side validation of the CRD fields is in Task 8 (`kubectl apply --dry-run=server`). Commit.

### Task 5: Shared deploy script

**Files:**
- Create: `scripts/k8s_deploy.sh`, `scripts/lib/k8s.sh`
- Modify: `scripts/k8s_local.sh` (source `scripts/lib/k8s.sh` for `wait_for_job`; `BASE_URL=${MDIT_BASE_URL:-http://localhost}` so `smoke` can target Azure)

**Interfaces:**
- Produces: `scripts/k8s_deploy.sh <overlay-dir> <registry-or-empty> <tag>`, using `kubectl` with the ambient `KUBECONFIG`/context and namespace `mdit`:
  1. writes `k8s/.deploy/kustomization.yaml` = `resources: [../overlays/<name>]` + `images:` with `newName: <registry>/mdit-backend` (omitted when registry empty) and `newTag: <tag>`;
  2. deletes Job `mdit-migrate` (foreground, ignore missing) → `kubectl apply -k k8s/.deploy` → `wait_for_job` → `rollout status` backend and frontend (300 s) → deletes ConfigMaps named `mdit-config-*` that no Deployment's pod template references.
- `scripts/lib/k8s.sh`: `wait_for_job <ns> <job>` (moved from `k8s_local.sh`, same behaviour and messages).

- [ ] **Step 1:** Write `lib/k8s.sh` and `k8s_deploy.sh`; switch `k8s_local.sh` to the library.
- [ ] **Step 2: Verify on the local cluster** (Docker Desktop, already running)
  Run: `scripts/k8s_local.sh up && scripts/k8s_deploy.sh k8s/overlays/local "" local && scripts/k8s_local.sh smoke`
  Expected: deploy prints the Job finishing and both rollouts; smoke 9/9; after changing a ConfigMap literal locally and re-running deploy, `kubectl -n mdit get cm` shows one `mdit-config-*` (revert the change after).
- [ ] **Step 3:** shellcheck all three scripts. Commit.

### Task 6: `scripts/azure.sh`

**Files:**
- Create: `scripts/azure.sh`, `infra/README.md`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `scripts/azure.sh login | up | down [--yes] | status | smoke`.
  - `login`: `tools az login --use-device-code`.
  - `up`: `preflight` → refuse a dirty tree; warn if HEAD isn't on `origin` → if `mdit-rg` doesn't exist, check the label with `CheckDnsNameAvailability` and die "label mdit is taken — change PUBLIC_BASE_URL in k8s/overlays/aks and your OAuth callbacks" → `terraform init` + `apply -auto-approve` → `az aks get-credentials --admin --file infra/.kube/config` → Envoy Gateway v1.9.3 (as `k8s_local.sh`, then `kubectl set resources deployment/envoy-gateway -n envoy-gateway-system --requests=cpu=50m,memory=128Mi`) → cert-manager (pinned release manifest; add `--enable-gateway-api` to the controller args if absent; wait Available) → `kubectl apply -f k8s/cluster/` → namespace `mdit` → ConfigMap `mdit-azure` (`DB_HOST`), Secret `mdit-secrets` (`DB_PASSWORD`, `BLOB_CONNECTION_STRING`, `SESSION_SECRET` — kept if the Secret already has one, else 48 random url-safe chars — and the OAuth values present in `azure.env`), docker-registry Secret `acr-pull` → if `mdit-secrets`' content hash changed and Deployments exist, `rollout restart` them → ServiceAccount `mdit-deployer` + Role (namespace `mdit` only; verbs to get/list/watch/create/update/patch/delete exactly the kinds in the rendered overlay plus Jobs, pods, pods/log) + RoleBinding + token Secret → `gh secret set --env prod` `KUBECONFIG_B64` (server + CA + that token), `ACR_USERNAME`, `ACR_PASSWORD`; `gh variable set ACR_LOGIN_SERVER`; `gh variable set MDIT_CLUSTER --body up` → `docker login`, build backend then frontend tagged `<acr>/…:<HEAD sha>`, push → `tools sh scripts/k8s_deploy.sh k8s/overlays/aks <acr> <sha>` → apply Certificate `mdit-tls` (dnsNames the site host, issuer `letsencrypt-$ACME_ISSUER`) and wait Ready (5 min) → wait for `https://…/api/health/ready` 200 (`-k` when staging) → print the URL and elapsed time.
  - `down`: unless `--yes`, ask to type `mdit` → `gh variable set MDIT_CLUSTER --body down`, delete the three env secrets (ignore missing) → `terraform destroy -auto-approve` → list resource groups starting `mdit-` or `MC_mdit-` other than `mdit-tfstate`; non-zero exit if any remain.
  - `status`: whether `mdit-rg` exists, AKS power state, site URL, `/api/health/ready` code.
  - `smoke`: `MDIT_BASE_URL=<site> scripts/k8s_local.sh smoke` plus: `http://` → 301 to `https://`, and (prod issuer) `curl` without `-k` succeeds.
- `infra/README.md`: first-time setup (login, `azure.env`, bootstrap, GitHub `prod` environment), before/after a review, OAuth callback URLs, cost per day, the 30-day/5-certs caveats.

- [ ] **Step 1:** Write `azure.sh` and `infra/README.md`. shellcheck clean.
- [ ] **Step 2: Test the guards (no cost):** `touch scratch && scripts/azure.sh up` → dies "uncommitted changes" (remove `scratch`); `scripts/azure.sh down --yes` with nothing deployed → destroy is a no-op, leftover list empty, exit 0.
- [ ] **Step 3:** Commit. (The real `up` is Task 8.)

### Task 7: Workflows

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/infra.yml`
- Modify: `.github/workflows/ci.yml` (paths and `k8s` job)

**Interfaces:**
- Consumes: env `prod` secrets/vars from Task 6; `scripts/k8s_deploy.sh`.
- `deploy.yml`: `on: push: branches [main], paths [backend/**, frontend/**, k8s/**, scripts/k8s_deploy.sh, scripts/lib/**]` + `workflow_dispatch`; `concurrency: deploy` (no cancel). Job `gate` (no environment): if `vars.MDIT_CLUSTER != 'up'`, write `::notice::No Azure deployment — run scripts/azure.sh up` and set output `run=false`. Job `deploy` (`needs: gate`, `if: needs.gate.outputs.run == 'true'`, `environment: prod`, `permissions: contents: read`): checkout → write `KUBECONFIG_B64` to a file → `docker login` with `ACR_*` (password via stdin) → build and push backend then frontend tagged `${{ github.sha }}` → `scripts/k8s_deploy.sh k8s/overlays/aks "$ACR_LOGIN_SERVER" "$GITHUB_SHA"`. Actions pinned like `ci.yml` (`actions/checkout@v5`).
- `infra.yml`: on PRs touching `infra/**`: `terraform fmt -check -recursive`, `terraform init -backend=false`, `validate` (Terraform version from Task 1), plus shellcheck of `infra/*.sh`.
- `ci.yml`: add `scripts/**` to paths; `k8s` job renders `overlays/aks` and runs `scripts/check_aks_overlay.sh`, extends the DEV_LOGIN and explicit-tag checks to it, shellchecks `scripts/*.sh scripts/lib/*.sh`.

- [ ] **Step 1:** Create GitHub environment `prod` with the user as required reviewer: `gh api -X PUT repos/pavannaik2004/md.IT/environments/prod --input -` with `{"reviewers":[{"type":"User","id":<gh api user --jq .id>}]}`.
- [ ] **Step 2:** Write the workflows; `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:<pinned>` → clean.
- [ ] **Step 3:** Push the branch, open the PR; CI (incl. `k8s` with the aks overlay) and `infra` go green. `deploy.yml` can't run until merged (GitHub only runs `push`/dispatch for workflows on the default branch) — checked in Task 8.
- [ ] **Step 4:** Commit; log in `context.md`.

### Task 8: First real build, `down`, rebuild, merge

All on the real subscription; record the time `up` takes and the day's cost estimate in `context.md`.

- [ ] **Step 1:** `infra/bootstrap.sh` (if Task 2 didn't already create it) → `ACME_ISSUER=staging scripts/azure.sh up`. Then, with the CI kubeconfig decoded from what `up` stored, `kubectl apply --dry-run=server -k k8s/.deploy` and `kubectl -n mdit delete job mdit-migrate --dry-run=server` must succeed (proves the Role covers every kind `deploy.yml` touches). Expected: URL printed; `scripts/azure.sh smoke` passes except the trusted-certificate check.
- [ ] **Step 2:** Set `ACME_ISSUER=prod`, `scripts/azure.sh up` again (second-`up` test: no label failure, no duplicates, certificate re-issued trusted) → `smoke` fully green.
- [ ] **Step 3:** User creates the GitHub OAuth app (callback `https://mdit.centralindia.cloudapp.azure.com/api/auth/callback/github`; Google optional), puts the values in `infra/azure.env`; `scripts/azure.sh up` → pods restart (secret changed) → user signs in with GitHub and saves a version.
- [ ] **Step 4:** `scripts/azure.sh down --yes`, then again (`down` twice) → both exit 0, leftover list empty; `tools az group list` shows only `mdit-tfstate` of ours.
- [ ] **Step 5:** Merge the PR after the whole-branch review. Push with no cluster → `deploy.yml` green with the notice, no approval asked.
- [ ] **Step 6:** `scripts/azure.sh up` (prod issuer) → site up again; push a trivial change to `main` → approve in GitHub → deploy rolls out the new SHA; `smoke` green. Leave it running only if the user wants it up now; otherwise `down`.
- [ ] **Step 7:** README section linking `infra/README.md`; `context.md` (phase checklist "Done", cost and timing), decisions for anything changed on the way. Commit.
