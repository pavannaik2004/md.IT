#!/bin/sh
# Tests scripts/k8s_deploy.sh on Docker Desktop's cluster (no Azure). Needs the local deployment
# from `scripts/k8s_local.sh up`.
set -eu
cd "$(dirname "$0")/../.."
CTX=docker-desktop
k() { kubectl --context "$CTX" -n mdit "$@"; }
fail() { echo "FAIL $*"; exit 1; }

KUBE_CONTEXT=$CTX sh scripts/k8s_deploy.sh k8s/overlays/local "" local || fail "first deploy"
[ "$(k get job mdit-migrate -o jsonpath='{.status.succeeded}')" = 1 ] || fail "migration Job didn't succeed"
echo "ok   deploy runs the migration Job and rolls out"

in_use=$(k get deployment backend -o jsonpath='{.spec.template.spec.containers[0].envFrom[0].configMapRef.name}')
k create configmap mdit-config-stale0000 --from-literal=X=1 >/dev/null
k label configmap mdit-config-stale0000 app.kubernetes.io/part-of=mdit >/dev/null
KUBE_CONTEXT=$CTX sh scripts/k8s_deploy.sh k8s/overlays/local "" local >/dev/null || fail "second deploy"
k get configmap mdit-config-stale0000 >/dev/null 2>&1 && fail "stale mdit-config ConfigMap kept"
k get configmap "$in_use" >/dev/null 2>&1 || fail "in-use ConfigMap $in_use deleted"
echo "ok   old mdit-config ConfigMaps are removed, the one in use stays"
echo "all passed"
