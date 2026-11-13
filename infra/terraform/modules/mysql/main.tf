# Burstable B1ms, MySQL 8.4 like Compose and the local cluster (offered in centralindia,
# checked 2026-11-13). Azure requires TLS by default; the backend sets DB_SSL=true (P-114).
# The app and migrations use the admin login `mdit` (spec: review-only, thrown-away data).
variable "admin_password" {
  type      = string
  sensitive = true
}

variable "allowed_ip" {
  description = "The AKS cluster's outbound IP; the only address the firewall lets in."
  type        = string
}

resource "azurerm_mysql_flexible_server" "this" {
  name                   = var.name
  resource_group_name    = var.resource_group_name
  location               = var.location
  version                = "8.4"
  sku_name               = "B_Standard_B1ms"
  administrator_login    = "mdit"
  administrator_password = var.admin_password
  backup_retention_days  = 1
  public_network_access  = "Enabled"
  tags                   = var.tags

  storage {
    size_gb = 20
  }

  lifecycle {
    # Azure picks the zone when none is given; don't fight it on later applies.
    ignore_changes = [zone]
  }
}

resource "azurerm_mysql_flexible_database" "mdit" {
  name                = "mdit"
  resource_group_name = var.resource_group_name
  server_name         = azurerm_mysql_flexible_server.this.name
  charset             = "utf8mb4"
  collation           = "utf8mb4_0900_ai_ci"
}

resource "azurerm_mysql_flexible_server_firewall_rule" "aks" {
  name                = "aks-outbound"
  resource_group_name = var.resource_group_name
  server_name         = azurerm_mysql_flexible_server.this.name
  start_ip_address    = var.allowed_ip
  end_ip_address      = var.allowed_ip
}

output "fqdn" {
  value = azurerm_mysql_flexible_server.this.fqdn
}
