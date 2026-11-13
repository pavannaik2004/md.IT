#!/bin/sh
# One-time setup for Phase 7: the storage that holds Terraform's state. It lives in its own
# resource group, mdit-tfstate, which scripts/azure.sh down never touches (P-119).
# Safe to re-run: when infra/azure.env already names an existing account, it does nothing.
set -eu
cd "$(dirname "$0")/.."
. scripts/lib/azure_tools.sh

STATE_RG=mdit-tfstate
LOCATION=centralindia

load_config
preflight

if [ -n "${TFSTATE_ACCOUNT:-}" ] &&
  tools az storage account show -g "$STATE_RG" -n "$TFSTATE_ACCOUNT" --output none >/dev/null 2>&1; then
  echo "already bootstrapped: $STATE_RG/$TFSTATE_ACCOUNT"
  exit 0
fi

account="mdittfstate$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n')"

say "Creating $STATE_RG/$account in $LOCATION"
tools az group create -n "$STATE_RG" -l "$LOCATION" --tags project=mdit --output none
tools az storage account create -g "$STATE_RG" -n "$account" -l "$LOCATION" \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
  --allow-blob-public-access false --tags project=mdit --output none
# Versioning keeps earlier copies of the state file if one is ever overwritten by mistake.
tools az storage account blob-service-properties update -g "$STATE_RG" -n "$account" \
  --enable-versioning true --output none
key=$(tools az storage account keys list -g "$STATE_RG" -n "$account" --query '[0].value' -o tsv | tr -d '\r')
tools az storage container create --account-name "$account" --account-key "$key" -n tfstate --output none

# Record the name for Terraform's backend (infra/azure.env is git-ignored).
sed -i "s/^TFSTATE_ACCOUNT=.*/TFSTATE_ACCOUNT=$account/" "$MDIT_AZURE_ENV"
echo "bootstrapped: $STATE_RG/$account (saved to infra/azure.env)"
