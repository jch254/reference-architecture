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
/src/backend         → NestJS API
/src/frontend        → React (Vite)
/src/mobile          → React Native
Dockerfile           → ECS runtime
Dockerfile.lambda    → Lambda (container image) runtime
buildspec.yml        → ECS CI/CD (CodeBuild)
buildspec-lambda.yml → Lambda CI/CD (CodeBuild)
/infrastructure      → deployment (Terraform + Cloudflare)
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
- `GET    /api/example/:id`
- `POST   /api/example`  
- `PATCH  /api/example/:id`  
- `DELETE /api/example/:id`  
- `GET    /api/auth/check`
- `GET    /api/me`

---

## Deployment

Docker + CodeBuild + Terraform. Cloudflare for DNS.

Reusable AWS and Cloudflare infrastructure primitives are composed from [`jch254/terraform-modules`](https://github.com/jch254/terraform-modules), while app-specific configuration stays local in this repo. The AWS and Cloudflare Terraform roots remain separate so DNS can continue to read AWS outputs through remote state.

See [infrastructure/README.md](infrastructure/README.md) for details.

### Compute variants — ECS or Lambda

The same app and the same API Gateway + Cloudflare front door support two
interchangeable compute backends, chosen by which Terraform root a deployment uses:

| Compute | Terraform root | Runtime entrypoint | Buildspec |
|---|---|---|---|
| ECS Fargate (default) | `infrastructure/terraform` | `Dockerfile` → `dist/backend/main.js` | `buildspec.yml` |
| Lambda (container image) | `infrastructure/terraform-lambda` | `Dockerfile.lambda` → `dist/backend/lambda.handler` | `buildspec-lambda.yml` |

App wiring is shared: `src/backend/app.factory.ts` (`createApp()`) builds the Nest
app once, and both `main.ts` (ECS/local — listens) and `lambda.ts` (Lambda —
serverless adapter, no listener) use it, so behaviour does not drift between
backends. The Lambda variant runs the function from a container image behind an API
Gateway HTTP API Lambda-proxy integration (no VPC), reuses the shared Cloudflare
DNS layer, and resolves `COOKIE_SECRET`/`RESEND_API_KEY` from SSM at cold start so
they are never baked into the function config or Terraform state.

`reference-architecture-lambda.603.nz` is a ready-to-deploy demo identity mirroring
the default magic-link profile; see
[infrastructure/terraform-lambda/README.md](infrastructure/terraform-lambda/README.md)
for the bootstrap — a container-image Lambda can't be created until its image is in
ECR, so its first deploy stages an image push. Two Lambda-specific caveats:
`@nestjs/throttler`'s in-memory limits are per warm instance (reset on cold start),
and `AWS_REGION` is injected by the runtime rather than set as an env var.

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

Existing DynamoDB keys remain tenant-aware in both modes: `PK = TENANT#<tenantId>`. Persisted tenant fields such as `tenantSlug` should remain on records that store them. Global app content can live under the configured tenant. Private resources should scope ownership from the local user returned by `/api/me`.

### Authentication providers

Backend authentication is provider-neutral in code, but each deployment chooses one primary provider with `AUTH_PROVIDER=none|internal_magic_link|oidc`. Dual-provider magic-link plus OIDC mode is intentionally not supported yet.

| Env var | Required | Default | Notes |
|---|---|---|---|
| `AUTH_PROVIDER` | no | `internal_magic_link` | `none`, `internal_magic_link`, or `oidc` |
| `OIDC_ISSUER` | when `AUTH_PROVIDER=oidc` | — | Auth0-compatible issuer, e.g. `https://example.auth0.com/` |
| `OIDC_AUDIENCE` | when `AUTH_PROVIDER=oidc` | — | Expected API audience, e.g. `https://api.example.com` or `api://reference` |
| `OIDC_JWKS_URI` | no | derived | Optional explicit JWKS URI, e.g. `https://example.auth0.com/.well-known/jwks.json` |
| `AUTH0_SPA_CLIENT_ID` | no | — | Public Auth0 SPA client id, surfaced to the browser via `GET /api/config` for the frontend Auth0 login flow. Not a secret; never the M2M client id or any client secret |

Tenant resolution and auth provider selection are separate axes. For example, single-product apps should normally use `TENANT_RESOLUTION_MODE=fixed` with `AUTH_PROVIDER=oidc`. Magic-link apps may use `AUTH_PROVIDER=internal_magic_link` with either tenant mode. Auth0-hosted passwordless, social, or passkey choices are external to this backend; the backend only validates OIDC JWTs.

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

`AuthPrincipal` is provider identity, not the local app user. `GET /api/auth/check` stays a lightweight protected route that returns the normalized principal and does not persist users. `GET /api/me` finds or creates a tenant-scoped `User` for the current tenant plus `provider + subject`, updates `lastSeenAt` and safe profile fields, and returns that local user. Email is profile data only: it is not the primary identity key, the same email across providers is not merged, and account linking is out of scope.

User records use the existing single-table layout without a GSI:

```text
PK = TENANT#<tenantId>   SK = USER#<userId>
PK = TENANT#<tenantId>   SK = USER_IDENTITY#<provider>#<sha256(providerSubject)>
```

The identity lookup item makes `/api/me` deterministic without scanning a tenant. Single-product apps should use `/api/me` as the starting point for user-owned data, then store future resources under the resolved tenant and local `userId`.

### User-owned example resources

The example CRUD resource demonstrates the canonical pattern for authenticated, user-owned domain data. `GET/POST/PATCH/DELETE /api/example` routes are protected; `GET /api/health` stays public, `/api/auth/check` remains principal-only, and `/api/me` remains the local-user lookup/creation endpoint.

Example records are owned by the resolved tenant plus the local `User.userId`. Clients can send only domain fields such as `name`; the server ignores client-supplied `tenantId` or `userId` and attaches both owner fields itself:

1. `TenantResolver` stores `tenantId` in request context.
2. `AuthGuard` stores the normalized `AuthPrincipal`.
3. `ExampleService` calls `UsersService.findOrCreateFromPrincipal(tenantId, principal)`.
4. The example item is written under that local `userId`, not the raw provider subject.

The DynamoDB access pattern keeps tenant partitioning and scopes list queries to the current user:

```text
PK = TENANT#<tenantId>   SK = USER#<userId>#EXAMPLE#<exampleId>
```

Listing uses `PK = TENANT#<tenantId>` plus `begins_with(SK, USER#<userId>#EXAMPLE#)`, so it does not scan all tenant examples. Read, update, and delete build the same key from the authenticated local user, so another user in the same tenant receives `404` for someone else's example. The same external provider subject in another tenant maps to a different local user and cannot access the first tenant's data.

This is the same pattern single-product apps should use for saved domain records, favourites, notes, and history: tenant id comes from the deployment/request, ownership comes from the local user model, and email/provider subject remain identity inputs rather than domain owner ids.

### Frontend authentication

The frontend is a single Vite bundle served same-origin by the backend, and the
same bundle ships to every deployment. It does not use build-time `VITE_*` auth
env. Instead it calls a public runtime endpoint at boot:

```bash
curl https://reference-architecture.603.nz/api/config
# { "data": { "authProvider": "internal_magic_link", "auth0": null } }

curl https://reference-architecture-auth0.603.nz/api/config
# { "data": { "authProvider": "oidc",
#   "auth0": { "domain": "...", "clientId": "...", "audience": ".../api" } } }
```

`GET /api/config` is public, tenant-independent, and returns only public values
(the Auth0 SPA client id is public; no secrets are exposed). The frontend then:

- `internal_magic_link` / `none` → renders the existing magic-link demo UI
  unchanged. No Auth0 config is required or loaded.
- `oidc` with a populated `auth0` block → wraps the app in `Auth0Provider`
  (`@auth0/auth0-react`), shows Auth0 Universal Login (login/logout), and
  requests an access token for the configured API `audience`. The API client
  attaches `Authorization: Bearer <access_token>` to `/api/me`, `/api/auth/check`,
  and example CRUD. After login the app bootstraps via `GET /api/me` (the local
  tenant-scoped user); `/api/auth/check` stays available for auth debugging.
- `oidc` with no `auth0` block (missing `AUTH0_SPA_CLIENT_ID`) → the frontend
  shows a clear configuration message instead of a broken login.

Because the auth provider is resolved at runtime, the Auth0 demo build receives
no special frontend env: setting `auth_provider = "oidc"` and
`auth0_spa_client_id` in the deployment's Terraform var file is sufficient. The
existing `reference-architecture.603.nz` demo is unaffected — its
`/api/config` reports `internal_magic_link` and the magic-link UI is preserved.

401s are handled predictably (signed-out state, no retry loop) and access
tokens are never logged.

Current deployment matrix:

| Host | Purpose | Terraform var file | State key | `TENANT_RESOLUTION_MODE` | `APP_TENANT_ID` | `AUTH_PROVIDER` |
|---|---|---|---|---|---|---|
| `reference-architecture.603.nz` | Existing/default demo | `infrastructure/terraform/environments/prod/terraform.tfvars` | `reference-architecture` | `subdomain` | — | `internal_magic_link` |
| `reference-architecture-auth0.603.nz` | Auth0/OIDC backend demo | `infrastructure/terraform/environments/prod-auth0/terraform.tfvars` | `reference-architecture-auth0` | `fixed` | `refarch-auth0-demo` | `oidc` |

The Terraform root still models one deployment identity at a time. The Auth0 demo is a second state/var-file deployment using the same modules and app code, so `reference-architecture.603.nz` keeps its existing resource names and state while `reference-architecture-auth0.603.nz` gets its own ECS service, task definition, API custom domain, certificate, CodeBuild project, SSM placeholders, and DynamoDB table named from `reference-architecture-auth0`.

The Auth0 demo now includes a frontend Auth0 login/logout flow (see [Frontend authentication](#frontend-authentication)). CodeBuild system validation remains disabled for that deployment until a secure bearer-token injection path is configured; the browser flow is verified manually after Auth0 SPA dashboard setup. Public routing can be checked with:

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

To verify local user persistence for the same token, call:

```bash
curl -H "Authorization: Bearer $AUTH_BEARER_TOKEN" \
  https://reference-architecture-auth0.603.nz/api/me
```

Expected success returns `data.user` with `provider: "oidc"` and the fixed deployment tenant id. The smoke validator intentionally remains focused on `/api/auth/check` so CI does not create persistent users unless a future validation step explicitly opts into that.

The automated smoke validator can run the same OIDC check when a bearer token is supplied:

```bash
BASE_URL=https://reference-architecture-auth0.603.nz \
VALIDATION_AUTH_PROVIDER=oidc \
AUTH_BEARER_TOKEN="$AUTH0_ACCESS_TOKEN" \
pnpm run validate
```

`GET /api/auth/check` without a bearer token should return `401` for `AUTH_PROVIDER=oidc`, and the validator checks that negative case. If `AUTH_BEARER_TOKEN` is omitted, OIDC validation runs as a partial smoke check and skips the authenticated request; set `VALIDATION_REQUIRE_AUTH=true` to fail instead. Token acquisition happens outside the validation script, for example with an Auth0 M2M `client_credentials` flow. Do not commit Auth0 client secrets or bearer tokens.

The two public demos use the same `buildspec.yml`, but not the same build execution. After the Auth0 deployment is bootstrapped, pushes to `main` can trigger two independent CodeBuild projects: one with `TF_VAR_FILE=environments/prod/terraform.tfvars` and one with `TF_VAR_FILE=environments/prod-auth0/terraform.tfvars`.

Manual Auth0 dashboard setup for `reference-architecture-auth0.603.nz`:

API (backend token validation):

- Create or choose an Auth0 API and set its identifier to the `oidc_audience` value used in Terraform (`https://reference-architecture-auth0.603.nz/api`).
- Set `oidc_issuer` to the Auth0 tenant issuer, for example `https://your-tenant.region.auth0.com/`.
- Leave `oidc_jwks_uri` unset unless Auth0 requires an explicit JWKS URI override; the backend derives `/.well-known/jwks.json`.

SPA application (frontend browser login):

- Create an Auth0 **Single Page Application** (not the M2M client). The M2M client is only for backend `curl` testing with a `client_credentials` token; the browser login flow must use the SPA application.
- Put the SPA application's client id in `auth0_spa_client_id` in `infrastructure/terraform/environments/prod-auth0/terraform.tfvars`. It is a public value (safe to commit/expose), but deployment-specific. Never put the client secret in Terraform or the frontend.
- Configure the SPA application URLs:
  - Allowed Callback URLs: `https://reference-architecture-auth0.603.nz`
  - Allowed Logout URLs: `https://reference-architecture-auth0.603.nz`
  - Allowed Web Origins: `https://reference-architecture-auth0.603.nz`
  - Allowed Origins (CORS), if prompted: `https://reference-architecture-auth0.603.nz`
- For local development against an OIDC backend, also add `http://localhost:3000` (and `http://localhost:5173` if using the Vite dev server) to the same URL lists.

For the full end-to-end sequence to stand up an Auth0/OIDC deployment — Auth0 dashboard, new deployment identity, staged ACM/DNS bootstrap, runtime SSM secrets (including the always-required `cookie-secret`), first build, and verification — follow the [Provisioning a new Auth0/OIDC deployment](infrastructure/README.md#provisioning-a-new-auth0oidc-deployment) runbook. Apps scaffolded off this repo should follow that runbook end to end; it is written generically (`<app>`/`<host>`/`<zone>`), not just for the demo.

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

### Scaffold decision gate

This repo supports several tenant and auth profiles, but a generated app must
**not** inherit all of them by default. Before scaffolding a new app, decide
the deployment/auth profile explicitly. Treat this as a gate — not a default.

Decide before scaffolding:

1. **Tenant mode** — `fixed` | `subdomain`
2. **Auth provider** — `none` | `internal_magic_link` | `oidc`
3. **Frontend/mobile auth surface** — none | magic-link form | Auth0 SPA/mobile flow
4. **User model needed immediately?** — yes | no

Typical profiles:

| Profile | Tenant mode | `AUTH_PROVIDER` | Auth surface | User model |
|---|---|---|---|---|
| Single product | `fixed` (`APP_TENANT_ID=<app>-prod`/`-test`) | `oidc` | Auth0 SPA/mobile | yes |
| Magic-link / workspace | `subdomain` or `fixed` | `internal_magic_link` | email magic-link | maybe (product-dependent) |
| Public/demo/simple tool | `fixed` | `none` | none | no |

Rule for the scaffold prompt / generator:

> Before scaffolding, choose the deployment/auth profile. Do not scaffold
> unused auth flows. If `AUTH_PROVIDER=oidc`, include only the OIDC/Auth0
> client flow and backend bearer-token assumptions. If
> `AUTH_PROVIDER=internal_magic_link`, include only the magic-link UI/session
> assumptions. If `AUTH_PROVIDER=none`, omit auth UI entirely.

Concretely: a single-product scaffold takes the `oidc` path
([Provisioning a new Auth0/OIDC deployment](infrastructure/README.md#provisioning-a-new-auth0oidc-deployment))
and must **not** carry magic-link UI, subdomain/workspace assumptions, or other
flows just because Reference Architecture also supports them. The runtime
`/api/config` selector means the frontend only activates the chosen provider,
but the unused provider's UI/code should still be dropped from a generated app
rather than shipped dormant.

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
