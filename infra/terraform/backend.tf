# State lives in the storage account infra/bootstrap.sh created (resource group mdit-tfstate,
# which `scripts/azure.sh down` never destroys). The account name is passed at init:
#   terraform init -backend-config=storage_account_name=$TFSTATE_ACCOUNT
terraform {
  backend "azurerm" {
    resource_group_name = "mdit-tfstate"
    container_name      = "tfstate"
    key                 = "mdit.tfstate"
  }
}
