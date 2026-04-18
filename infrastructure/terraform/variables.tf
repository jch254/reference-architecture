variable "region" {
  description = "AWS region to deploy to"
  type        = string
}

variable "name" {
  description = "Name of project (used in AWS resource names)"
  type        = string
}

variable "environment" {
  description = "Environment (e.g. prod)"
  type        = string
  default     = "prod"
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

variable "notification_email" {
  description = "Email address for CodeBuild build notifications (must be confirmed after first apply)"
  type        = string
}

variable "resend_from_email" {
  description = "From address used when sending transactional emails via Resend"
  type        = string
}
