#!/bin/sh
# md.IT on Docker Desktop's Kubernetes (Phase 6). See k8s/README.md.
#
#   scripts/k8s_local.sh up      install Envoy Gateway if needed, build, deploy, migrate
#   scripts/k8s_local.sh smoke   check routing, headers, readiness, limits at http://localhost
#   scripts/k8s_local.sh down    delete the md.IT namespace, including its database and blobs
set -eu

ENVOY_GATEWAY_VERSION=v1.9.3
CONTEXT=docker-desktop
NS=mdit
# `smoke` can check another deployment: MDIT_BASE_URL=https://... (scripts/azure.sh smoke).
BASE_URL=${MDIT_BASE_URL:-http://localhost}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OVERLAY="$ROOT/k8s/overlays/local"
KUBE_CONTEXT=$CONTEXT

k() { kubectl --context "$CONTEXT" "$@"; }
say() { printf '\n== %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
# wait_for_job, shared with scripts/k8s_deploy.sh.
. "$ROOT/scripts/lib/k8s.sh"

check_cluster() {
  kubectl config get-contexts -o name 2>/dev/null | grep -qx "$CONTEXT" \
    || die "no '$CONTEXT' context. Docker Desktop -> Settings -> Kubernetes -> Enable Kubernetes (kubeadm), Apply & restart."
  # Not `get --raw /version`: Git Bash on Windows rewrites a lone /path argument.
  k get namespace kube-system >/dev/null 2>&1 \
    || die "the $CONTEXT cluster isn't answering. Is Docker Desktop running with Kubernetes on?"
}

install_envoy_gateway() {
  current=$(k -n envoy-gateway-system get deployment envoy-gateway \
    -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)
  case "$current" in
    *":$ENVOY_GATEWAY_VERSION") echo "Envoy Gateway $ENVOY_GATEWAY_VERSION already installed" ;;
    *)
      say "Installing Envoy Gateway $ENVOY_GATEWAY_VERSION"
      k apply --server-side --force-conflicts \
        -f "https://github.com/envoyproxy/gateway/releases/download/$ENVOY_GATEWAY_VERSION/install.yaml" >/dev/null
      ;;
  esac
  k -n envoy-gateway-system wait --for=condition=Available deployment/envoy-gateway --timeout=300s >/dev/null
  k apply -f "$ROOT/k8s/cluster/" >/dev/null
}

random_secret() {
  head -c 48 /dev/urandom | base64 | tr -d '/+=\n' | cut -c1-48
}

ensure_secret_file() {
  if [ ! -f "$OVERLAY/secret.env" ]; then
    say "Creating k8s/overlays/local/secret.env (git-ignored) with fresh random values"
    sed -e "s/^DB_PASSWORD=CHANGE_ME\$/DB_PASSWORD=$(random_secret)/" \
        -e "s/^SESSION_SECRET=CHANGE_ME\$/SESSION_SECRET=$(random_secret)/" \
        "$OVERLAY/secret.example.env" > "$OVERLAY/secret.env"
  fi
  if grep -q '=CHANGE_ME$' "$OVERLAY/secret.env"; then
    die "k8s/overlays/local/secret.env still has CHANGE_ME values"
  fi
}

not_reachable() {
  k -n "$NS" get pods >&2 || true
  die "$BASE_URL/api/health/ready isn't 200 after 60 s. If the pods above are Running, port 80 may belong to another server (IIS, Skype...): 'netstat -ano | findstr :80'"
}

