data "aws_caller_identity" "current" {}

locals {
  build_notifier_region              = coalesce(var.build_notifier_region, var.region)
  build_notifier_lambda_function_arn = "arn:aws:lambda:${local.build_notifier_region}:${data.aws_caller_identity.current.account_id}:function:${var.build_notifier_lambda_function_name}"
  terraform_state_key                = coalesce(var.terraform_state_key, var.name)
  validation_base_url                = coalesce(var.validation_base_url, "https://${var.dns_name}")
  cloudflare_api_token_parameter_arn = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${trimprefix(var.cloudflare_api_token_ssm_parameter_name, "/")}"
  app_lambda_function_arn            = "arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${var.name}"

  # Lambda env vars. Same runtime config the ECS task sets, with two differences:
  # - AWS_REGION is intentionally omitted: it is a reserved Lambda env key (the
  #   runtime injects it automatically, and the app reads it back via ConfigService).
  # - COOKIE_SECRET / RESEND_API_KEY are NOT passed here; the handler fetches them
  #   from SSM by name at cold start so secrets stay out of the function config.
  app_environment_variables = merge(
    {
      PORT                          = "3000"
      DYNAMODB_TABLE                = module.dynamodb_single_table.table_name
      TENANT_RESOLUTION_MODE        = var.tenant_resolution_mode
      BASE_DOMAIN                   = var.tenant_resolution_mode == "fixed" ? var.dns_name : var.cloudflare_domain
      RESEND_FROM_EMAIL             = var.resend_from_email
      AUTH_PROVIDER                 = var.auth_provider
      COOKIE_SECRET_PARAMETER_NAME  = module.cookie_secret.name
      RESEND_API_KEY_PARAMETER_NAME = module.resend_api_key.name
    },
    var.email_mode == null ? {} : { EMAIL_MODE = var.email_mode },
    var.app_tenant_id == null ? {} : { APP_TENANT_ID = var.app_tenant_id },
    var.oidc_issuer == null ? {} : { OIDC_ISSUER = var.oidc_issuer },
    var.oidc_audience == null ? {} : { OIDC_AUDIENCE = var.oidc_audience },
    var.oidc_jwks_uri == null ? {} : { OIDC_JWKS_URI = var.oidc_jwks_uri },
    var.auth0_spa_client_id == null ? {} : { AUTH0_SPA_CLIENT_ID = var.auth0_spa_client_id },
  )
}

# ECR Repository
module "ecr_repository" {
  source = "github.com/jch254/terraform-modules//ecr-repository?ref=1.19.0"

  name = var.name
}

# DynamoDB Table — one physical table per deployment/product/environment.
# Runtime tenant resolution only chooses the TENANT# key prefix inside this table.
module "dynamodb_single_table" {
  source = "github.com/jch254/terraform-modules//dynamodb-single-table?ref=1.19.0"

  name = "${var.name}-entities"
}

# IAM — Lambda runtime role
module "lambda_runtime_iam" {
  source = "github.com/jch254/terraform-modules//lambda-runtime-iam?ref=1.19.0"

  name        = var.name
  environment = var.environment
  region      = var.region

  ssm_parameter_arns = [
    module.cookie_secret.arn,
    module.resend_api_key.arn,
  ]

  dynamodb_table_arn = module.dynamodb_single_table.table_arn
}

# Lambda (container image) HTTP runtime, behind an API Gateway HTTP API.
module "lambda_http_service" {
  source = "github.com/jch254/terraform-modules//lambda-http-service?ref=1.19.0"

  name        = var.name
  environment = var.environment

  image    = "${module.ecr_repository.repository_url}:${var.image_tag}"
  role_arn = module.lambda_runtime_iam.role_arn

  memory_size  = var.lambda_memory_size
  timeout      = var.lambda_timeout
  architecture = var.lambda_architecture

  log_retention_in_days = 7

  environment_variables = local.app_environment_variables

  depends_on = [module.lambda_runtime_iam]
}

# ACM Certificate for API Gateway custom domain
module "acm_certificate" {
  source = "github.com/jch254/terraform-modules//acm-dns-validated-certificate?ref=1.19.0"

  domain_name               = var.dns_name
  subject_alternative_names = []
  validation_method         = "DNS"
}

# Note: Certificate validation is handled manually via Cloudflare DNS

# API Gateway Custom Domain — maps to the Lambda HTTP API's $default stage.
module "api_gateway_custom_domain" {
  source = "github.com/jch254/terraform-modules//api-gateway-custom-domain?ref=1.19.0"

  domain_name     = var.dns_name
  certificate_arn = module.acm_certificate.arn
  api_id          = module.lambda_http_service.api_id
  stage           = module.lambda_http_service.stage_id
  endpoint_type   = "REGIONAL"
  security_policy = "TLS_1_2"
}

# IAM — CodeBuild Terraform deploy role. Lambda variant: no ECS, no service
# discovery, no EC2 networking; the app Lambda is managed by its exact ARN.
module "codebuild_terraform_role" {
  source = "github.com/jch254/terraform-modules//codebuild-terraform-role?ref=1.19.0"

  name        = var.name
  environment = var.environment

  s3_read_write_resource_arns = ["*"]

  ecr_repository_arns       = [module.ecr_repository.repository_arn]
  enable_ecs                = false
  enable_ec2_networking     = false
  enable_api_gateway        = true
  api_gateway_resource_arns = ["arn:aws:apigateway:${var.region}::/*"]
  enable_service_discovery  = false
  enable_route53            = true
  enable_acm                = true

  codebuild_project_arns = ["*"]
  ssm_parameter_arns = [
    local.cloudflare_api_token_parameter_arn,
  ]

  # Manage the app Lambda function (create/update code + config/delete).
  lambda_function_arns = [local.app_lambda_function_arn]

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

  # AddPermission on the app function (API Gateway invoke) and the build notifier.
  lambda_permission_function_arns = [
    local.app_lambda_function_arn,
    local.build_notifier_lambda_function_arn,
  ]
}

# CodeBuild Project
module "codebuild_project" {
  source = "github.com/jch254/terraform-modules//codebuild-project?ref=1.19.0"

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
    { name = "FUNCTION_NAME", value = module.lambda_http_service.function_name },
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
  source = "github.com/jch254/terraform-modules//ssm-parameter-placeholder?ref=1.19.0"

  name        = "/${var.name}/cookie-secret"
  description = "Secret key for cookie signing"
}

module "resend_api_key" {
  source = "github.com/jch254/terraform-modules//ssm-parameter-placeholder?ref=1.19.0"

  name        = "/${var.name}/resend-api-key"
  description = "Resend API key for sending transactional emails"
}
