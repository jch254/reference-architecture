output "application_url" {
  description = "Public URL of the application via Cloudflare"
  value       = "https://${var.subdomain}.${var.domain}"
}
