# Reference Architecture

Minimal, production-ready backend architecture. NestJS + DynamoDB + Docker + CodeBuild + Terraform. No domain logic. No async/background systems.

## Architecture

```
/src                        → application (NestJS)
Dockerfile                  → runtime
buildspec.yml               → CI/CD (CodeBuild)
/infrastructure/terraform   → deployment (Terraform + Cloudflare)
```

## Principles

- stateless API
- tenant-aware (subdomain-based)
- minimal and explicit
- no overengineering

## Endpoints

- `GET /health` → `{ status, timestamp }`
- `GET /example` → `{ message, requestId, tenantId }`

## Running locally

```bash
pnpm install
pnpm run build
pnpm run start:prod
```

Or with Docker:

```bash
docker build -t ref-arch .
docker run -p 3000:3000 ref-arch
```

## Deployment

Push to `main` → CodeBuild → Docker image to ECR → Terraform apply → ECS Fargate → Cloudflare DNS.

Rolling deploys: ECS runs new task alongside old, waits for container health check to pass, then drains old task. Zero downtime.

### First-time bootstrap

ACM certificate validation requires a Cloudflare DNS record, but the Cloudflare step runs after the AWS step. Bootstrap manually once:

```bash
# 1. Apply ACM cert only
cd infrastructure/terraform
terraform init -reconfigure \
  -backend-config "bucket=$REMOTE_STATE_BUCKET" \
  -backend-config "key=reference-architecture" \
  -backend-config "region=ap-southeast-4"

terraform apply \
  -target=aws_acm_certificate.main \
  -var-file=environments/prod/terraform.tfvars \
  -var="image_tag=$(git rev-parse --short HEAD)"

# 2. Create validation CNAME in Cloudflare
cd cloudflare
terraform init -reconfigure \
  -backend-config "bucket=$REMOTE_STATE_BUCKET" \
  -backend-config "key=reference-architecture-cloudflare" \
  -backend-config "region=ap-southeast-4"

terraform apply \
  -target="cloudflare_dns_record.acm_validation" \
  -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
  -var="domain=603.nz" \
  -var="subdomain=reference-architecture" \
  -var="aws_region=ap-southeast-4" \
  -var="aws_state_bucket=$REMOTE_STATE_BUCKET" \
  -var="aws_state_key=reference-architecture"

# 3. Wait for ACM validation (~2-5 min)
aws acm wait certificate-validated \
  --certificate-arn <ACM_CERT_ARN> \
  --region ap-southeast-4

# 4. Full AWS apply (custom domain + mapping)
cd ..
terraform apply \
  -var-file=environments/prod/terraform.tfvars \
  -var="image_tag=$(git rev-parse --short HEAD)"

# 5. Full Cloudflare apply (CNAME → custom domain target)
cd cloudflare
terraform apply \
  -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
  -var="domain=603.nz" \
  -var="subdomain=reference-architecture" \
  -var="aws_region=ap-southeast-4" \
  -var="aws_state_bucket=$REMOTE_STATE_BUCKET" \
  -var="aws_state_key=reference-architecture"
```

After bootstrap, all subsequent deploys run automatically via CodeBuild.

## Usage

Used as a reference architecture for generating new applications.

1. Copy as `/example-project` in a new repository
2. Use as architectural context for building domain-specific systems
3. Evolve independently

Reuse structure, not implementation.