up() {
  check_cluster
  install_envoy_gateway
  ensure_secret_file

  say "Building images"
  # One at a time: building both at once next to the cluster crashed Docker Desktop's WSL
  # engine twice on an 8 GB VM.
  (cd "$ROOT" && docker compose build backend && docker compose build frontend)

  say "Applying k8s/overlays/local"
  # Jobs can't be changed once created; a new one runs the migrations of the new image.
  # Foreground: the old Job's pod is gone too, so two migrations never overlap (P-051).
  k -n "$NS" delete job mdit-migrate --ignore-not-found --cascade=foreground --wait >/dev/null 2>&1 || true
  k apply -k "$OVERLAY"
  # A dev login turned on by hand for api_smoke.py (k8s/README.md) isn't in the manifests, so
  # apply keeps it; take it off here (P-058).
  if k -n "$NS" get deployment backend -o jsonpath='{.spec.template.spec.containers[0].env[*].name}' | grep -qw DEV_LOGIN; then
    say "Removing DEV_LOGIN left on the backend by hand"
    k -n "$NS" set env deployment/backend DEV_LOGIN- >/dev/null
  fi

  say "Waiting for migrations (retries while MySQL starts; ~1-2 min the first time)"
  wait_for_job "$NS" mdit-migrate

  say "Rolling out backend and frontend"
  # The local tag never changes, so restart to pick up a rebuilt image.
  k -n "$NS" rollout restart deployment/backend deployment/frontend >/dev/null
  k -n "$NS" rollout status deployment/backend --timeout=300s
  k -n "$NS" rollout status deployment/frontend --timeout=300s

  say "Waiting for the gateway at $BASE_URL"
  if ! k -n "$NS" wait --for=condition=Programmed gateway/mdit --timeout=120s >/dev/null 2>&1; then
    die "the gateway got no address. Is port 80 on this machine taken (IIS, Skype, another server)? 'netstat -ano | findstr :80'"
  fi
  i=0
  until [ "$(status "$BASE_URL/api/health/ready")" = "200" ]; do
    i=$((i + 1))
    [ $i -lt 30 ] || not_reachable
    sleep 2
  done
  say "md.IT is running at $BASE_URL"
}

check() {
  # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then
    printf 'ok    %s\n' "$1"
  else
    printf 'FAIL  %s: expected %s, got %s\n' "$1" "$2" "$3" >&2
    exit 1
  fi
}

# A time limit, so a server that accepts but never answers can't hang the script.
# MDIT_CURL_OPTS: e.g. -k for a staging certificate (scripts/azure.sh smoke).
# shellcheck disable=SC2086
status() { curl -s ${MDIT_CURL_OPTS:-} --max-time 10 -o /dev/null -w '%{http_code}' "$@" || true; }

smoke() {
  check "landing page" 200 "$(status "$BASE_URL/")"
  # shellcheck disable=SC2086
  csp=$(curl -sI ${MDIT_CURL_OPTS:-} --max-time 10 "$BASE_URL/" | grep -ci '^content-security-policy:' || true)
  check "frontend's CSP header passes through" 1 "$csp"
  check "SPA deep link" 200 "$(status "$BASE_URL/projects")"
  check "liveness" 200 "$(status "$BASE_URL/api/health")"
  check "readiness" 200 "$(status "$BASE_URL/api/health/ready")"
  check "anonymous /api/me" 401 "$(status "$BASE_URL/api/me")"
  check "dev login is off" 404 "$(status "$BASE_URL/api/auth/login/dev?name=smoke")"

  hash=$(printf '%064d' 0)
  big=$(head -c 7000000 /dev/zero | status -X PUT -H 'Content-Type: image/png' \
    -H 'X-MdIt-CSRF: 1' --data-binary @- "$BASE_URL/api/blobs/$hash")
  check "7 MB upload refused at the edge" 413 "$big"

  # Uses up this minute's sign-in allowance for this machine; wait a minute before signing in.
  limited=no
  n=0
  while [ $n -lt 40 ]; do
    if [ "$(status "$BASE_URL/api/auth/login/github")" = "429" ]; then limited=yes; break; fi
    n=$((n + 1))
  done
  check "sign-in is rate-limited" yes "$limited"
  printf '\nAll checks passed.\n'
}

down() {
  check_cluster
  say "Deleting namespace $NS (its MySQL and Azurite volumes go with it)"
  k delete namespace "$NS" --ignore-not-found --wait
}

case "${1:-}" in
  up) up ;;
  smoke) smoke ;;
  down) down ;;
  *) echo "usage: $0 up | smoke | down" >&2; exit 2 ;;
esac
