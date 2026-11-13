# Everything billed lives in mdit-rg, so `terraform destroy` removes it in one go (P-119).
locals {
  tags = { project = "mdit" }
}

resource "azurerm_resource_group" "mdit" {
  name     = "${var.prefix}-rg"
  location = var.location
  tags     = local.tags
}

# Registry, storage and MySQL names are global across Azure.
resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "random_password" "mysql" {
  length  = 32
  special = false
}

module "acr" {
  source              = "./modules/acr"
  name                = "${var.prefix}acr${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.mdit.name
  location            = var.location
  tags                = local.tags
}

module "aks" {
  source              = "./modules/aks"
  name                = "${var.prefix}-aks"
  resource_group_name = azurerm_resource_group.mdit.name
  location            = var.location
  tags                = local.tags
}

module "mysql" {
  source              = "./modules/mysql"
  name                = "${var.prefix}-mysql-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.mdit.name
  location            = var.location
  tags                = local.tags
  admin_password      = random_password.mysql.result
  allowed_ip          = module.aks.outbound_ip
}

module "storage" {
  source              = "./modules/storage"
  name                = "${var.prefix}blob${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.mdit.name
  location            = var.location
  tags                = local.tags
}
