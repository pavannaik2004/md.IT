# Basic tier with the admin user: its credentials are the push (CI) and pull (cluster)
# credentials, because a Contributor can't give AKS the AcrPull role (P-116).
resource "azurerm_container_registry" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = var.tags
}

output "login_server" {
  value = azurerm_container_registry.this.login_server
}

output "username" {
  value = azurerm_container_registry.this.admin_username
}

output "password" {
  value     = azurerm_container_registry.this.admin_password
  sensitive = true
}
