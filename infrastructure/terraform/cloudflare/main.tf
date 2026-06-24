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

locals {
  api_gateway_custom_domain_target = try(data.terraform_remote_state.aws.outputs.api_gateway_custom_domain_target, null)
}

# ACM certificate DNS validation
module "acm_validation_records" {
  source = "github.com/jch254/terraform-modules//cloudflare-dns-records?ref=1.19.1"

  zone_id = data.cloudflare_zone.zone.id
  records = {
    for key, record in data.terraform_remote_state.aws.outputs.acm_certificate_validation : key => {
      name    = trimsuffix(record.name, ".")
      type    = record.type
      content = trimsuffix(record.value, ".")
      ttl     = 1
    }
  }
}

module "api_dns" {
  source = "github.com/jch254/terraform-modules//cloudflare-dns-records?ref=1.19.1"

  zone_id = data.cloudflare_zone.zone.id
  records = local.api_gateway_custom_domain_target == null ? {} : {
    main = {
      name    = var.subdomain
      type    = "CNAME"
      content = local.api_gateway_custom_domain_target
      proxied = true
      ttl     = 1
    }
  }
}

moved {
  from = module.acm_validation_records.cloudflare_dns_record.acm_validation
  to   = module.acm_validation_records.cloudflare_dns_record.this
}

moved {
  from = module.api_dns.cloudflare_dns_record.cname
  to   = module.api_dns.cloudflare_dns_record.this
}
