moved {
  from = aws_ecr_repository.main
  to   = module.ecr_repository.aws_ecr_repository.main
}

moved {
  from = aws_dynamodb_table.entities
  to   = module.dynamodb_single_table.aws_dynamodb_table.main
}

moved {
  from = aws_codebuild_project.main
  to   = module.codebuild_project.aws_codebuild_project.codebuild_project
}

moved {
  from = aws_codebuild_webhook.main
  to   = module.codebuild_project.aws_codebuild_webhook.codebuild_webhook[0]
}

moved {
  from = aws_cloudwatch_log_group.main
  to   = module.app_log_group.aws_cloudwatch_log_group.main
}

moved {
  from = aws_iam_role.ecs_execution_role
  to   = module.app_runtime_iam.aws_iam_role.ecs_execution_role
}

moved {
  from = aws_iam_role_policy_attachment.ecs_execution_role_policy
  to   = module.app_runtime_iam.aws_iam_role_policy_attachment.ecs_execution_role_policy
}

moved {
  from = aws_iam_role_policy.ecs_execution_ssm
  to   = module.app_runtime_iam.aws_iam_role_policy.ecs_execution_ssm
}

moved {
  from = aws_iam_role.ecs_task_role
  to   = module.app_runtime_iam.aws_iam_role.ecs_task_role
}

moved {
  from = aws_iam_role_policy.ecs_task_dynamodb
  to   = module.app_runtime_iam.aws_iam_role_policy.ecs_task_dynamodb
}

moved {
  from = aws_security_group.vpc_link
  to   = module.app_security_groups.aws_security_group.vpc_link
}

moved {
  from = aws_security_group.ecs
  to   = module.app_security_groups.aws_security_group.ecs
}

moved {
  from = aws_service_discovery_private_dns_namespace.main
  to   = module.cloudmap_private_service.aws_service_discovery_private_dns_namespace.main
}

moved {
  from = aws_service_discovery_service.main
  to   = module.cloudmap_private_service.aws_service_discovery_service.main
}

moved {
  from = aws_ecs_cluster.main
  to   = module.ecs_fargate_service.aws_ecs_cluster.main
}

moved {
  from = aws_ecs_task_definition.main
  to   = module.ecs_fargate_service.aws_ecs_task_definition.main
}

moved {
  from = aws_ecs_service.main
  to   = module.ecs_fargate_service.aws_ecs_service.main
}

moved {
  from = aws_apigatewayv2_api.main
  to   = module.http_api_cloudmap_proxy.aws_apigatewayv2_api.main
}

moved {
  from = aws_apigatewayv2_vpc_link.main
  to   = module.http_api_cloudmap_proxy.aws_apigatewayv2_vpc_link.main
}

moved {
  from = aws_apigatewayv2_integration.main
  to   = module.http_api_cloudmap_proxy.aws_apigatewayv2_integration.main
}

moved {
  from = aws_apigatewayv2_route.main
  to   = module.http_api_cloudmap_proxy.aws_apigatewayv2_route.main
}

moved {
  from = aws_apigatewayv2_stage.main
  to   = module.http_api_cloudmap_proxy.aws_apigatewayv2_stage.main
}

moved {
  from = aws_acm_certificate.main
  to   = module.acm_certificate.aws_acm_certificate.main
}

moved {
  from = aws_apigatewayv2_domain_name.main
  to   = module.api_gateway_custom_domain.aws_apigatewayv2_domain_name.main
}

moved {
  from = aws_apigatewayv2_api_mapping.main
  to   = module.api_gateway_custom_domain.aws_apigatewayv2_api_mapping.main
}

moved {
  from = module.app_log_group.aws_cloudwatch_log_group.main
  to   = module.ecs_http_service.module.ecs_fargate_service.aws_cloudwatch_log_group.main[0]
}

moved {
  from = module.app_security_groups.aws_security_group.vpc_link
  to   = module.ecs_http_service.module.app_security_groups.aws_security_group.vpc_link
}

moved {
  from = module.app_security_groups.aws_security_group.ecs
  to   = module.ecs_http_service.module.app_security_groups.aws_security_group.ecs
}

moved {
  from = module.cloudmap_private_service.aws_service_discovery_private_dns_namespace.main
  to   = module.ecs_http_service.module.cloudmap_private_service.aws_service_discovery_private_dns_namespace.main
}

moved {
  from = module.cloudmap_private_service.aws_service_discovery_service.main
  to   = module.ecs_http_service.module.cloudmap_private_service.aws_service_discovery_service.main
}

moved {
  from = module.ecs_fargate_service.aws_ecs_cluster.main
  to   = module.ecs_http_service.module.ecs_fargate_service.aws_ecs_cluster.main
}

moved {
  from = module.ecs_fargate_service.aws_ecs_task_definition.main
  to   = module.ecs_http_service.module.ecs_fargate_service.aws_ecs_task_definition.main
}

moved {
  from = module.ecs_fargate_service.aws_ecs_service.main
  to   = module.ecs_http_service.module.ecs_fargate_service.aws_ecs_service.main
}

moved {
  from = module.http_api_cloudmap_proxy.aws_apigatewayv2_api.main
  to   = module.ecs_http_service.module.http_api_cloudmap_proxy.aws_apigatewayv2_api.main
}

moved {
  from = module.http_api_cloudmap_proxy.aws_apigatewayv2_vpc_link.main
  to   = module.ecs_http_service.module.http_api_cloudmap_proxy.aws_apigatewayv2_vpc_link.main
}

moved {
  from = module.http_api_cloudmap_proxy.aws_apigatewayv2_integration.main
  to   = module.ecs_http_service.module.http_api_cloudmap_proxy.aws_apigatewayv2_integration.main
}

moved {
  from = module.http_api_cloudmap_proxy.aws_apigatewayv2_route.main
  to   = module.ecs_http_service.module.http_api_cloudmap_proxy.aws_apigatewayv2_route.main
}

moved {
  from = module.http_api_cloudmap_proxy.aws_apigatewayv2_stage.main
  to   = module.ecs_http_service.module.http_api_cloudmap_proxy.aws_apigatewayv2_stage.main
}

moved {
  from = module.build_notifier_subscription.aws_cloudwatch_event_rule.this
  to   = module.codebuild_project.module.build_notifier_subscription[0].aws_cloudwatch_event_rule.this
}

moved {
  from = module.build_notifier_subscription.aws_cloudwatch_event_target.lambda
  to   = module.codebuild_project.module.build_notifier_subscription[0].aws_cloudwatch_event_target.lambda
}

moved {
  from = module.build_notifier_subscription.aws_lambda_permission.eventbridge
  to   = module.codebuild_project.module.build_notifier_subscription[0].aws_lambda_permission.eventbridge
}

moved {
  from = aws_iam_role.codebuild_role
  to   = module.codebuild_terraform_role.aws_iam_role.this
}

moved {
  from = aws_iam_role_policy.codebuild_policy
  to   = module.codebuild_terraform_role.aws_iam_role_policy.this
}

moved {
  from = aws_ssm_parameter.cookie_secret
  to   = module.cookie_secret.aws_ssm_parameter.main
}

moved {
  from = aws_ssm_parameter.resend_api_key
  to   = module.resend_api_key.aws_ssm_parameter.main
}
