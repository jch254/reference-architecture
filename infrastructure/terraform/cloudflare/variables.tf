variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Cloudflare zone name"
  type        = string
}

variable "aws_region" {
  description = "AWS region (used for remote state data source)"
  type        = string
}

variable "aws_state_bucket" {
  description = "S3 bucket for AWS infrastructure remote state"
  type        = string
}

variable "aws_state_key" {
  description = "S3 key for AWS infrastructure remote state"
  type        = string
}

variable "subdomain" {
  description = "Subdomain to create under the zone (e.g. reference-architecture)"
  type        = string
}
