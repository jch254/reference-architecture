# Infrastructure — Terraform (Lambda compute)

The Lambda (container image) compute variant of [`../terraform`](../terraform).
Same app, same DynamoDB/CodeBuild/ACM/custom-domain/DNS model — the only change
is the compute backend: an AWS Lambda function deployed from a container image,
fronted by an API Gateway HTTP API (v2) Lambda-proxy integration instead of ECS
Fargate behind a VPC Link.

This is a separate Terraform root with its own state key, so it is fully
additive: it does not touch the ECS demos.

## Architecture

API Gateway HTTP API → `AWS_PROXY` (Lambda) integration → container-image Lambda.
No VPC, VPC Link, Cloud Map, security groups, or NAT — the function reaches
DynamoDB, SSM, and Resend over the AWS network, and API Gateway invokes it
through the managed integration. The `$default` route + `$default` stage serve
every method/path at the domain root (no stage prefix), so `setGlobalPrefix('api')`
and the static frontend behave exactly as on ECS.

The same NestJS app runs here. `src/backend/app.factory.ts` builds the app;
`src/backend/lambda.ts` initialises it (no listener) and hands the Express
instance to `@codegenie/serverless-express`. Runtime secrets (`COOKIE_SECRET`,
`RESEND_API_KEY`) are resolved from SSM by name at cold start, so they never live
in the Lambda function config or Terraform state.

## Resources

- Lambda function — `package_type = "Image"`, from this deployment's ECR repo.
- API Gateway HTTP API — regional custom domain with ACM TLS cert, Lambda proxy.
- DynamoDB — deployment-specific single table, PAY_PER_REQUEST. The Lambda role
  is scoped to GetItem, PutItem, UpdateItem, DeleteItem, BatchWriteItem, Query.
