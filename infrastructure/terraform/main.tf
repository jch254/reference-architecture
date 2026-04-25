provider "aws" {
  region = var.region
}

data "aws_vpc" "existing" {
  id = var.vpc_id
}

data "aws_caller_identity" "current" {}

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

# Security Groups
module "app_security_groups" {
  source = "github.com/jch254/terraform-modules//app-security-groups?ref=1.2.0"

  name           = var.name
  environment    = var.environment
  vpc_id         = data.aws_vpc.existing.id
  container_port = 3000

  tags = {
    Environment = var.environment
  }
}

# Cloud Map Service Discovery
module "cloudmap_private_service" {
  source = "github.com/jch254/terraform-modules//cloudmap-private-service?ref=1.2.0"

  name              = var.name
  environment       = var.environment
  vpc_id            = data.aws_vpc.existing.id
  namespace_name    = "${var.name}.local"
  service_name      = "${var.name}-service"
  dns_record_type   = "SRV"
  dns_record_ttl    = 1
  routing_policy    = "MULTIVALUE"
  failure_threshold = 1

  tags = {
    Environment = var.environment
  }
}

# API Gateway HTTP API
module "http_api_cloudmap_proxy" {
  source = "github.com/jch254/terraform-modules//http-api-cloudmap-proxy?ref=1.2.0"

  name                        = var.name
  environment                 = var.environment
  subnet_ids                  = data.aws_subnets.public.ids
  vpc_link_security_group_ids = [module.app_security_groups.vpc_link_security_group_id]
  cloudmap_service_arn        = module.cloudmap_private_service.service_arn
  route_key                   = "$default"
  stage_name                  = "$default"
  auto_deploy                 = true
  integration_method          = "ANY"

  tags = {
    Environment = var.environment
  }
}

# ACM Certificate for API Gateway custom domain
resource "aws_acm_certificate" "main" {
  domain_name       = var.dns_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.name}-certificate"
    Environment = var.environment
  }
}

# Note: Certificate validation is handled manually via Cloudflare DNS

# API Gateway Custom Domain
resource "aws_apigatewayv2_domain_name" "main" {
  domain_name = var.dns_name

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.main.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name        = "${var.name}-api-domain"
    Environment = var.environment
  }
}

# API Gateway Domain Mapping
resource "aws_apigatewayv2_api_mapping" "main" {
  api_id      = module.http_api_cloudmap_proxy.api_id
  domain_name = aws_apigatewayv2_domain_name.main.id
  stage       = module.http_api_cloudmap_proxy.stage_id
}

# DynamoDB Table — single-table design
module "dynamodb_single_table" {
  source = "git::https://github.com/jch254/terraform-modules.git//dynamodb-single-table?ref=1.1.0"

  name = "${var.name}-entities"

  tags = {
    Environment = var.environment
  }
}

# ECS Fargate runtime
module "ecs_fargate_service" {
  source = "github.com/jch254/terraform-modules//ecs-fargate-service?ref=1.2.0"

  name               = var.name
  environment        = var.environment
  cluster_name       = "${var.name}-cluster"
  service_name       = "${var.name}-service"
  task_family        = var.name
  container_name     = var.name
  image              = "${module.ecr_repository.repository_url}:${var.image_tag}"
  cpu                = var.container_cpu
  memory             = var.container_memory
  execution_role_arn = module.app_runtime_iam.execution_role_arn
  task_role_arn      = module.app_runtime_iam.task_role_arn

  container_port    = 3000
  host_port         = 3000
  log_group_name    = module.app_log_group.name
  log_region        = var.region
  log_stream_prefix = "ecs"

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

  subnet_ids           = data.aws_subnets.public.ids
  security_group_id    = module.app_security_groups.ecs_security_group_id
  assign_public_ip     = true
  cloudmap_service_arn = module.cloudmap_private_service.service_arn

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

# CloudWatch Log Group
module "app_log_group" {
  source = "github.com/jch254/terraform-modules//app-log-group?ref=1.2.0"

