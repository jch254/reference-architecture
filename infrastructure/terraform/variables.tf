variable "region" {
  description = "AWS region to deploy to"
  type        = string
}

variable "name" {
  description = "Deployment name used in AWS resource names. Include the product/environment boundary here (for example product-prod or product-test); the DynamoDB table is derived from this name."
  type        = string
}

variable "environment" {
  description = "Environment tag for this deployment (e.g. prod). Physical isolation still comes from the deployment/table identity, not tenant resolution mode."
  type        = string
  default     = "prod"
}

variable "tenant_resolution_mode" {
  description = "Runtime tenant resolution strategy: fixed resolves every request to app_tenant_id, subdomain resolves from Host. This does not choose the DynamoDB table."
  type        = string
  default     = "subdomain"

  validation {
    condition     = contains(["fixed", "subdomain"], var.tenant_resolution_mode)
    error_message = "tenant_resolution_mode must be either fixed or subdomain."
  }
}

variable "app_tenant_id" {
  description = "Fixed runtime tenant id for this deployed app/environment. Required when tenant_resolution_mode is fixed; not a substitute for a deployment-specific DynamoDB table."
  type        = string
  default     = null

  validation {
    condition     = var.app_tenant_id == null || length(trimspace(var.app_tenant_id)) > 0
    error_message = "app_tenant_id must be null or a non-empty string."
  }
}

variable "vpc_id" {
  description = "ID of existing VPC to use"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "build_docker_image" {
  description = "Docker image to use as CodeBuild build environment"
  type        = string
}

variable "build_docker_tag" {
  description = "Docker image tag to use as CodeBuild build environment"
  type        = string
}

variable "source_type" {
  description = "Type of repository that contains the source code"
  type        = string
  default     = "GITHUB"
}

variable "source_location" {
  description = "Location of the source code repository"
  type        = string
}

variable "buildspec" {
  description = "Path to the buildspec file"
  type        = string
  default     = "buildspec.yml"
}

variable "cache_bucket" {
  description = "S3 bucket/prefix for CodeBuild cache"
  type        = string
}

variable "build_compute_type" {
  description = "CodeBuild compute type"
  type        = string
  default     = "BUILD_GENERAL1_SMALL"
}

variable "build_notifier_region" {
  description = "AWS region where shared-platform deploys the build notification formatter Lambda. Defaults to region."
  type        = string
  default     = null
}

variable "build_notifier_lambda_function_name" {
  description = "Name of the shared-platform build notification formatter Lambda."
  type        = string
  default     = "shared-platform-build-notification-formatter"
}

variable "container_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Fargate task memory (MB)"
  type        = number
  default     = 512
}

variable "cloudflare_domain" {
  description = "Cloudflare zone name (e.g. 603.nz)"
  type        = string
}

variable "cloudflare_subdomain" {
  description = "Subdomain for the application (e.g. reference-architecture)"
  type        = string
}

variable "dns_name" {
  description = "Full domain name for the application (e.g. reference-architecture.603.nz)"
  type        = string
}

variable "resend_from_email" {
  description = "From address used when sending transactional emails via Resend"
  type        = string
}
