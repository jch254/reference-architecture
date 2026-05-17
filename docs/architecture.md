# Architecture

## Layers

- **Backend** (`/src/backend`) — NestJS API. Stateless, tenant-aware via configurable tenant resolution. DynamoDB single-table design for persistence. Serves frontend static files.
- **Frontend** (`/src/frontend`) — React + Vite demo UI. Single-page app served from the same container. Interacts with API via same-origin fetch.
- **Mobile** (`/src/mobile`) — React Native client. Consumes the same API. Shares API types via `/src/shared`.
- **Runtime** (`Dockerfile`) — Node.js container. Single process serves both API and frontend.
- **CI/CD** (`buildspec.yml`) — CodeBuild. Build → Docker push → Terraform apply → Cloudflare DNS → system validation where enabled. Each deployment identity runs its own CodeBuild project with its own Terraform state key and var file.
- **Infrastructure** (`/infrastructure/terraform`) — ECS Fargate behind API Gateway HTTP API with custom domain. DynamoDB table (PAY_PER_REQUEST). Cloudflare for DNS + edge proxy. Reusable primitives are composed from `jch254/terraform-modules`; app-specific configuration remains local.

## Design decisions

- **Stateless** — no session state, no local disk. Horizontally scalable by default.
- **Tenant-aware** — configurable tenant resolution via middleware. Tenant ID embedded in every DynamoDB partition key — logical isolation enforced at the data layer. See [Tenant resolution modes](#tenant-resolution-modes) below.
- **Single-table DynamoDB** — all entities in one table. `PK = TENANT#<tenantId>`, `SK = <ENTITY_TYPE>#<entityId>`. No GSIs. No scans.
- **Analytics** — append-only event tracking. Writes to same DynamoDB table (`PK = TENANT#<tenantId>`, `SK = EVENT#<ts>#<name>#<reqId>`). Resolves context via AsyncLocalStorage — callsites pass only event name. Non-blocking (failures logged, never thrown).
- **Single container** — no ALB, no NAT gateway, no background workers. One container serves API (`/api/*`) and frontend (`/*`).
- **Deterministic** — infrastructure fully described in Terraform. AWS and Cloudflare are separate Terraform roots, with Cloudflare reading AWS outputs through remote state. No manual steps after initial bootstrap.
- **Rolling deploys** — container health check + grace period ensures new task is healthy before old task is drained.

## Request flow

Client → Cloudflare (TLS + proxy) → API Gateway (custom domain) → VPC Link → Cloud Map → ECS Fargate → NestJS

- `/api/*` → NestJS controllers
- `/*` → static files (Vite build output) with SPA fallback to `index.html`

Tenant resolution and authentication are separate request concerns. `TenantMiddleware` resolves the runtime tenant first and stores it on the request context. `AuthGuard` then resolves an authenticated principal for protected routes. The auth principal is never used to choose the tenant.

## Tenant Resolution Modes

Reference Architecture supports two tenant resolution modes through `TENANT_RESOLUTION_MODE`.

`TENANT_RESOLUTION_MODE` only controls how the runtime resolves `tenantId` for a request. Physical isolation is controlled by the deployed DynamoDB table name and Terraform deployment. `APP_TENANT_ID` is not a substitute for product/environment table isolation.

### Fixed Mode

`TENANT_RESOLUTION_MODE=fixed` is for single-product apps. It requires `APP_TENANT_ID`, ignores `Host`, and resolves every request to that fixed tenant id.

Use a deployment-specific DynamoDB table for each fixed-mode product/environment. The fixed tenant id is the logical key prefix inside that table; it is not a reason to share one physical table across unrelated products or environments.

For example:

| Deployment host | DynamoDB table | `TENANT_RESOLUTION_MODE` | `APP_TENANT_ID` | Keys |
|---|---|---|---|---|
| `app.example.com` | `product-prod` | `fixed` | `product-prod` | `TENANT#product-prod` |
| `test.example.com` | `product-test` | `fixed` | `product-test` | `TENANT#product-test` |

Single-product deployments do not need to expose tenant, workspace, or organization concepts to users. Tenancy remains an internal storage boundary.

### Subdomain Mode

`TENANT_RESOLUTION_MODE=subdomain` is for SaaS or workspace-style apps. It does not require `APP_TENANT_ID`. `TenantResolver` derives the tenant from the request host using `BASE_DOMAIN`, preserving the original Reference Architecture behavior:

| Host header | Resolved `tenantSlug` |
|---|---|
| `acme.yourdomain.com` | `acme` |
| `yourdomain.com` (apex) | `default` |
| `localhost` | `default` |

In subdomain mode, one product/environment table can intentionally contain many runtime tenant partitions:

| Deployment hosts | DynamoDB table | `TENANT_RESOLUTION_MODE` | Keys |
|---|---|---|---|
| `*.example.com` | `product-prod` | `subdomain` | `TENANT#acme`, `TENANT#demo`, `TENANT#jordan` |

### How tenant resolution works

`TenantMiddleware` runs on every request and resolves the active tenant through `TenantResolver`. In fixed mode it returns `APP_TENANT_ID`; in subdomain mode it parses the request host. The resolved id is attached to `req.tenantSlug` and stored in `AsyncLocalStorage` for the lifetime of the request.

### Data isolation

Every DynamoDB item is partitioned by tenant:

```
PK = TENANT#<tenantSlug>   SK = <ENTITY_TYPE>#<entityId>
```

Queries always include the `PK` condition, so a tenant can never read or write another tenant's data — enforced at the data layer, not just the application layer.

Both fixed and subdomain modes preserve the same key shape. Fixed mode still writes and queries `TENANT#<APP_TENANT_ID>` inside that deployment's table. Subdomain mode writes and queries `TENANT#<subdomainTenant>` inside the product/environment table. Table name/configuration is independent of the resolved runtime tenant; do not route each request to a different table based on tenant.

Persisted tenant fields such as `tenantSlug` should remain on records that store them in both modes. Do not remove tenant attributes or `TENANT#` prefixes just because a deployment uses fixed mode.

Global app content can live under the configured tenant. Private future resources should still be scoped by `tenantId + userId` once auth/user ownership is added.

### Auth isolation

- **Magic links** — issued and verified against the resolved tenant id. A test-environment link cannot be used against a prod deployment, and a subdomain tenant link cannot be used on another subdomain.
- **Sessions** — the session cookie payload includes `tenantSlug`. `AuthGuard` rejects any session whose `tenantSlug` doesn't match the current request's tenant.
- **API tokens** — stored under `TENANT#<tenantSlug>` and validated against the request tenant. Cross-tenant use returns `null`.
- **OIDC/Auth0 JWTs** — validated by signature, issuer, audience, expiration, and `sub`. OIDC claims are mapped into a small `AuthPrincipal`; tenant/org/custom claims are ignored for tenancy.

## Authentication Providers

Reference Architecture supports multiple backend auth strategies in code, while each deployment chooses exactly one primary provider with `AUTH_PROVIDER=none|internal_magic_link|oidc`. Dual-provider magic-link plus OIDC mode is intentionally not supported yet; a future multi-provider mode would need explicit account-linking and precedence semantics.

### Provider config

| Env var | Required | Default | Notes |
|---|---|---|---|
| `AUTH_PROVIDER` | no | `internal_magic_link` | `none`, `internal_magic_link`, or `oidc` |
| `OIDC_ISSUER` | when `AUTH_PROVIDER=oidc` | — | Auth0-compatible issuer, e.g. `https://example.auth0.com/` |
| `OIDC_AUDIENCE` | when `AUTH_PROVIDER=oidc` | — | Expected API audience, e.g. `https://api.example.com` or `api://reference` |
| `OIDC_JWKS_URI` | no | derived | Optional explicit JWKS URI, e.g. `https://example.auth0.com/.well-known/jwks.json` |

`AUTH_PROVIDER=none` and `AUTH_PROVIDER=internal_magic_link` do not require OIDC settings. `AUTH_PROVIDER=oidc` requires `OIDC_ISSUER` and `OIDC_AUDIENCE`; if `OIDC_JWKS_URI` is omitted, the backend derives `/.well-known/jwks.json` from the issuer. Legacy `MAGIC_LINK_AUTH_ENABLED` and `OIDC_AUTH_ENABLED` flags are ignored in favor of `AUTH_PROVIDER`.

Tenant resolution and auth provider selection are separate axes:

```bash
TENANT_RESOLUTION_MODE=fixed
AUTH_PROVIDER=oidc
```

```bash
TENANT_RESOLUTION_MODE=subdomain
AUTH_PROVIDER=internal_magic_link
```

Handscape-style single-product apps should normally use `TENANT_RESOLUTION_MODE=fixed` and `AUTH_PROVIDER=oidc`. Namaste/Lush-style apps may use `AUTH_PROVIDER=internal_magic_link`. Auth0-hosted passwordless, social, or passkey choices are external to this backend; the backend only validates OIDC access tokens.

### Principal shape

Valid auth from either provider is normalized into `AuthPrincipal`:

```ts
{
	provider: 'internal_magic_link' | 'oidc',
	subject: string,
	email?: string,
	name?: string,
	picture?: string,
}
```

For OIDC, `subject` comes from JWT `sub`. For magic-link/session/API-token auth, `subject` is the normalized email used by the existing flow. Auth0 SDK types and provider-specific claim bags are not exposed to domain services.

### Protected and public routes

`AuthGuard` is registered globally. Routes are protected unless marked with `@Public()`.

- Public routes include `GET /api/health`, `GET /api/example`, `POST /api/auth/request-link`, and `GET /api/auth/verify`.
- Protected routes can read the principal with `@CurrentPrincipal()` in controllers.
- Services can read the request principal through `AuthContext.getPrincipal()` or require one with `AuthContext.requirePrincipal()`.
- `GET /api/auth/check` is the minimal protected auth-check endpoint for validating the route pattern; it is not a user profile endpoint and does not persist users.

`AUTH_PROVIDER=internal_magic_link` accepts existing opaque magic-link API bearer tokens and signed session cookies. Compact OIDC JWTs are rejected in this mode. `AUTH_PROVIDER=oidc` accepts valid OIDC JWT bearer tokens and rejects magic-link bearer tokens or session cookies. `AUTH_PROVIDER=none` does not create authenticated principals for protected routes.

### Tenant separation

Authentication must not control tenancy:

- Tenant comes only from `TenantResolver` and `TENANT_RESOLUTION_MODE`.
- Fixed mode continues to ignore `Host` and uses `APP_TENANT_ID`.
- Subdomain mode continues to derive tenant from `Host`.
- JWT tenant, organization, or custom claims are ignored for tenant resolution.
- Auth0 Organizations are not used by default.
- No workspace, organization routing, RBAC, or user persistence is part of the reference backend auth layer.

### Public demo deployments

The public demos are separate deployment identities rather than one mixed-provider deployment:

| Host | Purpose | Terraform var file | State key | `TENANT_RESOLUTION_MODE` | `APP_TENANT_ID` | `AUTH_PROVIDER` |
|---|---|---|---|---|---|---|
| `reference-architecture.603.nz` | Existing/default demo | `infrastructure/terraform/environments/prod/terraform.tfvars` | `reference-architecture` | `subdomain` | — | `internal_magic_link` |
| `reference-architecture-auth0.603.nz` | Auth0/OIDC backend demo | `infrastructure/terraform/environments/prod-auth0/terraform.tfvars` | `reference-architecture-auth0` | `fixed` | `refarch-auth0-demo` | `oidc` |

The Auth0 deployment uses its own DynamoDB table, derived from `name = "reference-architecture-auth0"`, while preserving the logical tenant key `PK = TENANT#refarch-auth0-demo`. It does not select tables dynamically from request tenants.

The Auth0 demo is backend-only until a frontend Auth0 login flow is added. Public routing should return the standard health response:

```bash
curl https://reference-architecture-auth0.603.nz/api/health
```

Verify OIDC with a real Auth0 access token for the configured audience:

```bash
curl -H "Authorization: Bearer $AUTH0_ACCESS_TOKEN" \
  https://reference-architecture-auth0.603.nz/api/auth/check
```

Auth0 dashboard setup is manual: configure an API audience matching `OIDC_AUDIENCE`, use the Auth0 tenant issuer as `OIDC_ISSUER`, and only add callback/logout/origin URLs when a browser login flow is introduced. For that future flow, use `https://reference-architecture-auth0.603.nz` as the origin/logout base.

The public demos share app code and `buildspec.yml`, but deploy as separate CodeBuild runs. Future pushes to `main` can run both deployment identities in parallel once both CodeBuild webhooks exist.
