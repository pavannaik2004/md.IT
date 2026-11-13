#!/bin/sh
# Guard tests for scripts/azure.sh: they stop before anything is created (no cost).
set -u
cd "$(dirname "$0")/../.." || exit 1
TMP=$(mktemp -d)
trap 'rm -rf "$TMP" backend/zz_azure_sh_test' EXIT
fails=0

expect() { # expect <name> <expected exit> <expected text> <command...>
  name=$1 code=$2 text=$3
  shift 3
  out=$("$@" 2>&1)
  rc=$?
  if [ "$rc" = "$code" ] && case "$out" in *"$text"*) true ;; *) false ;; esac; then
    echo "ok   $name"
  else
    echo "FAIL $name (exit $rc): $(printf '%s' "$out" | tail -3)"
    fails=$((fails + 1))
  fi
}

expect "unknown command prints usage" 2 "usage:" sh scripts/azure.sh nonsense

printf 'SUBSCRIPTION_ID=x\nACME_ISSUER=staging\nTFSTATE_ACCOUNT=\n' > "$TMP/no-state.env"
expect "up without bootstrap names infra/bootstrap.sh" 1 "infra/bootstrap.sh" \
  env MDIT_AZURE_ENV="$TMP/no-state.env" sh scripts/azure.sh up

: > backend/zz_azure_sh_test
expect "up refuses files that would go into an image uncommitted" 1 "uncommitted" sh scripts/azure.sh up
rm -f backend/zz_azure_sh_test

expect "down without --yes and no answer does nothing" 1 "cancelled" sh -c 'echo no | sh scripts/azure.sh down'

if [ $fails -ne 0 ]; then echo "$fails failed"; exit 1; fi
echo "all passed"
