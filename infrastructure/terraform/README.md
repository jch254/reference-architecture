# Infrastructure

Terraform configuration for deploying the reference architecture.

## Resources

- VPC (public subnets, no NAT)
- ECS Fargate (single service, single container)
- ECR repository
- API Gateway HTTP API → VPC Link → Cloud Map → ECS
- CodeBuild project (triggered on push to main)
- IAM roles (ECS execution, ECS task, CodeBuild)
- CloudWatch log group

## Prerequisites

- Existing VPC with an internet gateway
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

## Pipeline flow

`buildspec.yml` → install → build → Docker build + push to ECR → `deploy-infrastructure.bash` → Terraform plan/apply → ECS wait for stable.
