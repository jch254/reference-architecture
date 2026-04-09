# Infrastructure — Cloudflare

DNS layer for the reference architecture.

## What it does

- CNAME record: `<subdomain>.<domain>` → API Gateway custom domain target
- ACM certificate DNS validation records
- Cloudflare handles TLS termination and edge proxying

## How it connects

Reads AWS outputs (API Gateway domain target, ACM validation records) from Terraform remote state. No direct AWS resource management.

## Deployment

Initial apply is manual. Subsequent applies run automatically via CodeBuild after the AWS layer stabilises.
