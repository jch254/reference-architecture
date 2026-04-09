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

resource "cloudflare_dns_record" "main" {
  content = replace(data.terraform_remote_state.aws.outputs.api_gateway_url, "https://", "")
  name    = var.subdomain
  proxied = true
  ttl     = 1
  type    = "CNAME"
  zone_id = data.cloudflare_zone.zone.id
}
