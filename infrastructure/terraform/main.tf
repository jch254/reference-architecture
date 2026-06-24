data "aws_vpc" "existing" {
  id = var.vpc_id
}

data "aws_caller_identity" "current" {}

locals {
  build_notifier_region              = coalesce(var.build_notifier_region, var.region)
  build_notifier_lambda_function_arn = "arn:aws:lambda:${local.build_notifier_region}:${data.aws_caller_identity.current.account_id}:function:${var.build_notifier_lambda_function_name}"
  terraform_state_key                = coalesce(var.terraform_state_key, var.name)
  validation_base_url                = coalesce(var.validation_base_url, "https://${var.dns_name}")
  cloudflare_api_token_parameter_arn = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${trimprefix(var.cloudflare_api_token_ssm_parameter_name, "/")}"
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
  source = "github.com/jch254/terraform-modules//ecr-repository?ref=1.19.1"

  name = var.name
}

# ECS HTTP runtime
module "ecs_http_service" {
  source = "github.com/jch254/terraform-modules//ecs-http-service?ref=1.19.1"

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

  environment_variables = concat(
    [
      {
        name  = "PORT"
        value = "3000"
      },
      {
        name  = "DYNAMODB_TABLE"
        value = module.dynamodb_single_table.table_name
      },
      {
        name  = "TENANT_RESOLUTION_MODE"
        value = var.tenant_resolution_mode
      },
      {
        name  = "AWS_REGION"
        value = var.region
      },
      {
        name  = "BASE_DOMAIN"
        value = var.tenant_resolution_mode == "fixed" ? var.dns_name : var.cloudflare_domain
      },
      {
        name  = "RESEND_FROM_EMAIL"
        value = var.resend_from_email
      },
      {
        name  = "AUTH_PROVIDER"
        value = var.auth_provider
      }
    ],
    var.app_tenant_id == null ? [] : [
      {
        name  = "APP_TENANT_ID"
        value = var.app_tenant_id
      }
    ],
    var.oidc_issuer == null ? [] : [
      {
        name  = "OIDC_ISSUER"
        value = var.oidc_issuer
      }
    ],
    var.oidc_audience == null ? [] : [
      {
        name  = "OIDC_AUDIENCE"
        value = var.oidc_audience
      }
    ],
    var.oidc_jwks_uri == null ? [] : [
      {
        name  = "OIDC_JWKS_URI"
        value = var.oidc_jwks_uri
      }
    ],
    var.auth0_spa_client_id == null ? [] : [
      {
        name  = "AUTH0_SPA_CLIENT_ID"
        value = var.auth0_spa_client_id
      }
    ],
  )

  secrets = [
    {
      name      = "COOKIE_SECRET"
      valueFrom = module.cookie_secret.arn
    },
    {
      name      = "RESEND_API_KEY"
      valueFrom = module.resend_api_key.arn
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

  depends_on = [module.app_runtime_iam]
}

# ACM Certificate for API Gateway custom domain
module "acm_certificate" {
  source = "github.com/jch254/terraform-modules//acm-dns-validated-certificate?ref=1.19.1"

  domain_name               = var.dns_name
  subject_alternative_names = []
  validation_method         = "DNS"
}

# Note: Certificate validation is handled manually via Cloudflare DNS

# API Gateway Custom Domain
module "api_gateway_custom_domain" {
  source = "github.com/jch254/terraform-modules//api-gateway-custom-domain?ref=1.19.1"

  domain_name     = var.dns_name
  certificate_arn = module.acm_certificate.arn
  api_id          = module.ecs_http_service.api_id
  stage           = module.ecs_http_service.stage_id
  endpoint_type   = "REGIONAL"
  security_policy = "TLS_1_2"
}

# DynamoDB Table — one physical table per deployment/product/environment.
# Runtime tenant resolution only chooses the TENANT# key prefix inside this table.
module "dynamodb_single_table" {
  source = "github.com/jch254/terraform-modules//dynamodb-single-table?ref=1.19.1"

  name = "${var.name}-entities"
}

# IAM — ECS Runtime Roles
module "app_runtime_iam" {
  source = "github.com/jch254/terraform-modules//app-runtime-iam?ref=1.19.1"

  name        = var.name
  environment = var.environment
  region      = var.region

  ssm_parameter_arns = [
    module.cookie_secret.arn,
    module.resend_api_key.arn,
  ]

  dynamodb_table_arn = module.dynamodb_single_table.table_arn
}

# IAM — CodeBuild Terraform deploy role
module "codebuild_terraform_role" {
  source = "github.com/jch254/terraform-modules//codebuild-terraform-role?ref=1.19.1"

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
  enable_acm                = true

  codebuild_project_arns = ["*"]
  ssm_parameter_arns = [
    local.cloudflare_api_token_parameter_arn,
  ]

  prefix_managed_services = [
    "iam_role",
    "ssm_parameter",
    "dynamodb_table",
    "sns_topic",
    "event_rule",
    "lambda_function",
  ]

  secretsmanager_secret_arns = [
    "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:shared/github-token*",
  ]

  lambda_permission_function_arns = [local.build_notifier_lambda_function_arn]
}

# CodeBuild Project
module "codebuild_project" {
  source = "github.com/jch254/terraform-modules//codebuild-project?ref=1.19.1"

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
    { name = "CLOUDFLARE_API_TOKEN_PARAMETER_NAME", value = var.cloudflare_api_token_ssm_parameter_name },
    { name = "COOKIE_SECRET_PARAMETER_NAME", value = module.cookie_secret.name },
    { name = "TF_STATE_KEY", value = local.terraform_state_key },
    { name = "TF_VAR_FILE", value = var.terraform_var_file },
    { name = "VALIDATION_BASE_URL", value = local.validation_base_url },
    { name = "VALIDATION_AUTH_PROVIDER", value = var.auth_provider },
    { name = "RUN_SYSTEM_VALIDATION", value = tostring(var.run_system_validation) },
  ]
}

module "cookie_secret" {
  source = "github.com/jch254/terraform-modules//ssm-parameter-placeholder?ref=1.19.1"

  name        = "/${var.name}/cookie-secret"
  description = "Secret key for cookie signing"
}

module "resend_api_key" {
  source = "github.com/jch254/terraform-modules//ssm-parameter-placeholder?ref=1.19.1"

  name        = "/${var.name}/resend-api-key"
  description = "Resend API key for sending transactional emails"
}
