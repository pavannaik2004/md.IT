#!/bin/sh
# Final-review findings I1/I2 (Phase 7): Azure CLI failures must never read as "nothing there",
# and a failed destroy must still report leftovers. `tools` and `gh` are replaced by fakes, so
# nothing reaches Azure or GitHub.
set -u
cd "$(dirname "$0")/../.." || exit 1
fails=0

# run <snippet>: source azure.sh without running a command, with fakes, then run the snippet.
# FAKE_FAIL lists `tools` argument prefixes that fail; FAKE_OUT_<n> prints canned output.
run() {
  sh -c '
    MDIT_SOURCE_ONLY=1 . scripts/azure.sh
    gh() { :; }
    repo() { echo owner/repo; }
    load_config() { SUBSCRIPTION_ID=x; ACME_ISSUER=staging; TFSTATE_ACCOUNT=state; }
    docker() { :; }
    ensure_tools_image() { :; }
    tools() {
      for f in $FAKE_FAIL; do case "$*" in "$(echo "$f" | tr _ " ")"*) return 1 ;; esac; done
      case "$*" in
        "az group list"*) printf "%s\r\n" $FAKE_GROUPS ;;
        "az group exists"*) printf "true\r\n" ;;
      esac
      return 0
    }
    '"$1" 2>&1
}

expect() { # expect <name> <expected exit> <must contain> <must not contain> <snippet>
  out=$(run "$5"); rc=$?
  ok=1
  [ "$rc" = "$2" ] || ok=0
  case "$out" in *"$3"*) ;; *) ok=0 ;; esac
  if [ -n "$4" ]; then case "$out" in *"$4"*) ok=0 ;; esac; fi
  if [ $ok = 1 ]; then echo "ok   $1"; else echo "FAIL $1 (exit $rc): $(printf '%s' "$out" | tail -3)"; fails=$((fails + 1)); fi
}

export FAKE_GROUPS=""
FAKE_FAIL="az_account_get-access-token" expect "expired token stops preflight with the login hint" \
  1 "scripts/azure.sh login" "" "preflight"
FAKE_FAIL="az_group_exists" expect "status: a failed az call is not 'not deployed'" \
  1 "scripts/azure.sh login" "not deployed" "status"
FAKE_FAIL="az_group_exists az_rest" expect "up's label check: a failed az call is not 'address taken'" \
  1 "scripts/azure.sh login" "is taken" "load_config; check_label"
FAKE_FAIL="az_group_list" expect "down: a failed leftover query is not 'nothing left'" \
  1 "scripts/azure.sh login" "Nothing of md.IT is left" "down --yes"
FAKE_GROUPS="mdit-rg mdit-tfstate" FAKE_FAIL="terraform_-chdir=infra/terraform_destroy" \
  expect "down: a failed destroy still lists what is left, then fails" 1 "mdit-rg" "Nothing of md.IT is left" "down --yes"
FAKE_GROUPS="mdit-tfstate" FAKE_FAIL="" expect "down: a clean destroy reports nothing left" \
  0 "Nothing of md.IT is left" "" "down --yes"

if [ $fails -ne 0 ]; then echo "$fails failed"; exit 1; fi
echo "all passed"
