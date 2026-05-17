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

Before applying the Auth0 deployment, set the deployment-specific `oidc_issuer`, `oidc_audience`, and `auth0_spa_client_id` values in `terraform/environments/prod-auth0/terraform.tfvars` (or override with `-var` / `TF_VAR_*`). The Auth0 API audience and issuer must match the access tokens, and the SPA application's callback/logout/web-origin URLs must match the deployment domain because the frontend now runs a browser Auth0 login flow. The Auth0 SPA client id is public and safe to commit; do not commit Auth0 client secrets or bearer tokens.

For the full ordered sequence — including Auth0 dashboard setup, the new deployment identity, the staged ACM/DNS bootstrap, runtime SSM secrets, and verification — follow [Provisioning a new Auth0/OIDC deployment](#provisioning-a-new-auth0oidc-deployment) below. New apps scaffolded off this repo should follow that runbook end to end.

Manual OIDC smoke validation uses a bearer token obtained outside the repo, for example from an Auth0 M2M `client_credentials` flow:

```bash
BASE_URL=https://reference-architecture-auth0.603.nz \
VALIDATION_AUTH_PROVIDER=oidc \
AUTH_BEARER_TOKEN="$AUTH0_ACCESS_TOKEN" \
pnpm run validate
```

For OIDC deployments, the validator also checks that `/api/auth/check` returns `401` without a token. If `AUTH_BEARER_TOKEN` is missing, the authenticated check is skipped unless `VALIDATION_REQUIRE_AUTH=true` is set. CodeBuild validation for the Auth0 deployment remains disabled until a secure token injection path is configured.

The first Auth0 deployment needs the staged ACM/DNS bootstrap described in [terraform/README.md](terraform/README.md). In short: create the ACM certificate, create Cloudflare validation records, wait for the certificate to issue, then run the full AWS and Cloudflare applies. After that, the Auth0 CodeBuild project can handle future pushes like the existing demo.

## Provisioning a new Auth0/OIDC deployment

End-to-end runbook for standing up a new fixed-tenant Auth0/OIDC deployment,
either for the demo or for a new app scaffolded off this repo. Replace
`<app>` with the deployment name (e.g. `myapp-prod`), `<host>` with the full
domain (e.g. `myapp.example.com`), and `<zone>`/`<subdomain>` with the
Cloudflare zone and record. The existing demos are unaffected — this is a new,
additive deployment identity with its own state key, var file, resource name
prefix, DynamoDB table, and CodeBuild project.

### 1. Prerequisites

- AWS credentials for the target account and region.
- Terraform remote-state S3 bucket (this repo uses `jch254-terraform-remote-state`).
- Cloudflare zone for `<zone>` and the Cloudflare API token already stored in
  SSM at the path named by `cloudflare_api_token_ssm_parameter_name`
  (default `/reference-architecture/cloudflare-api-token`).
- Access to the `jch254/terraform-modules` source the roots reference.
- An Auth0 tenant (note its issuer, e.g. `https://<tenant>.<region>.auth0.com/`).

### 2. Auth0 dashboard setup

In the Auth0 tenant:

1. **API** (backend token validation): create/choose an API whose
   **Identifier** is the value you will set as `oidc_audience`
   (convention here: `https://<host>/api`). The Auth0 tenant issuer becomes
   `oidc_issuer`. Leave `oidc_jwks_uri` unset unless Auth0 needs an explicit
   override; the backend derives `/.well-known/jwks.json`.
2. **SPA application** (frontend browser login): create a **Single Page
   Application**. Record its **Client ID** for `auth0_spa_client_id`
   (public, safe to commit; never the client secret). Set, all to
   `https://<host>` (add `http://localhost:3000` and `http://localhost:5173`
   for local OIDC dev):
   - Allowed Callback URLs
   - Allowed Logout URLs
   - Allowed Web Origins
   - Allowed Origins (CORS), if prompted
3. **M2M application** (optional, for backend `curl`/CI smoke checks only):
   create a Machine-to-Machine application and authorize it for the API from
   step 1. This is only for `client_credentials` bearer tokens used to call
   `/api/auth/check`; it is **not** the frontend login client and its secret
   must never go in Terraform, the frontend, or git.

Account linking, Organizations, RBAC, and passwordless/passkey choices are out
of scope — the backend only validates OIDC JWTs by signature, issuer,
audience, expiry, and `sub`.

### 3. Create the deployment identity

Copy `terraform/environments/prod-auth0/terraform.tfvars` to
`terraform/environments/<app>/terraform.tfvars` and set:

- `name = "<app>"` (drives resource names and the `<app>-entities` table)
- `terraform_state_key = "<app>"`
- `terraform_var_file = "environments/<app>/terraform.tfvars"`
- `cache_bucket = "<codebuild-cache-bucket>/<app>"`
- `tenant_resolution_mode = "fixed"` and `app_tenant_id = "<logical-tenant>"`
- `auth_provider = "oidc"`
- `oidc_issuer`, `oidc_audience` (= `https://<host>/api`), `auth0_spa_client_id`
- `cloudflare_domain = "<zone>"`, `cloudflare_subdomain = "<subdomain>"`,
  `dns_name = "<host>"`
- `resend_from_email` (only used if the deployment sends email)
- `run_system_validation = false` until a secure CodeBuild bearer-token
  injection path exists

Leaving `auth0_spa_client_id` unset deploys the OIDC backend but the frontend
shows a "missing Auth0 SPA settings" message instead of a broken login.

### 4. Staged ACM/DNS bootstrap (first deploy only)

Follow [terraform/README.md → Bootstrap](terraform/README.md#bootstrap) using
this deployment's `TF_STATE_KEY=<app>`,
`TF_VAR_FILE=environments/<app>/terraform.tfvars`, and Cloudflare
`subdomain=<subdomain>`: apply the ACM certificate, apply the Cloudflare layer
(validation records only on this pass), wait for ACM to issue, then run the
full AWS apply followed by the full Cloudflare apply. The first full AWS apply
also creates this deployment's ECS service, DynamoDB table, SSM placeholders,
and CodeBuild project + webhook.

### 5. Runtime secrets (SSM)

The first AWS apply creates empty SSM **placeholders**; the ECS task will not
be healthy until they hold real values:

- `/<app>/cookie-secret` — **required for every deployment** (used to sign
  cookies even in OIDC mode). Generate with `openssl rand -hex 32`.
- `/<app>/resend-api-key` — required only if the deployment sends email.
  Pure Auth0/OIDC deployments do not send magic-link email; set this to any
  non-empty placeholder and set `EMAIL_MODE=noop` for that deployment, or
  supply a real Resend key if email is needed.

Put values in with `aws ssm put-parameter --overwrite --type SecureString`,
then force a new ECS deployment so tasks pick them up. No Auth0 secret is
stored here — the SPA client id is public config, not a secret.

### 6. First build and ongoing deploys

The first CodeBuild run (triggered by the webhook on push to `main`, or run
manually) builds and pushes the image and completes the Terraform apply. After
that, pushes to `main` deploy automatically. Each deployment identity runs its
own CodeBuild project with its own state key and var file, so demos deploy
independently.

### 7. Verify

```bash
curl https://<host>/api/health        # {"data":{"status":"ok"}}
curl https://<host>/api/config        # authProvider:"oidc" + auth0:{domain,clientId,audience}
curl https://<host>/api/auth/check    # 401 without a token
```

Then in a browser at `https://<host>`: the login button shows when signed
out; Auth0 Universal Login completes and returns to the app; `/api/me` returns
the local tenant-scoped user; example CRUD works; logout works. Network calls
carry `Authorization: Bearer <token>` and no token appears in console logs.
Optionally, with an M2M `client_credentials` token:

```bash
curl -H "Authorization: Bearer $AUTH0_ACCESS_TOKEN" https://<host>/api/auth/check
```

Confirm existing deployments (e.g. `https://reference-architecture.603.nz`)
still report their own `/api/config` and behave unchanged.

If the browser console shows a CSP error blocking the Cloudflare analytics
beacon (`static.cloudflareinsights.com` / `cloudflareinsights.com`), redeploy
with the latest backend image — older images did not include those origins.

If the browser console shows a CSP error blocking
`https://<auth0-domain>/oauth/token` (`connect-src`/`frame-src`), the
deployment's `OIDC_ISSUER` is wrong or missing: the backend derives the
allowed Auth0 origin from it and only opens CSP when `AUTH_PROVIDER=oidc`.
Fix the issuer and redeploy rather than weakening CSP globally.