- ECR repository, SSM secret placeholders, CodeBuild project + webhook.
- DNS is the shared [`../terraform/cloudflare`](../terraform/cloudflare) root
  (compute-agnostic; reused with this deployment's own `-cloudflare` state key).

## Module boundary

Reusable primitives live in `jch254/terraform-modules`. This variant adds two
Lambda-specific modules there — `lambda-http-service` (image Lambda + HTTP API +
proxy integration + stage + permission + log group, emitting the same
`api_id`/`stage_id`/`api_endpoint` outputs as `ecs-http-service`) and
`lambda-runtime-iam` (Lambda execution role) — and reuses the existing
ECR / DynamoDB / ACM / API-Gateway-custom-domain / CodeBuild / SSM modules
unchanged. The `lambda-function` module in that repo is zip-based and is not used
here. All modules are pinned to `?ref=1.19.1`.

## Bootstrap

ACM validation needs Cloudflare, Cloudflare needs AWS outputs, and — unlike ECS —
a `package_type = "Image"` Lambda **cannot be created until its image already
exists in ECR**. So the first deploy stages ECR + a first image push before the
full apply:

```bash
export REMOTE_STATE_BUCKET="jch254-terraform-remote-state"
export AWS_DEFAULT_REGION="ap-southeast-4"
export TF_STATE_KEY="reference-architecture-lambda"
export TF_VAR_FILE="environments/prod-lambda/terraform.tfvars"

cd infrastructure/terraform-lambda
terraform init -reconfigure \
  -backend-config "bucket=${REMOTE_STATE_BUCKET}" \
  -backend-config "key=${TF_STATE_KEY}" \
  -backend-config "region=${AWS_DEFAULT_REGION}" \
  -get=true

# 1. Create the ECR repo and the ACM certificate first.
terraform apply \
  -var-file="${TF_VAR_FILE}" \
  -target=module.ecr_repository \
  -target=module.acm_certificate.aws_acm_certificate.main

# 2. Apply the Cloudflare layer — creates only the ACM validation records on
#    this pass (the API Gateway custom-domain output does not exist yet).
export CLOUDFLARE_API_TOKEN="$(
  aws ssm get-parameter \
    --name "/reference-architecture/cloudflare-api-token" \
    --with-decryption --query Parameter.Value --output text
)"
cd ../terraform/cloudflare
terraform init -reconfigure \
  -backend-config "bucket=${REMOTE_STATE_BUCKET}" \
  -backend-config "key=${TF_STATE_KEY}-cloudflare" \
  -backend-config "region=${AWS_DEFAULT_REGION}" \
  -get=true
terraform apply \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="domain=603.nz" \
  -var="subdomain=reference-architecture-lambda" \
  -var="aws_region=${AWS_DEFAULT_REGION}" \
  -var="aws_state_bucket=${REMOTE_STATE_BUCKET}" \
  -var="aws_state_key=${TF_STATE_KEY}"

# 3. Wait for ACM to be ISSUED, then build and push a FIRST image so the Lambda
#    can be created. (Run from the repo root; needs Docker + ECR login.)
#    --platform must match lambda_architecture (x86_64 → linux/amd64); the
#    Dockerfile builds its toolchain stage natively so this works on Apple Silicon.
cd ../../..
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/reference-architecture-lambda:latest"
aws ecr get-login-password --region "${AWS_DEFAULT_REGION}" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
docker build --platform linux/amd64 -f Dockerfile.lambda -t "${IMAGE_URI}" .
docker push "${IMAGE_URI}"

# 4. Full AWS apply — creates the Lambda from the image, custom domain, CodeBuild,
#    and SSM placeholders.
cd infrastructure/terraform-lambda
terraform apply \
  -var-file="${TF_VAR_FILE}" \
  -var="image_tag=latest"

# 5. Full Cloudflare apply — creates the app CNAME now the target output exists.
cd ../terraform/cloudflare
terraform apply \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="domain=603.nz" \
  -var="subdomain=reference-architecture-lambda" \
  -var="aws_region=${AWS_DEFAULT_REGION}" \
  -var="aws_state_bucket=${REMOTE_STATE_BUCKET}" \
  -var="aws_state_key=${TF_STATE_KEY}"
```

Then set the runtime SSM secrets (the first apply created empty placeholders):

- `/reference-architecture-lambda/cookie-secret` — **required** (cookie signing).
  `openssl rand -hex 32`.
- `/reference-architecture-lambda/resend-api-key` — only needed for real
  magic-link email. The Resend client is constructed lazily on first send
  (see `auth.service.ts`), so with `email_mode = "noop"` the function boots and
  serves with no Resend key required — leave the SSM placeholder as-is. The
  default magic-link profile **does** send email, so give it a real Resend key
  (or a non-empty `re_...` value if you will not exercise login).

```bash
aws ssm put-parameter --overwrite --type SecureString \
  --name /reference-architecture-lambda/cookie-secret --value "$(openssl rand -hex 32)"
```

After bootstrap, pushes to `main` deploy automatically via the
`reference-architecture-lambda` CodeBuild project using `buildspec-lambda.yml`.

## Pipeline flow

`buildspec-lambda.yml` → build → Docker (`Dockerfile.lambda`) push to ECR →
Terraform plan/apply → `aws lambda wait function-updated` → shared Cloudflare
Terraform plan/apply → system validation.

Because images are tagged by commit SHA, each deploy is a new immutable tag;
`terraform apply` updates the function `image_uri` and the waiter blocks until the
new image is live before validation.

## Verify

```bash
curl https://reference-architecture-lambda.603.nz/api/health   # {"data":{"status":"ok"}}
curl https://reference-architecture-lambda.603.nz/api/config   # authProvider:"internal_magic_link"
```

Confirm the ECS demos (e.g. `https://reference-architecture.603.nz`) still report
their own `/api/config` and behave unchanged.

## Notes / trade-offs

- **Secrets at cold start.** The function fetches `COOKIE_SECRET` /
  `RESEND_API_KEY` from SSM by name on cold start (`ssm:GetParameters` +
  scoped `kms:Decrypt`). The simpler alternative — resolving them via
  `data.aws_ssm_parameter` into Lambda env vars — bakes the secret into the
  function config and Terraform state and is intentionally avoided.
- **`AWS_REGION` is not set** in the function env (it is a reserved Lambda key the
  runtime injects; the app reads it back via `ConfigService`).
- **Rate limiting.** `@nestjs/throttler` uses an in-memory store, so limits are
  per warm instance and reset on cold start. Acceptable for the reference;
  externalise the store if you need global limits.
- **Image architecture.** The image must match `lambda_architecture` (`x86_64`).
  CodeBuild builds natively on x86_64, so the pipeline is unaffected. For local
  builds (e.g. bootstrap) on Apple Silicon, pass `--platform linux/amd64` — a
  mismatched image fails at invoke with `Runtime.InvalidEntrypoint`. The builder
  stage uses `$BUILDPLATFORM` so the frontend build never runs under emulation.
- **Compute badge.** The app detects its platform at runtime (Lambda sets
  `AWS_LAMBDA_FUNCTION_NAME`; ECS sets `ECS_CONTAINER_METADATA_URI_V4`) and
  reports it via `GET /api/config`, which the frontend shows as a header badge.
  No Terraform wiring is needed; override with `COMPUTE_PLATFORM` if required.
