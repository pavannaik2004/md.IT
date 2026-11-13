terraform {
  required_version = "= 1.17.1"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.12.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "= 3.9.1"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      # mdit-rg holds only md.IT's resources; something Azure created that Terraform never
      # recorded (a timed-out create) must not block `down` (final review I2).
      prevent_deletion_if_contains_resources = false
    }
  }
  subscription_id = var.subscription_id
  # All providers are registered on the subscription already (checked 2026-11-13); don't
  # let Terraform try to register more with a Contributor role.
  resource_provider_registrations = "none"
}
