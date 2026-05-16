# Infrastructure — Terraform

## Architecture

ECS Fargate behind API Gateway HTTP API. No ALB — API Gateway connects directly to ECS via VPC Link + Cloud Map (private service discovery). Public subnets only, no NAT gateway.

## Resources

- ECS Fargate - single service, single container. Rolling deploys with circuit breaker.
- API Gateway HTTP API - regional custom domain with ACM TLS cert. VPC Link to Cloud Map.
- Cloud Map - private DNS namespace. ECS registers tasks automatically.
- DynamoDB - deployment-specific single table, PAY_PER_REQUEST. ECS task role scoped to GetItem, PutItem, UpdateItem, DeleteItem, Query.
- CodeBuild - build, Docker push to ECR, Terraform apply, ECS stabilise, then Cloudflare apply. Post-deploy system validation. Build notifications use an app-owned EventBridge rule targeting the shared-platform notifier.
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

Resources that are still application-specific or intentionally deferred remain local here, including SSM parameters, deployment variables, the CodeBuild notification EventBridge subscription, and product-specific infrastructure such as SES, mail records, Cloudflare security rules, redirects, and tenant-routing choices. The shared formatter Lambda and notification email subscription are owned by the shared-platform root.

The Cloudflare Terraform root remains separate from this AWS root. It also consumes focused `terraform-modules` building blocks for ACM validation DNS records and the API CNAME record, while continuing to read this root's outputs through remote state.

Downstream app repos can choose when to adopt these modules. They should treat this scaffold as a proven reference, not an automatic migration mandate.

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

1. Apply the ACM certificate in the AWS layer:
   `terraform apply -target=module.acm_certificate.aws_acm_certificate.main`
2. Apply the Cloudflare layer. On this first pass it creates only the ACM validation records because the API Gateway custom-domain output does not exist yet.
3. Wait for ACM validation.
4. Apply the full AWS layer. This creates the API Gateway custom domain and the remaining app resources.
5. Apply the full Cloudflare layer again. This creates the app CNAME once the API Gateway target output exists.

After bootstrap, all subsequent deploys run automatically via CodeBuild.

For the Auth0 deployment identity, use the Auth0 state key and var file throughout:

```bash
export REMOTE_STATE_BUCKET="jch254-terraform-remote-state"
export AWS_DEFAULT_REGION="ap-southeast-4"
export TF_STATE_KEY="reference-architecture-auth0"
export TF_VAR_FILE="environments/prod-auth0/terraform.tfvars"

cd infrastructure/terraform
terraform init -reconfigure \
  -backend-config "bucket=${REMOTE_STATE_BUCKET}" \
  -backend-config "key=${TF_STATE_KEY}" \
  -backend-config "region=${AWS_DEFAULT_REGION}" \
  -get=true
terraform apply \
  -var-file="${TF_VAR_FILE}" \
  -target=module.acm_certificate.aws_acm_certificate.main

export CLOUDFLARE_API_TOKEN="$(
  aws ssm get-parameter \
    --name "/reference-architecture/cloudflare-api-token" \
    --with-decryption \
    --query Parameter.Value \
    --output text
)"

cd cloudflare
terraform init -reconfigure \
  -backend-config "bucket=${REMOTE_STATE_BUCKET}" \
  -backend-config "key=${TF_STATE_KEY}-cloudflare" \
  -backend-config "region=${AWS_DEFAULT_REGION}" \
  -get=true
terraform apply \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="domain=603.nz" \
  -var="subdomain=reference-architecture-auth0" \
  -var="aws_region=${AWS_DEFAULT_REGION}" \
  -var="aws_state_bucket=${REMOTE_STATE_BUCKET}" \
  -var="aws_state_key=${TF_STATE_KEY}"

# After ACM is ISSUED:
cd ..
terraform apply \
  -var-file="${TF_VAR_FILE}" \
  -var="image_tag=${IMAGE_TAG:-latest}"

cd cloudflare
terraform apply \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="domain=603.nz" \
  -var="subdomain=reference-architecture-auth0" \
  -var="aws_region=${AWS_DEFAULT_REGION}" \
  -var="aws_state_bucket=${REMOTE_STATE_BUCKET}" \
  -var="aws_state_key=${TF_STATE_KEY}"
```

The first full AWS apply creates the Auth0 CodeBuild project and webhook. If the selected image tag is not present in the new Auth0 ECR repo yet, the ECS service can be unhealthy until the first Auth0 CodeBuild run builds and pushes that commit's image.

## Pipeline flow

`buildspec.yml` → build → Docker push to ECR → Terraform plan/apply → ECS stabilise → Cloudflare Terraform plan/apply → system validation.

## Deployment identities

This root is reused for each deployment identity by changing the var file and remote state key. The existing demo remains in the original state and keeps its existing resource names:

| Domain | Var file | State key | Runtime config |
| --- | --- | --- | --- |
| `reference-architecture.603.nz` | `environments/prod/terraform.tfvars` | `reference-architecture` | `TENANT_RESOLUTION_MODE=subdomain`, `AUTH_PROVIDER=internal_magic_link` |
| `reference-architecture-auth0.603.nz` | `environments/prod-auth0/terraform.tfvars` | `reference-architecture-auth0` | `TENANT_RESOLUTION_MODE=fixed`, `APP_TENANT_ID=refarch-auth0-demo`, `AUTH_PROVIDER=oidc` |

