# Infrastructure

Two deployment layers, applied sequentially via CodeBuild.

## Structure

```
/infrastructure/terraform             → AWS (ECS, API Gateway, DynamoDB, ECR)
/infrastructure/terraform/cloudflare  → DNS (Cloudflare CNAME → API Gateway)
```

## Flow

CodeBuild builds and pushes the Docker image, then applies the AWS Terraform layer. Once ECS stabilises, it applies the Cloudflare layer. This flow runs once per deployment identity; the magic-link demo and Auth0 demo use separate CodeBuild projects with separate Terraform state keys and var files.

## Layer relationship

- AWS layer provisions compute, networking, and the API Gateway custom domain
- Cloudflare layer reads AWS outputs (via remote state) and creates DNS records pointing to API Gateway
- Cloudflare handles TLS termination and edge proxying

## Module relationship

Reusable infrastructure primitives are owned by `jch254/terraform-modules`. This repository composes those modules into a runnable public scaffold and keeps app-specific choices local: names, domains, environment variables, secrets, notification wiring, image tags, and deployment flow.

AWS and Cloudflare intentionally remain separate Terraform roots. The AWS root produces API Gateway and ACM outputs; the Cloudflare root consumes those outputs through remote state and manages only the DNS records for this scaffold.

The Terraform `moved.tf` files are intentionally retained. They document the state-safe migration history and let Terraform preserve deployed resource identity when planning against existing state.

Downstream app repos can adopt the same modules later when useful, but this scaffold is a reference rather than an automatic migration mandate. SES, mail provider records, Cloudflare security rules, build notifications, and other product-specific infrastructure stay outside this reusable-core migration.

See each layer's README for specifics.

## Deployments

| Domain | Purpose | AWS state key | Var file | Cloudflare state key |
| --- | --- | --- | --- | --- |
| `reference-architecture.603.nz` | Existing/default demo | `reference-architecture` | `infrastructure/terraform/environments/prod/terraform.tfvars` | `reference-architecture-cloudflare` |
| `reference-architecture-auth0.603.nz` | Fixed-tenant Auth0/OIDC backend demo | `reference-architecture-auth0` | `infrastructure/terraform/environments/prod-auth0/terraform.tfvars` | `reference-architecture-auth0-cloudflare` |

The Auth0 demo is a separate deployment identity, not a rename of the existing demo. It uses the same Terraform roots and modules with a different state key, resource name prefix, DNS name, and DynamoDB table. Tenant resolution and auth provider selection remain separate axes:

- `reference-architecture.603.nz` keeps `TENANT_RESOLUTION_MODE=subdomain` and `AUTH_PROVIDER=internal_magic_link`.
- `reference-architecture-auth0.603.nz` uses `TENANT_RESOLUTION_MODE=fixed`, `APP_TENANT_ID=refarch-auth0-demo`, and `AUTH_PROVIDER=oidc`.

Before applying the Auth0 deployment, replace the placeholder `oidc_issuer` and `oidc_audience` values in `terraform/environments/prod-auth0/terraform.tfvars` or override them with `-var` / `TF_VAR_*` values. Do not commit Auth0 secrets. The current backend-only OIDC demo does not need a frontend callback URL, but the Auth0 API audience and issuer must match the access tokens used to call `/api/auth/check`.

Manual OIDC smoke validation uses a bearer token obtained outside the repo, for example from an Auth0 M2M `client_credentials` flow:

```bash
BASE_URL=https://reference-architecture-auth0.603.nz \
VALIDATION_AUTH_PROVIDER=oidc \
AUTH_BEARER_TOKEN="$AUTH0_ACCESS_TOKEN" \
pnpm run validate
```

For OIDC deployments, the validator also checks that `/api/auth/check` returns `401` without a token. If `AUTH_BEARER_TOKEN` is missing, the authenticated check is skipped unless `VALIDATION_REQUIRE_AUTH=true` is set. CodeBuild validation for the Auth0 deployment remains disabled until a secure token injection path is configured.

The first Auth0 deployment needs the staged ACM/DNS bootstrap described in [terraform/README.md](terraform/README.md). In short: create the ACM certificate, create Cloudflare validation records, wait for the certificate to issue, then run the full AWS and Cloudflare applies. After that, the Auth0 CodeBuild project can handle future pushes like the existing demo.
