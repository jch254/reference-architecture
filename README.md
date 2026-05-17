# Reference Architecture

Minimal, production-ready backend architecture.

- NestJS + DynamoDB + Docker + CodeBuild + IaC  
- multi-tenant data layer  
- append-only analytics instrumentation  
- no domain logic  
- no async/background systems  

**Live demos:**

- [reference-architecture.603.nz](https://reference-architecture.603.nz)
- [reference-architecture-auth0.603.nz](https://reference-architecture-auth0.603.nz) — Auth0/OIDC backend demo

---

## Architecture

```
/src/backend      → NestJS API
/src/frontend     → React (Vite)
/src/mobile       → React Native
Dockerfile        → runtime
buildspec.yml     → CI/CD (CodeBuild)
/infrastructure   → deployment (Terraform + Cloudflare)
```

---

## Principles

- stateless API  
- tenant-aware data model  
- configurable tenant resolution
- minimal and explicit  
- no overengineering  
- append-only analytics  

---

## Design Constraints

This architecture follows the core ideas of the [Twelve-Factor App](https://12factor.net) where they still hold, with deliberate trade-offs for simplicity and cost.

### What is enforced

- **Stateless compute**  
  Services run as disposable containers. No in-memory state is required for correctness.

- **Externalised state**  
  All persistence lives in DynamoDB or external services.

- **Config via environment**  
  Runtime behaviour is controlled through environment variables.

- **Build / release / run separation**  
  Docker images are built once and promoted across environments.

---

### Intentional deviations

- **DynamoDB single-table design**  
  Data model is coupled to access patterns. Not portable by design.

- **AWS-native infrastructure**  
  API Gateway, ECS, and Cloud Map are used directly. Portability is not a goal.

- **No async systems**  
  This reference avoids queues and background workers. These are added at the application layer when needed.

- **Multi-tenancy as a first-class constraint**  
  Tenant isolation is enforced at the data and service layers.

- **Tenant resolution by deployment**
  Single-product apps can use a fixed tenant id, while SaaS/workspace-style apps can keep subdomain tenant resolution.

---

### Guiding invariant

> Any service instance can be terminated and replaced without data loss.

---

## Endpoints

- `GET    /api/health`  
- `GET    /api/example`  
- `POST   /api/example`  
- `PATCH  /api/example/:id`  
- `DELETE /api/example/:id`  
- `GET    /api/auth/check`

---

## Deployment

Docker + CodeBuild + Terraform. Cloudflare for DNS.

Reusable AWS and Cloudflare infrastructure primitives are composed from [`jch254/terraform-modules`](https://github.com/jch254/terraform-modules), while app-specific configuration stays local in this repo. The AWS and Cloudflare Terraform roots remain separate so DNS can continue to read AWS outputs through remote state.

See [infrastructure/README.md](infrastructure/README.md) for details.

### Tenant resolution modes

Set `TENANT_RESOLUTION_MODE` for each deployment:

| Mode | Required config | Use when |
|---|---|---|
| `fixed` | `APP_TENANT_ID` | One product/deployment maps to one internal tenant |
| `subdomain` | `BASE_DOMAIN` | Tenants are derived from workspace subdomains |

Tenant resolution is runtime logic only. DynamoDB table name and Terraform deployment control physical isolation. `APP_TENANT_ID` is not a substitute for a product/environment-specific table.

Fixed mode examples:

| Host | Table | `TENANT_RESOLUTION_MODE` | `APP_TENANT_ID` | Keys |
|---|---|---|---|---|
| `app.example.com` | `product-prod` | `fixed` | `product-prod` | `TENANT#product-prod` |
| `test.example.com` | `product-test` | `fixed` | `product-test` | `TENANT#product-test` |

In fixed mode, use one DynamoDB table per product/environment deployment. The tenant id represents the deployment/environment, not a user-facing workspace. Single-product deployments do not need to expose tenant, workspace, or organization concepts to users.

Subdomain mode preserves the original Reference Architecture pattern: `acme.yourdomain.com` resolves to tenant `acme`, while the apex domain and localhost resolve to `default`. In subdomain mode, a product/environment can intentionally share one table across many runtime tenants:

| Host pattern | Table | `TENANT_RESOLUTION_MODE` | Keys |
|---|---|---|---|
| `*.example.com` | `product-prod` | `subdomain` | `TENANT#acme`, `TENANT#demo`, `TENANT#jordan` |

Existing DynamoDB keys remain tenant-aware in both modes: `PK = TENANT#<tenantId>`. Persisted tenant fields such as `tenantSlug` should remain on records that store them. Global app content can live under the configured tenant. Private future resources should still add `userId` scoping once auth/user ownership is added.

### Authentication providers

Backend authentication is provider-neutral in code, but each deployment chooses one primary provider with `AUTH_PROVIDER=none|internal_magic_link|oidc`. Dual-provider magic-link plus OIDC mode is intentionally not supported yet.

| Env var | Required | Default | Notes |
|---|---|---|---|
| `AUTH_PROVIDER` | no | `internal_magic_link` | `none`, `internal_magic_link`, or `oidc` |
| `OIDC_ISSUER` | when `AUTH_PROVIDER=oidc` | — | Auth0-compatible issuer, e.g. `https://example.auth0.com/` |
| `OIDC_AUDIENCE` | when `AUTH_PROVIDER=oidc` | — | Expected API audience, e.g. `https://api.example.com` or `api://reference` |
| `OIDC_JWKS_URI` | no | derived | Optional explicit JWKS URI, e.g. `https://example.auth0.com/.well-known/jwks.json` |

Tenant resolution and auth provider selection are separate axes. For example, Handscape-style single-product apps should normally use `TENANT_RESOLUTION_MODE=fixed` with `AUTH_PROVIDER=oidc`. Namaste/Lush-style apps may use `AUTH_PROVIDER=internal_magic_link` with either tenant mode. Auth0-hosted passwordless, social, or passkey choices are external to this backend; the backend only validates OIDC JWTs.

Protected backend routes use the global `AuthGuard`. Mark public endpoints with `@Public()`. Controllers can read the normalized principal with `@CurrentPrincipal()`, and services can use `AuthContext.getPrincipal()` or `AuthContext.requirePrincipal()`.

The active provider normalizes into:

```ts
{
  provider: 'internal_magic_link' | 'oidc',
  subject: string,
  email?: string,
  name?: string,
  picture?: string,
}
```

`AUTH_PROVIDER=internal_magic_link` accepts the existing opaque magic-link API bearer tokens and signed session cookies. `AUTH_PROVIDER=oidc` accepts compact OIDC JWT bearer tokens only. `AUTH_PROVIDER=none` leaves protected routes closed unless the route is explicitly public.

Authentication does not control tenancy. Tenant id still comes only from `TenantResolver` according to `TENANT_RESOLUTION_MODE`; JWT tenant, organization, or custom claims are ignored for tenant resolution. Auth0 Organizations are not used by default.

Current deployment matrix:

| Host | Purpose | Terraform var file | State key | `TENANT_RESOLUTION_MODE` | `APP_TENANT_ID` | `AUTH_PROVIDER` |
|---|---|---|---|---|---|---|
| `reference-architecture.603.nz` | Existing/default demo | `infrastructure/terraform/environments/prod/terraform.tfvars` | `reference-architecture` | `subdomain` | — | `internal_magic_link` |
| `reference-architecture-auth0.603.nz` | Auth0/OIDC backend demo | `infrastructure/terraform/environments/prod-auth0/terraform.tfvars` | `reference-architecture-auth0` | `fixed` | `refarch-auth0-demo` | `oidc` |

The Terraform root still models one deployment identity at a time. The Auth0 demo is a second state/var-file deployment using the same modules and app code, so `reference-architecture.603.nz` keeps its existing resource names and state while `reference-architecture-auth0.603.nz` gets its own ECS service, task definition, API custom domain, certificate, CodeBuild project, SSM placeholders, and DynamoDB table named from `reference-architecture-auth0`.

The Auth0 demo is backend-only for now. The frontend does not include an Auth0 login/logout flow yet, so post-deploy magic-link validation is disabled for that deployment. Public routing can be checked with:

```bash
curl https://reference-architecture-auth0.603.nz/api/health
```

Expected success returns `{"data":{"status":"ok"}}`.

To verify OIDC auth manually, fetch a real Auth0 access token for the configured API audience and call:

```bash
curl -H "Authorization: Bearer $AUTH0_ACCESS_TOKEN" \
  https://reference-architecture-auth0.603.nz/api/auth/check
```

Expected success returns `authenticated: true` with an OIDC principal. Magic-link bearer tokens and session cookies should be rejected by this deployment.

The two public demos use the same `buildspec.yml`, but not the same build execution. After the Auth0 deployment is bootstrapped, pushes to `main` can trigger two independent CodeBuild projects: one with `TF_VAR_FILE=environments/prod/terraform.tfvars` and one with `TF_VAR_FILE=environments/prod-auth0/terraform.tfvars`.

Manual Auth0 dashboard setup for `reference-architecture-auth0.603.nz`:

- Create or choose an Auth0 API and set its identifier to the `oidc_audience` value used in Terraform.
- Set `oidc_issuer` to the Auth0 tenant issuer, for example `https://your-tenant.region.auth0.com/`.
- Leave `oidc_jwks_uri` unset unless Auth0 requires an explicit JWKS URI override; the backend derives `/.well-known/jwks.json`.
- If a future browser login is added, use `https://reference-architecture-auth0.603.nz` for allowed web origins and logout URLs, and add the future callback URL used by that frontend flow. No callback URL is required for the current backend-only bearer-token check.

---

## Running locally

Backend:

```bash
pnpm install
pnpm run start:dev
```

Frontend (separate terminal):

```bash
cd src/frontend
pnpm install
pnpm run dev
```

Frontend dev server proxies `/api` requests to the backend on port 3000.

Production-like (single process):

```
pnpm run build
cd src/frontend && pnpm run build && cd ../.. 
pnpm run start:prod
```

Docker:

```
docker compose up --build
```

Starts the app, DynamoDB Local, and creates the table automatically.

## Usage
- used as a reference architecture, not a product
- copied and adapted for new apps

## What this is (and isn’t)

This is a baseline:

- proven deployment model
- consistent data patterns
- predictable runtime behaviour

It does not include:

- business/domain logic
- async pipelines or workflows
- complex orchestration

Those are layered on top per application.
