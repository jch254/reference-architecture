# Infrastructure — Terraform

## Architecture

ECS Fargate behind API Gateway HTTP API. No ALB — API Gateway connects directly to ECS via VPC Link + Cloud Map (private service discovery). Public subnets only, no NAT gateway.

## Resources

- ECS Fargate - single service, single container. Rolling deploys with circuit breaker.
- API Gateway HTTP API - regional custom domain with ACM TLS cert. VPC Link to Cloud Map.
- Cloud Map - private DNS namespace. ECS registers tasks automatically.
- DynamoDB - single table, PAY_PER_REQUEST. ECS task role scoped to GetItem, PutItem, UpdateItem, DeleteItem, Query.
- CodeBuild - build, Docker push to ECR, Terraform apply, ECS stabilise, then Cloudflare apply. Post-deploy system validation.
- `cloudflare/` — DNS layer. See [cloudflare/README.md](cloudflare/README.md).

## Module boundary

This scaffold consumes `jch254/terraform-modules` for the reusable core infrastructure primitives:

- ECR repository
- DynamoDB single table
- CodeBuild project and webhook
- CloudWatch app log group
- ECS runtime IAM roles and policies
- VPC Link and ECS security groups
- Cloud Map private namespace and service
- ECS Fargate cluster, task definition, and service
- API Gateway HTTP API, VPC Link, Cloud Map integration, route, and stage
- ACM DNS-validated certificate
- API Gateway custom domain and API mapping

The `terraform-modules` repository owns reusable primitives. This repository remains the runnable public reference scaffold: it chooses app-specific names, ports, domains, image tags, environment variables, secrets, service sizing, and deployment flow.

Resources that are still application-specific or intentionally deferred remain local here, including SSM parameters, build notification SNS/EventBridge/Lambda resources, deployment variables, and product-specific infrastructure such as SES, mail records, Cloudflare security rules, redirects, and tenant-routing choices.

The Cloudflare Terraform root remains separate from this AWS root. It also consumes focused `terraform-modules` building blocks for ACM validation DNS records and the API CNAME record, while continuing to read this root's outputs through remote state.

Real app descendants such as Namaste, Lush, and future KHA can choose when to adopt these modules. They should treat this scaffold as a proven reference, not an automatic migration mandate.

The `moved.tf` blocks are intentionally kept. They document the state-safe migration history and allow Terraform to preserve deployed resource identity when existing states are planned or applied against the modular configuration.

## Networking

Public subnets only. ECS tasks get public IPs. VPC Link security group restricts ingress to port 3000.

## Rolling deploys

- Old task stays running while new task launches alongside
- Container health check (`/api/health`) must pass before task is healthy
- 60s grace period before ECS evaluates health
- Circuit breaker with rollback enabled

## Bootstrap

ACM certificate requires DNS validation via Cloudflare, but Cloudflare depends on AWS outputs. First deploy requires targeted applies:

1. `terraform apply -target=module.acm_certificate.aws_acm_certificate.main` (AWS layer)
2. `terraform apply -target=module.acm_validation_records.cloudflare_dns_record.acm_validation` (Cloudflare layer)
3. Wait for ACM validation
4. Full apply on both layers

After bootstrap, all subsequent deploys run automatically via CodeBuild.

## Pipeline flow

`buildspec.yml` → build → Docker push to ECR → Terraform plan/apply → ECS stabilise → Cloudflare Terraform plan/apply → system validation.

## Variables

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `region` | AWS region to deploy to | yes | — |
| `name` | Name of project (used in AWS resource names) | yes | — |
| `environment` | Environment (e.g. prod) | no | `"prod"` |
| `vpc_id` | ID of existing VPC to use | yes | — |
| `image_tag` | Docker image tag to deploy | no | `"latest"` |
| `build_docker_image` | Docker image to use as CodeBuild build environment | yes | — |
| `build_docker_tag` | Docker image tag to use as CodeBuild build environment | yes | — |
| `source_type` | Type of repository that contains the source code | no | `"GITHUB"` |
| `source_location` | Location of the source code repository | yes | — |
| `buildspec` | Path to the buildspec file | no | `"buildspec.yml"` |
| `cache_bucket` | S3 bucket/prefix for CodeBuild cache | yes | — |
| `build_compute_type` | CodeBuild compute type | no | `"BUILD_GENERAL1_SMALL"` |
| `container_cpu` | Fargate task CPU units | no | `256` |
| `container_memory` | Fargate task memory (MB) | no | `512` |
| `cloudflare_domain` | Cloudflare zone name (e.g. 603.nz) | yes | — |
| `cloudflare_subdomain` | Subdomain for the application (e.g. reference-architecture) | yes | — |
| `dns_name` | Full domain name for the application (e.g. reference-architecture.603.nz) | yes | — |
| `notification_email` | Email address for CodeBuild build notifications (must be confirmed after first apply) | yes | — |

> **Note:** After the first `terraform apply`, AWS will send a confirmation email to the `notification_email` address. That confirmation link must be accepted before build notifications are delivered.
