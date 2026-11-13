# Read by scripts/azure.sh; secrets never leave Terraform state, the cluster and GitHub Secrets.
output "resource_group" {
  value = azurerm_resource_group.mdit.name
}

output "aks_name" {
  value = module.aks.name
}

output "node_resource_group" {
  value = module.aks.node_resource_group
}

output "acr_login_server" {
  value = module.acr.login_server
}

output "acr_username" {
  value = module.acr.username
}

output "acr_password" {
  value     = module.acr.password
  sensitive = true
}

output "mysql_fqdn" {
  value = module.mysql.fqdn
}

output "db_password" {
  value     = random_password.mysql.result
  sensitive = true
}

output "blob_connection_string" {
  value     = module.storage.connection_string
  sensitive = true
}