  name              = var.name
  environment       = var.environment
  log_group_name    = "/ecs/${var.name}"
  retention_in_days = 7

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

# IAM — CodeBuild Role
resource "aws_iam_role" "codebuild_role" {
  name = "${var.name}-codebuild"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.name}-codebuild"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "codebuild_policy" {
  name = "${var.name}-codebuild-policy"
  role = aws_iam_role.codebuild_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DeleteLogGroup",
          "logs:PutRetentionPolicy",
          "logs:ListTagsForResource",
          "logs:TagResource",
          "logs:UntagResource"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:CreateRepository",
          "ecr:DeleteRepository",
          "ecr:DescribeRepositories",
          "ecr:ListTagsForResource",
          "ecr:TagResource",
          "ecr:UntagResource",
          "ecr:PutImageScanningConfiguration",
          "ecr:PutImageTagMutability"
        ]
        Resource = module.ecr_repository.repository_arn
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:CreateCluster",
          "ecs:DeleteCluster",
          "ecs:DescribeClusters",
          "ecs:CreateService",
          "ecs:UpdateService",
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:ListTagsForResource",
          "ecs:TagResource",
          "ecs:UntagResource"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeVpcs",
          "ec2:DescribeVpcAttribute",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSecurityGroupRules",
          "ec2:DescribeNetworkInterfaces",
          "ec2:CreateSecurityGroup",
          "ec2:DeleteSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:CreateTags",
          "ec2:DeleteTags"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "apigateway:GET",
          "apigateway:POST",
          "apigateway:PUT",
          "apigateway:PATCH",
          "apigateway:DELETE",
          "apigateway:TagResource",
          "apigateway:UntagResource"
        ]
        Resource = "arn:aws:apigateway:${var.region}::/*"
      },
      {
        Effect = "Allow"
        Action = [
          "servicediscovery:CreatePrivateDnsNamespace",
          "servicediscovery:DeleteNamespace",
          "servicediscovery:GetNamespace",
          "servicediscovery:ListNamespaces",
          "servicediscovery:CreateService",
          "servicediscovery:DeleteService",
          "servicediscovery:GetService",
          "servicediscovery:UpdateService",
          "servicediscovery:GetOperation",
          "servicediscovery:ListTagsForResource",
          "servicediscovery:TagResource",
          "servicediscovery:UntagResource"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "route53:CreateHostedZone",
          "route53:DeleteHostedZone",
          "route53:GetHostedZone",
          "route53:ListHostedZones",
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets",
          "route53:GetChange"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:GetRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PassRole",
          "iam:ListInstanceProfilesForRole",
          "iam:TagRole",
          "iam:UntagRole"
        ]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetBucketLocation",
          "s3:ListBucket"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "codebuild:CreateProject",
          "codebuild:DeleteProject",
          "codebuild:UpdateProject",
          "codebuild:BatchGetProjects",
          "codebuild:CreateWebhook",
          "codebuild:DeleteWebhook",
          "codebuild:UpdateWebhook"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:DescribeParameters"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:PutParameter",
          "ssm:DeleteParameter",
          "ssm:AddTagsToResource",
          "ssm:RemoveTagsFromResource",
          "ssm:ListTagsForResource"
        ]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${var.name}/*"
      },
      {
        # CodeBuild stores GitHub OAuth credentials here internally when using import-source-credentials
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:shared/github-token*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable",
          "dynamodb:DeleteTable",
          "dynamodb:DescribeTable",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:UpdateTimeToLive",
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:ListTagsOfResource",
          "dynamodb:TagResource",
          "dynamodb:UntagResource"
        ]
        Resource = "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${var.name}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:CreateTopic",
          "sns:DeleteTopic",
          "sns:GetTopicAttributes",
          "sns:SetTopicAttributes",
          "sns:Subscribe",
          "sns:Unsubscribe",
          "sns:GetSubscriptionAttributes",
          "sns:ListTagsForResource",
          "sns:TagResource",
          "sns:UntagResource",
          "sns:ListSubscriptionsByTopic"
        ]
        Resource = "arn:aws:sns:${var.region}:${data.aws_caller_identity.current.account_id}:${var.name}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutRule",
          "events:DeleteRule",
          "events:DescribeRule",
          "events:PutTargets",
          "events:RemoveTargets",
          "events:ListTargetsByRule",
          "events:ListTagsForResource",
          "events:TagResource",
          "events:UntagResource"
        ]
        Resource = "arn:aws:events:${var.region}:${data.aws_caller_identity.current.account_id}:rule/${var.name}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction",
          "lambda:DeleteFunction",
          "lambda:GetFunction",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunctionConfiguration",
          "lambda:AddPermission",
          "lambda:RemovePermission",
          "lambda:GetPolicy",
          "lambda:ListVersionsByFunction",
          "lambda:TagResource",
          "lambda:UntagResource",
          "lambda:ListTags"
        ]
        Resource = "arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${var.name}-*"
      }
    ]
  })
}

# CodeBuild Project
module "codebuild_project" {
  source = "git::https://github.com/jch254/terraform-modules.git//codebuild-project?ref=1.1.1"

  name                        = var.name
  description                 = "Build project for ${var.name}"
  codebuild_role_arn          = aws_iam_role.codebuild_role.arn
  build_compute_type          = var.build_compute_type
  build_docker_image          = var.build_docker_image
  build_docker_tag            = var.build_docker_tag
  privileged_mode             = true
  image_pull_credentials_type = "CODEBUILD"
  source_type                 = var.source_type
  source_location             = var.source_location
  buildspec                   = var.buildspec
  git_clone_depth             = 1
  cache_bucket                = var.cache_bucket
  badge_enabled               = false
  create_log_group            = false
  webhook_enabled             = true

  environment_variables = [
    { name = "AWS_DEFAULT_REGION", value = var.region },
    { name = "AWS_ACCOUNT_ID", value = data.aws_caller_identity.current.account_id },
    { name = "IMAGE_REPO_NAME", value = module.ecr_repository.repository_name },
    { name = "IMAGE_TAG", value = var.image_tag },
    { name = "CLUSTER_NAME", value = module.ecs_fargate_service.cluster_name },
    { name = "SERVICE_NAME", value = module.ecs_fargate_service.service_name },
    { name = "CLOUDFLARE_DOMAIN", value = var.cloudflare_domain },
    { name = "CLOUDFLARE_SUBDOMAIN", value = var.cloudflare_subdomain },
  ]

  tags = {
    Name        = "${var.name}-codebuild"
    Environment = var.environment
  }
}

# SNS Topic for CodeBuild notifications
resource "aws_sns_topic" "build_notifications" {
  name = "${var.name}-build-notifications"

  tags = {
    Name        = "${var.name}-build-notifications"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "build_email" {
  topic_arn = aws_sns_topic.build_notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# Lambda formatter — receives EventBridge events and publishes formatted message to SNS
resource "aws_iam_role" "build_notification_lambda" {
  name = "${var.name}-build-notification-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "${var.name}-build-notification-lambda"
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

resource "aws_iam_role_policy" "build_notification_lambda" {
  name = "${var.name}-build-notification-lambda"
  role = aws_iam_role.build_notification_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.build_notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

data "archive_file" "build_notification_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/build-notification-formatter/dist/index.js"
  output_path = "${path.module}/lambda/build-notification-formatter/dist/build-notification-formatter.zip"
}

resource "aws_lambda_function" "build_notification_formatter" {
  filename         = data.archive_file.build_notification_lambda.output_path
  function_name    = "${var.name}-build-notification-formatter"
  role             = aws_iam_role.build_notification_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.build_notification_lambda.output_base64sha256

  environment {
    variables = {
      SNS_TOPIC_ARN   = aws_sns_topic.build_notifications.arn
      APP_URL         = "https://${var.dns_name}"
      GITHUB_REPO_URL = trimsuffix(var.source_location, ".git")
    }
  }

  tags = {
    Name        = "${var.name}-build-notification-formatter"
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "build_notification_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.build_notification_formatter.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.build_notifications.arn
}

# EventBridge rule — CodeBuild success + failure only
resource "aws_cloudwatch_event_rule" "build_notifications" {
  name        = "${var.name}-build-notifications"
  description = "CodeBuild build success and failure events"

  event_pattern = jsonencode({
    source      = ["aws.codebuild"]
    detail-type = ["CodeBuild Build State Change"]
    detail = {
      build-status = ["SUCCEEDED", "FAILED"]
      project-name = [module.codebuild_project.project_name]
    }
  })

  tags = {
    Name        = "${var.name}-build-notifications"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "build_notifications" {
  rule      = aws_cloudwatch_event_rule.build_notifications.name
  target_id = "${var.name}-build-notifications-lambda"
  arn       = aws_lambda_function.build_notification_formatter.arn
}
