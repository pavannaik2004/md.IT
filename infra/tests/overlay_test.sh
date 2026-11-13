#!/bin/sh
# Renders k8s/overlays/aks in the tools image and checks it against the spec (no Azure).
set -eu
cd "$(dirname "$0")/../.."
. scripts/lib/azure_tools.sh
ensure_tools_image
tools sh -c 'kubectl kustomize k8s/overlays/aks > /tmp/aks.yaml && python3 scripts/check_aks_overlay.py /tmp/aks.yaml'
