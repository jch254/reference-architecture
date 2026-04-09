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

Optional: `cloudflare/` manages DNS records pointing to the API Gateway.

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

## Local deploy

```bash
export AWS_DEFAULT_REGION="ap-southeast-4"
export REMOTE_STATE_BUCKET="jch254-terraform-remote-state"
export IMAGE_TAG="latest"
./infrastructure/terraform/deploy-infrastructure.bash
```

Requires valid AWS credentials. Run from the repo root.

## Pipeline flow

`buildspec.yml` → install → build → Docker build + push to ECR → `deploy-infrastructure.bash` → Terraform plan/apply → ECS wait for stable.
