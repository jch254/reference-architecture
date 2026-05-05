provider "aws" {
  region = var.region
}

data "aws_vpc" "existing" {
  id = var.vpc_id
}

data "aws_caller_identity" "current" {}

locals {
  build_notifier_region              = coalesce(var.build_notifier_region, var.region)
  build_notifier_lambda_function_arn = "arn:aws:lambda:${local.build_notifier_region}:${data.aws_caller_identity.current.account_id}:function:${var.build_notifier_lambda_function_name}"
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  filter {
    name   = "map-public-ip-on-launch"
    values = ["true"]
  }
}

# ECR Repository
module "ecr_repository" {
  source = "git::https://github.com/jch254/terraform-modules.git//ecr-repository?ref=1.1.0"

  name = var.name

  tags = {
    Environment = var.environment
  }
}

# ECS HTTP runtime
module "ecs_http_service" {
  source = "github.com/jch254/terraform-modules//ecs-http-service?ref=1.9.0"

  name        = var.name
  environment = var.environment
  vpc_id      = data.aws_vpc.existing.id
  subnet_ids  = data.aws_subnets.public.ids

  image              = "${module.ecr_repository.repository_url}:${var.image_tag}"
  cpu                = var.container_cpu
  memory             = var.container_memory
  execution_role_arn = module.app_runtime_iam.execution_role_arn
  task_role_arn      = module.app_runtime_iam.task_role_arn

  container_port        = 3000
  host_port             = 3000
  create_log_group      = true
  log_group_name        = "/ecs/${var.name}"
  log_retention_in_days = 7
  log_region            = var.region
  log_stream_prefix     = "ecs"

  environment_variables = [
    {
      name  = "PORT"
      value = "3000"
    },
    {
      name  = "DYNAMODB_TABLE"
      value = module.dynamodb_single_table.table_name
    },
    {
      name  = "AWS_REGION"
      value = var.region
    },
    {
      name  = "BASE_DOMAIN"
      value = var.cloudflare_domain
    },
    {
      name  = "RESEND_FROM_EMAIL"
      value = var.resend_from_email
    }
  ]

  secrets = [
    {
      name      = "COOKIE_SECRET"
      valueFrom = aws_ssm_parameter.cookie_secret.arn
    },
    {
      name      = "RESEND_API_KEY"
      valueFrom = aws_ssm_parameter.resend_api_key.arn
    }
  ]

  health_check = {
    command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"]
    interval    = 15
    timeout     = 5
    retries     = 3
    startPeriod = 60
  }

  essential = true

  assign_public_ip                    = true
  desired_count                       = 1
  deployment_minimum_healthy_percent  = 100
  deployment_maximum_percent          = 200
  health_check_grace_period_seconds   = 60
  deployment_circuit_breaker_enable   = true
  deployment_circuit_breaker_rollback = true
  container_insights                  = "disabled"
  operating_system_family             = "LINUX"
  cpu_architecture                    = "X86_64"

  tags = {
    Environment = var.environment
  }

  depends_on = [module.app_runtime_iam]
}

# ACM Certificate for API Gateway custom domain
module "acm_certificate" {
  source = "github.com/jch254/terraform-modules//acm-dns-validated-certificate?ref=1.3.0"

  domain_name               = var.dns_name
  subject_alternative_names = []
  validation_method         = "DNS"

  tags = {
    Name        = "${var.name}-certificate"
    Environment = var.environment
  }
}

# Note: Certificate validation is handled manually via Cloudflare DNS

# API Gateway Custom Domain
module "api_gateway_custom_domain" {
  source = "github.com/jch254/terraform-modules//api-gateway-custom-domain?ref=1.3.0"

  domain_name     = var.dns_name
  certificate_arn = module.acm_certificate.arn
  api_id          = module.ecs_http_service.api_id
  stage           = module.ecs_http_service.stage_id
  endpoint_type   = "REGIONAL"
  security_policy = "TLS_1_2"

  tags = {
    Name        = "${var.name}-api-domain"
    Environment = var.environment
  }
}

# DynamoDB Table — single-table design
module "dynamodb_single_table" {
  source = "git::https://github.com/jch254/terraform-modules.git//dynamodb-single-table?ref=1.1.0"

  name = "${var.name}-entities"

  tags = {
    Environment = var.environment
  }
}

