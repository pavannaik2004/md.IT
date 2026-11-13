#!/bin/sh
# Plans infra/terraform (no changes made, no cost) and checks the plan against the spec.
# Needs infra/azure.env, a bootstrapped state account and an Azure sign-in.
set -eu
cd "$(dirname "$0")/../.."
. scripts/lib/azure_tools.sh
load_config
preflight
tools terraform -chdir=infra/terraform init -input=false -no-color \
  -backend-config=storage_account_name="$TFSTATE_ACCOUNT" >/dev/null
tools sh -c '
  set -e
  trap "rm -f infra/terraform/.plan" EXIT
  terraform -chdir=infra/terraform plan -input=false -no-color -lock=false -out=.plan > /tmp/plan.txt ||
    { tail -30 /tmp/plan.txt; exit 1; }
  grep "^Plan:" /tmp/plan.txt || grep "No changes" /tmp/plan.txt
  terraform -chdir=infra/terraform show -json .plan > /tmp/plan.json
  python3 infra/tests/check_plan.py /tmp/plan.json'
