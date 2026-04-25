moved {
  from = cloudflare_dns_record.acm_validation["reference-architecture.603.nz"]
  to   = module.acm_validation_records.cloudflare_dns_record.acm_validation["reference-architecture.603.nz"]
}

moved {
  from = cloudflare_dns_record.main
  to   = module.api_dns.cloudflare_dns_record.cname["main"]
}
