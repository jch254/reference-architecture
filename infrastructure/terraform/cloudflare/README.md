# Infrastructure — Cloudflare

DNS layer for the reference architecture.

## What it does

- CNAME record: `<subdomain>.<domain>` → API Gateway custom domain target
- ACM certificate DNS validation records
- Cloudflare handles TLS termination and edge proxying

## How it connects

Reads AWS outputs (API Gateway domain target, ACM validation records) from Terraform remote state. No direct AWS resource management.

## Module boundary

This root consumes focused Cloudflare modules from `jch254/terraform-modules`:

- `cloudflare-acm-validation-records` owns the ACM DNS validation records.
- `cloudflare-api-dns` owns the app CNAME that points to the API Gateway custom domain target.

The root remains responsible for app-specific choices: Cloudflare zone, subdomain, remote-state source, proxying decision, and any future records that are product-specific. Mail records, SES or vendor verification, Cloudflare security rules, redirects, page rules, and tenant-routing records are intentionally outside this reference scaffold's reusable Cloudflare core.

The `moved.tf` blocks are intentionally retained so existing Cloudflare records keep their deployed identities after the module migration.

## Deployment

Initial apply is manual. Subsequent applies run automatically via CodeBuild after the AWS layer stabilises.