# IAM — ECS Runtime Roles
module "app_runtime_iam" {
  source = "github.com/jch254/terraform-modules//app-runtime-iam?ref=1.2.0"

  name        = var.name
  environment = var.environment
  region      = var.region

  ssm_parameter_arns = [
    aws_ssm_parameter.cookie_secret.arn,
    aws_ssm_parameter.resend_api_key.arn,
  ]

  dynamodb_table_arn = module.dynamodb_single_table.table_arn

  tags = {
    Environment = var.environment
  }
}

# IAM — CodeBuild Terraform deploy role
module "codebuild_terraform_role" {
  source = "git::https://github.com/jch254/terraform-modules.git//codebuild-terraform-role?ref=1.10.0"

  name        = var.name
  environment = var.environment

  s3_read_write_resource_arns = ["*"]

  ecr_repository_arns       = [module.ecr_repository.repository_arn]
  enable_ecs                = true
  enable_ec2_networking     = true
  enable_api_gateway        = true
  api_gateway_resource_arns = ["arn:aws:apigateway:${var.region}::/*"]
  enable_service_discovery  = true
  enable_route53            = true

  iam_role_arns = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name}-*",
  ]

  codebuild_project_arns = ["*"]

  ssm_parameter_arns = [
    "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${var.name}/*",
  ]

  secretsmanager_secret_arns = [
    "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:shared/github-token*",
  ]

  dynamodb_table_arns = [
    "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${var.name}-*",
  ]

  sns_topic_arns = [
    "arn:aws:sns:${var.region}:${data.aws_caller_identity.current.account_id}:${var.name}-*",
  ]

  event_rule_arns = [
    "arn:aws:events:${var.region}:${data.aws_caller_identity.current.account_id}:rule/${var.name}-*",
  ]

  lambda_function_arns = [
    "arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${var.name}-*",
  ]

  lambda_permission_function_arns = [local.build_notifier_lambda_function_arn]

  tags = {
    Environment = var.environment
  }
}

# CodeBuild Project
module "codebuild_project" {
  source = "git::https://github.com/jch254/terraform-modules.git//codebuild-project?ref=1.9.0"

  name                               = var.name
  description                        = "Build project for ${var.name}"
  codebuild_role_arn                 = module.codebuild_terraform_role.role_arn
  build_compute_type                 = var.build_compute_type
  build_docker_image                 = var.build_docker_image
  build_docker_tag                   = var.build_docker_tag
  privileged_mode                    = true
  image_pull_credentials_type        = "CODEBUILD"
  source_type                        = var.source_type
  source_location                    = var.source_location
  buildspec                          = var.buildspec
  git_clone_depth                    = 1
  cache_bucket                       = var.cache_bucket
  badge_enabled                      = false
  create_log_group                   = false
  webhook_enabled                    = true
  environment                        = var.environment
  build_notifier_lambda_function_arn = local.build_notifier_lambda_function_arn
  build_notifier_app_url             = "https://${var.dns_name}"
  build_notifier_github_repo_url     = trimsuffix(var.source_location, ".git")

  environment_variables = [
    { name = "AWS_DEFAULT_REGION", value = var.region },
    { name = "AWS_ACCOUNT_ID", value = data.aws_caller_identity.current.account_id },
    { name = "IMAGE_REPO_NAME", value = module.ecr_repository.repository_name },
    { name = "IMAGE_TAG", value = var.image_tag },
    { name = "CLUSTER_NAME", value = module.ecs_http_service.cluster_name },
    { name = "SERVICE_NAME", value = module.ecs_http_service.service_name },
    { name = "CLOUDFLARE_DOMAIN", value = var.cloudflare_domain },
    { name = "CLOUDFLARE_SUBDOMAIN", value = var.cloudflare_subdomain },
  ]

  tags = {
    Name        = "${var.name}-codebuild"
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "cookie_secret" {
  name        = "/${var.name}/cookie-secret"
  description = "Secret key for cookie signing"
  type        = "SecureString"
  value       = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name        = "${var.name}-cookie-secret"
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "resend_api_key" {
  name        = "/${var.name}/resend-api-key"
  description = "Resend API key for sending transactional emails"
  type        = "SecureString"
  value       = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name        = "${var.name}-resend-api-key"
    Environment = var.environment
  }
}
