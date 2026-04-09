# Infrastructure

Terraform configuration for deploying the reference architecture.

## Resources

- Existing VPC + public subnets (reused via data sources)
- ECS Fargate (single service, single container)
- ECR repository
- API Gateway HTTP API → VPC Link → Cloud Map → ECS
- CodeBuild project (triggered on push to main)
- IAM roles (ECS execution, ECS task, CodeBuild)
- CloudWatch log group

`cloudflare/` manages DNS — CNAME pointing to the API Gateway default URL.

## Prerequisites

- Existing VPC with public subnets and an internet gateway
- S3 bucket for Terraform remote state
- S3 bucket for CodeBuild cache

## Setup

1. Fill in `vpc_id` in `environments/prod/terraform.tfvars`
2. Run initial apply locally:

```bash
cd infrastructure/terraform

terraform init \
  -backend-config "bucket=<state-bucket>" \
  -backend-config "key=reference-architecture" \
  -backend-config "region=<region>"

terraform apply -var-file=environments/prod/terraform.tfvars
```

3. After initial deploy, CodeBuild handles all subsequent deployments automatically on push to `main`.

## Cloudflare DNS

Managed in `cloudflare/`. Initial apply is manual; subsequent applies run automatically via CodeBuild.

For initial setup:

```bash
cd infrastructure/terraform/cloudflare

terraform init \
  -backend-config "bucket=<state-bucket>" \
  -backend-config "key=reference-architecture-cloudflare" \
  -backend-config "region=<region>"

terraform apply
```

Requires `cloudflare_api_token`, `domain`, `subdomain`, `aws_region`, `aws_state_bucket`, and `aws_state_key`.

## Pipeline flow

`buildspec.yml` → build → Docker push to ECR → Terraform plan/apply → ECS stabilise → Cloudflare Terraform plan/apply.
