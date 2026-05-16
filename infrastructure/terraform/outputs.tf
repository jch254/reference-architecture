output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = module.ecs_http_service.api_endpoint
}

output "dynamodb_table_name" {
  description = "Name of the deployment-specific DynamoDB entities table"
  value       = module.dynamodb_single_table.table_name
}

output "codebuild_project_name" {
  description = "Name of the CodeBuild project to register with the shared-platform build notifier."
  value       = module.codebuild_project.project_name
}

output "build_notification_event_rule_arn" {
  description = "ARN of the app-owned EventBridge rule targeting the shared-platform build notifier."
  value       = module.codebuild_project.build_notification_event_rule_arn
}

output "api_gateway_custom_domain_target" {
  description = "Target domain name for DNS CNAME (point your domain here)"
  value       = module.api_gateway_custom_domain.target_domain_name
}

output "acm_certificate_validation" {
  description = "ACM certificate DNS validation records (create these in Cloudflare)"
  value = {
    for dvo in module.acm_certificate.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}
