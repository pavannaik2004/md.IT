variable "subscription_id" {
  description = "The college subscription; scripts/azure.sh passes it from infra/azure.env."
  type        = string
}

variable "location" {
  description = "Azure region (P-118)."
  type        = string
  default     = "centralindia"
}

variable "prefix" {
  description = "Start of every resource name; scripts only act on groups named mdit-*."
  type        = string
  default     = "mdit"
}
