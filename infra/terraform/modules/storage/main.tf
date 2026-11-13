# Blob storage for images in saved versions; the backend creates its container itself.
resource "azurerm_storage_account" "this" {
  name                             = var.name
  resource_group_name              = var.resource_group_name
  location                         = var.location
  account_tier                     = "Standard"
  account_replication_type         = "LRS"
  min_tls_version                  = "TLS1_2"
  allow_nested_items_to_be_public  = false
  cross_tenant_replication_enabled = false
  tags                             = var.tags
}

output "connection_string" {
  value     = azurerm_storage_account.this.primary_blob_connection_string
  sensitive = true
}
