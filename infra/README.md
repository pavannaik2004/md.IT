# md.IT on Azure (Phase 7)

md.IT runs on Azure only around internship reviews: build it before a review, destroy it after
(decision P-119). The college subscription bills real money with no spending limit, so nothing
should be left running in between.

Address: **https://mdit.centralindia.cloudapp.azure.com**

Everything runs in Docker (the tools image in `infra/tools/`); the only host tools are Docker
Desktop, Git Bash and `gh` (signed in).

## Cost

| Running | Approx. US$ |
| --- | --- |
| One review day (AKS B2s node, load balancer + IP, MySQL B1ms, ACR Basic, storage) | ~2.5 / day |
| Between reviews (`mdit-tfstate` only) | cents / month |

Estimates; check *Cost Management* in the portal after a review.

## First-time setup (once)

1. Sign in: `scripts/azure.sh login` (enter the code at the address it prints, with the college
   account). The sign-in is kept in the Docker volume `mdit-azure`.
2. `cp infra/azure.example.env infra/azure.env` and fill in `SUBSCRIPTION_ID` (git-ignored).
3. `infra/bootstrap.sh` creates `mdit-tfstate` (Terraform's state) and saves its name in
   `infra/azure.env`.
4. GitHub environment `prod` with yourself as required reviewer (deploys wait for your approval):
   ```sh
   gh api -X PUT repos/<owner>/md.IT/environments/prod \
     -F 'reviewers[][type]=User' -F "reviewers[][id]=$(gh api user --jq .id)"
   ```
5. OAuth apps (optional, for sign-in): callback URLs
   `https://mdit.centralindia.cloudapp.azure.com/api/auth/callback/github` and
   `.../callback/google`; put the IDs and secrets in `infra/azure.env`.

## Before a review

Do it a day or two ahead, not on the morning of the review.

```sh
scripts/azure.sh up       # ~25–30 min from nothing; deploys the commit you have checked out
scripts/azure.sh smoke    # routing, headers, limits, redirect, certificate
```

Trial runs: keep `ACME_ISSUER=staging` (browsers warn; no limit). For the review set
`ACME_ISSUER=prod` and run `up` again — Let's Encrypt allows about 5 certificates a week for the
same name.

Each `up` starts with an **empty** database and blob store (sign in and save live). Projects in
your browser are local and unaffected.

`up` refuses uncommitted changes (the images are tagged with the commit). Re-running `up` is
safe; it also applies changed OAuth values and restarts the backend.

While it's up, a merge to `main` that touches the app or `k8s/` deploys automatically
(`.github/workflows/deploy.yml`) after you approve it in GitHub. Rollback: re-run that workflow
for an earlier commit.

## After the review

```sh
scripts/azure.sh down     # asks you to type mdit; --yes skips the question
```

It turns off CI deploys, destroys `mdit-rg` (and AKS's `MC_mdit-rg_*` group), and lists
anything named `mdit-*` that is still there. Only `mdit-tfstate` should stay.

`scripts/azure.sh status` shows whether anything exists.

## If something goes wrong

- *"the address … is taken"*: someone took the `mdit` label between reviews. Change the label in
  `k8s/overlays/aks/kustomization.yaml` (`PUBLIC_BASE_URL`) and `envoyproxy.yaml`, and the
  OAuth callback URLs.
- *"not signed in to Azure"*: `scripts/azure.sh login`.
- A failed `up` can be re-run; a failed `down` too. Terraform's log is in `infra/.kube/terraform.log`.

## What's where

- `infra/terraform/` — resource group `mdit-rg`: ACR, AKS, MySQL Flexible Server, Storage.
  No role assignments (the account is Contributor, P-116).
- `k8s/overlays/aks/` — HTTPS, Azure settings, the registry pull secret.
- `scripts/k8s_deploy.sh` — the deploy order, used by `up` and by `deploy.yml`.
- `scripts/azure.sh` — creates cluster secrets from Terraform outputs and `infra/azure.env`, and
  stores CI's credentials (a token limited to namespace `mdit`, ACR push) as `prod` environment
  secrets.
