# Shared by scripts/azure.sh and infra/bootstrap.sh (Phase 7). Source it; don't run it.
# Every Azure, Terraform and kubectl call runs in the tools image (infra/tools/Dockerfile),
# so the host needs only Docker, Git Bash and gh.
# shellcheck shell=sh

AZ_ROOT=$(cd "$(dirname -- "${0:-.}")" 2>/dev/null || exit 0; git rev-parse --show-toplevel 2>/dev/null)
[ -n "$AZ_ROOT" ] || AZ_ROOT=$(pwd)
MDIT_AZURE_ENV=${MDIT_AZURE_ENV:-$AZ_ROOT/infra/azure.env}
MDIT_AKS_OVERLAY=${MDIT_AKS_OVERLAY:-$AZ_ROOT/k8s/overlays/aks}
MDIT_AZ_VOLUME=${MDIT_AZ_VOLUME:-mdit-azure}

say() { printf '\n== %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# Docker on Windows wants a Windows path for the bind mount.
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

# Tagged with the Dockerfile's hash, so editing the Dockerfile rebuilds the image.
tools_image() {
  printf 'mdit-tools:%s' "$(sha256sum "$AZ_ROOT/infra/tools/Dockerfile" | cut -c1-12)"
}

ensure_tools_image() {
  docker image inspect "$(tools_image)" >/dev/null 2>&1 && return 0
  say "Building the tools image (Azure CLI, Terraform, kubectl)"
  docker build -q -t "$(tools_image)" "$(host_path "$AZ_ROOT/infra/tools")" >/dev/null ||
    die "building infra/tools/Dockerfile failed"
}

# tools <command...>: run in the tools image with the Azure sign-in volume and the repo at /work.
# No TTY: its CRLF line endings would corrupt output that is piped on (YAML, values).
tools() {
  MSYS_NO_PATHCONV=1 docker run --rm -i \
    -v "$MDIT_AZ_VOLUME:/root/.azure" \
    -v "$(host_path "$AZ_ROOT"):/work" -w /work \
    -e KUBECONFIG=/work/infra/.kube/config \
    -e ARM_SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-}" \
    -e TF_VAR_subscription_id="${SUBSCRIPTION_ID:-}" \
    -e TF_IN_AUTOMATION=1 \
    "$(tools_image)" "$@"
}

load_config() {
  [ -f "$MDIT_AZURE_ENV" ] ||
    die "$MDIT_AZURE_ENV is missing: copy infra/azure.example.env to infra/azure.env and fill it in"
  # shellcheck disable=SC1090
  . "$MDIT_AZURE_ENV"
  [ -n "${SUBSCRIPTION_ID:-}" ] || die "SUBSCRIPTION_ID is empty in $MDIT_AZURE_ENV"
  case "${ACME_ISSUER:-}" in
    staging | prod) ;;
    *) die "ACME_ISSUER must be staging or prod in $MDIT_AZURE_ENV (is '${ACME_ISSUER:-}')" ;;
  esac
}

# Fails fast with the fix, before Terraform could print a stack trace.
preflight() {
  docker info >/dev/null 2>&1 || die "Docker isn't running: start Docker Desktop and try again"
  ensure_tools_image
  # get-access-token, not `account show`: only a token request notices an expired sign-in.
  tools az account get-access-token --output none >/dev/null 2>&1 ||
    die "not signed in to Azure (or the sign-in expired): run scripts/azure.sh login"
  if [ -n "${SUBSCRIPTION_ID:-}" ]; then
    tools az account set --subscription "$SUBSCRIPTION_ID" >/dev/null 2>&1 ||
      die "can't select subscription $SUBSCRIPTION_ID with this sign-in"
  fi
}

# The address is defined once, in the AKS overlay (P-120).
site_url() {
  sed -n 's/.*PUBLIC_BASE_URL=\(https:\/\/[^[:space:]"]*\).*/\1/p' "$MDIT_AKS_OVERLAY/kustomization.yaml" | head -n 1
}
site_host() { site_url | sed 's#^https://##'; }
site_label() { site_host | cut -d. -f1; }