The Auth0/OIDC demo is additive. It gets its own `name = "reference-architecture-auth0"` resources, including ECS runtime resources, API custom domain/certificate, CodeBuild project, SSM placeholders, and `${name}-entities` DynamoDB table. The logical item key shape remains `PK = TENANT#refarch-auth0-demo`; the app does not select DynamoDB tables dynamically from the request tenant.

The deployment pipeline reads `TF_STATE_KEY` and `TF_VAR_FILE` from the CodeBuild project environment. For the Auth0 demo these are set from the tfvars file to `reference-architecture-auth0` and `environments/prod-auth0/terraform.tfvars`, which keeps AWS and Cloudflare state separate from the existing demo.

## Tenant and DynamoDB isolation

Tenant resolution and table isolation are separate choices:

- `TENANT_RESOLUTION_MODE` controls how the app resolves the runtime tenant id.
- The DynamoDB table name controls physical data isolation.
- `APP_TENANT_ID` is not a substitute for table isolation.
- The AWS root creates one DynamoDB table from `var.name`: `${var.name}-entities`.

For fixed-mode product deployments, choose a distinct deployment `name` per product/environment so each deployment gets its own table. For example, a production deployment can use `name = "product-prod"` with `APP_TENANT_ID=product-prod`, while a test deployment can use `name = "product-test"` with `APP_TENANT_ID=product-test`.

For subdomain-mode deployments, one product/environment table can intentionally hold many runtime tenant partitions. For example, `name = "product-prod"` creates `product-prod-entities`, and tenant keys can include `TENANT#acme`, `TENANT#demo`, and `TENANT#jordan`.

Both modes keep the same logical key shape:

```
PK = TENANT#<tenantId>
SK = ...
```

Persisted tenant fields such as `tenantSlug` should remain on records that store them in both modes. Do not remove `TENANT#` prefixes or route each request to a tenant-derived table in fixed mode.

## Variables

| Name | Description | Required | Default |
| ---- | ----------- | -------- | ------- |
| `region` | AWS region to deploy to | yes | — |
| `name` | Deployment name used in AWS resource names; include the product/environment boundary because the DynamoDB table is `${name}-entities` | yes | — |
| `environment` | Environment tag for this deployment; physical isolation still comes from deployment/table identity | no | `"prod"` |
| `tenant_resolution_mode` | Runtime tenant resolution strategy: `fixed` or `subdomain`; does not choose the DynamoDB table | no | `"subdomain"` |
| `app_tenant_id` | Fixed runtime tenant id for this deployed app/environment; required when `tenant_resolution_mode = "fixed"` and not a substitute for a deployment-specific table | no | `null` |
| `auth_provider` | Primary backend auth provider: `none`, `internal_magic_link`, or `oidc`; dual-provider mode is intentionally not supported | no | `"internal_magic_link"` |
| `oidc_issuer` | OIDC issuer URL, for example `https://example.auth0.com/`; required by the backend when `auth_provider = "oidc"` | no | `null` |
| `oidc_audience` | Expected OIDC access-token audience; required by the backend when `auth_provider = "oidc"` | no | `null` |
| `oidc_jwks_uri` | Optional explicit JWKS URI; if omitted, the backend derives it from `oidc_issuer` | no | `null` |
| `vpc_id` | ID of existing VPC to use | yes | — |
| `image_tag` | Docker image tag to deploy | no | `"latest"` |
| `build_docker_image` | Docker image to use as CodeBuild build environment | yes | — |
| `build_docker_tag` | Docker image tag to use as CodeBuild build environment | yes | — |
| `source_type` | Type of repository that contains the source code | no | `"GITHUB"` |
| `source_location` | Location of the source code repository | yes | — |
| `buildspec` | Path to the buildspec file | no | `"buildspec.yml"` |
| `cache_bucket` | S3 bucket/prefix for CodeBuild cache | yes | — |
| `build_compute_type` | CodeBuild compute type | no | `"BUILD_GENERAL1_SMALL"` |
| `build_notifier_region` | AWS region where shared-platform deploys the build notification formatter Lambda | no | `region` |
| `build_notifier_lambda_function_name` | Name of the shared-platform build notification formatter Lambda | no | `"shared-platform-build-notification-formatter"` |
| `terraform_state_key` | Remote state key used by CodeBuild for this deployment identity | no | `name` |
| `terraform_var_file` | Terraform variable file CodeBuild uses for subsequent applies | no | `"environments/prod/terraform.tfvars"` |
| `validation_base_url` | Base URL for post-deploy system validation | no | `https://dns_name` |
| `run_system_validation` | Whether CodeBuild runs the magic-link system validation after deploy | no | `true` |
| `cloudflare_api_token_ssm_parameter_name` | SSM parameter containing the Cloudflare API token for the DNS deploy step | no | `"/reference-architecture/cloudflare-api-token"` |
| `container_cpu` | Fargate task CPU units | no | `256` |
| `container_memory` | Fargate task memory (MB) | no | `512` |
| `cloudflare_domain` | Cloudflare zone name (e.g. 603.nz) | yes | — |
| `cloudflare_subdomain` | Subdomain for the application (e.g. reference-architecture) | yes | — |
| `dns_name` | Full domain name for the application (e.g. reference-architecture.603.nz) | yes | — |
