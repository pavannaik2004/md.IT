# Shared by scripts/k8s_local.sh and scripts/k8s_deploy.sh. Source it; don't run it.
# Callers define die(). KUBE_CONTEXT, when set, picks the kubectl context.
# shellcheck shell=sh

kube() {
  if [ -n "${KUBE_CONTEXT:-}" ]; then kubectl --context "$KUBE_CONTEXT" "$@"; else kubectl "$@"; fi
}

# wait_for_job <namespace> <job>: until it succeeds; dies with its logs when it fails.
wait_for_job() {
  # kubectl wait can't wait for "complete or failed", so poll both.
  i=0
  while [ $i -lt 200 ]; do
    succeeded=$(kube -n "$1" get job "$2" -o jsonpath='{.status.succeeded}' 2>/dev/null || true)
    failed=$(kube -n "$1" get job "$2" \
      -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null || true)
    [ "$succeeded" = "1" ] && return 0
    if [ "$failed" = "True" ]; then
      kube -n "$1" logs "job/$2" --tail=30 >&2 || true
      die "the migration Job failed (logs above)"
    fi
    i=$((i + 1))
    # Every ~30 s, show what the pod is doing (Pending, ImagePullBackOff, Error and retrying...).
    if [ $((i % 10)) -eq 0 ]; then
      kube -n "$1" get pods -l app.kubernetes.io/name=migrate --no-headers 2>/dev/null || true
    fi
    sleep 3
  done
  die "the migration Job didn't finish in 10 minutes"
}
