provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "aws" {
  region = var.aws_region
}

data "terraform_remote_state" "aws" {
  backend = "s3"
  config = {
    bucket  = var.aws_state_bucket
    key     = var.aws_state_key
    region  = var.aws_region
    encrypt = true
  }
}

data "cloudflare_zone" "zone" {
  filter = {
    name = var.domain
  }
}

# ACM certificate DNS validation
resource "cloudflare_dns_record" "acm_validation" {
  for_each = data.terraform_remote_state.aws.outputs.acm_certificate_validation

  content = each.value.value
  name    = each.value.name
  proxied = false
  ttl     = 1
  type    = each.value.type
  zone_id = data.cloudflare_zone.zone.id
}

resource "cloudflare_dns_record" "main" {
  content = data.terraform_remote_state.aws.outputs.api_gateway_custom_domain_target
  name    = var.subdomain
  proxied = true
  ttl     = 1
  type    = "CNAME"
  zone_id = data.cloudflare_zone.zone.id
}
