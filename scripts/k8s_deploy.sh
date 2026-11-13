#!/bin/sh
# The one deploy order (Phase 6's `up`, P-051), shared by scripts/azure.sh up and
# .github/workflows/deploy.yml:
#
#   scripts/k8s_deploy.sh <overlay-dir> <registry-or-empty> <tag>
#
# Uses the ambient kubectl configuration (KUBECONFIG; KUBE_CONTEXT picks a context) and
# namespace mdit. Images become <registry>/mdit-backend:<tag> and <registry>/mdit-frontend:<tag>
# (just mdit-*:<tag> when the registry is empty).
set -eu
cd "$(dirname "$0")/.."
NS=mdit
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }
. scripts/lib/k8s.sh

[ $# -eq 3 ] || die "usage: $0 <overlay-dir> <registry-or-empty> <tag>"
overlay=${1%/}
registry=$2
tag=$3
[ -f "$overlay/kustomization.yaml" ] || die "$overlay has no kustomization.yaml"
case "$tag" in "" | latest | set-by-deploy) die "refusing to deploy tag '$tag' (PRD 11)" ;; esac

# A throwaway kustomization on top of the overlay sets the images (kubectl has no
# `kustomize edit`). Inside the repo, so the overlay's relative paths still load.
mkdir -p k8s/.deploy
{
  echo "# Written by scripts/k8s_deploy.sh; git-ignored."
  echo "apiVersion: kustomize.config.k8s.io/v1beta1"
  echo "kind: Kustomization"
  echo "resources:"
  echo "  - ../${overlay#k8s/}"
  echo "images:"
  for name in mdit-backend mdit-frontend; do
    echo "  - name: $name"
    [ -z "$registry" ] || echo "    newName: $registry/$name"
    echo "    newTag: \"$tag\""
  done
} > k8s/.deploy/kustomization.yaml

say "Deploying $overlay with tag $tag"
# Jobs can't be changed once created; a new one runs the migrations of the new image.
# Foreground: the old Job's pod is gone too, so two migrations never overlap (P-051).
kube -n "$NS" delete job mdit-migrate --ignore-not-found --cascade=foreground --wait >/dev/null
kube apply -k k8s/.deploy

say "Waiting for migrations"
wait_for_job "$NS" mdit-migrate

say "Rolling out backend and frontend"
kube -n "$NS" rollout status deployment/backend --timeout=300s
kube -n "$NS" rollout status deployment/frontend --timeout=300s

# Every config change leaves a hash-suffixed mdit-config-* behind; keep only those in use.
in_use=$(kube -n "$NS" get deployments,jobs \
  -o jsonpath='{range .items[*]}{range .spec.template.spec.containers[*]}{range .envFrom[*]}{.configMapRef.name}{"\n"}{end}{end}{end}')
for cm in $(kube -n "$NS" get configmaps -o name | sed -n 's#^configmap/\(mdit-config-.*\)#\1#p'); do
  if ! printf '%s\n' "$in_use" | grep -qx "$cm"; then
    kube -n "$NS" delete configmap "$cm" >/dev/null && echo "removed old ConfigMap $cm"
  fi
done
say "Deployed $tag"
