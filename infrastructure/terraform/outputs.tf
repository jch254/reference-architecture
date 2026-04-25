output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB entities table"
  value       = module.dynamodb_single_table.table_name
}

output "api_gateway_custom_domain_target" {
  description = "Target domain name for DNS CNAME (point your domain here)"
  value       = aws_apigatewayv2_domain_name.main.domain_name_configuration[0].target_domain_name
}

output "acm_certificate_validation" {
  description = "ACM certificate DNS validation records (create these in Cloudflare)"
  value = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}
