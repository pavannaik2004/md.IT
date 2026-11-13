# One small node for review-day demos (P-118, P-119). AKS-managed network: a custom subnet
# would need a role assignment for the cluster identity, which a Contributor can't create.
resource "azurerm_kubernetes_cluster" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  dns_prefix          = var.name
  node_resource_group = "MC_${var.resource_group_name}_${var.name}_${var.location}"
  kubernetes_version  = "1.36"
  sku_tier            = "Free"
  # Local accounts stay on: scripts/azure.sh reads the admin kubeconfig, and CI uses a
  # ServiceAccount token (no Entra sign-in from GitHub, P-116).
  local_account_disabled = false
  tags                   = var.tags

  default_node_pool {
    name    = "system"
    vm_size = "Standard_B2s"
    # B2s's 8 GB cache can't hold an ephemeral disk; 30 GB managed instead of the paid
    # 128 GB default.
    os_disk_size_gb = 30
    os_disk_type    = "Managed"
    node_count      = 1

    # Azure's defaults, written out: left unset, every apply tries to remove them again.
    upgrade_settings {
      max_surge = "10%"
    }
  }

  # Required block since azurerm 5. Manual: our one node pool, no node auto-provisioning
  # (it would add nodes, and cost, on its own).
  node_provisioning_profile {
    mode = "Manual"
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    load_balancer_sku   = "standard"
  }
}

# The outbound address the MySQL firewall allows.
locals {
  outbound_ip_id = one(azurerm_kubernetes_cluster.this.network_profile[0].load_balancer_profile[0].effective_outbound_ips)
}

data "azurerm_public_ip" "outbound" {
  name                = element(split("/", local.outbound_ip_id), 8)
  resource_group_name = element(split("/", local.outbound_ip_id), 4)
}

output "name" {
  value = azurerm_kubernetes_cluster.this.name
}

output "node_resource_group" {
  value = azurerm_kubernetes_cluster.this.node_resource_group
}

output "outbound_ip" {
  value = data.azurerm_public_ip.outbound.ip_address
}
