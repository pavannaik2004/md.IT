#!/bin/sh
# Tests for scripts/lib/azure_tools.sh guards (no Azure, no cost). Run: sh infra/tests/azure_tools_test.sh
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LIB="$ROOT/scripts/lib/azure_tools.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fails=0

# expect_fail <name> <expected text> <shell snippet run after sourcing the library>
expect_fail() {
  out=$(sh -c ". '$LIB'; $3" 2>&1) && { echo "FAIL $1: succeeded"; fails=$((fails + 1)); return; }
  case "$out" in
    *"$2"*) echo "ok   $1" ;;
    *) echo "FAIL $1: got: $out"; fails=$((fails + 1)) ;;
  esac
}
# expect_out <name> <expected stdout> <snippet>
expect_out() {
  out=$(sh -c ". '$LIB'; $3" 2>&1)
  if [ "$out" = "$2" ]; then echo "ok   $1"; else echo "FAIL $1: got: $out"; fails=$((fails + 1)); fi
}

expect_fail "missing config file names the example" "infra/azure.example.env" \
  "MDIT_AZURE_ENV='$TMP/none.env' load_config"

printf 'SUBSCRIPTION_ID=\nACME_ISSUER=staging\n' > "$TMP/a.env"
expect_fail "empty SUBSCRIPTION_ID is named" "SUBSCRIPTION_ID" "MDIT_AZURE_ENV='$TMP/a.env' load_config"

printf 'SUBSCRIPTION_ID=x\nACME_ISSUER=maybe\n' > "$TMP/b.env"
expect_fail "ACME_ISSUER must be staging or prod" "ACME_ISSUER" "MDIT_AZURE_ENV='$TMP/b.env' load_config"

expect_fail "Docker not running is named" "Docker" "DOCKER_HOST=tcp://127.0.0.1:1 preflight"

mkdir -p "$TMP/ov"
printf 'configMapGenerator:\n  - name: mdit-config\n    literals:\n      - PUBLIC_BASE_URL=https://mdit.centralindia.cloudapp.azure.com\n' > "$TMP/ov/kustomization.yaml"
expect_out "site_label reads the overlay" "mdit" "MDIT_AKS_OVERLAY='$TMP/ov' site_label"
expect_out "site_url reads the overlay" "https://mdit.centralindia.cloudapp.azure.com" "MDIT_AKS_OVERLAY='$TMP/ov' site_url"

if [ $fails -ne 0 ]; then echo "$fails failed"; exit 1; fi
echo "all passed"
