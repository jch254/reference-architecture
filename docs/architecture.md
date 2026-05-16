# Architecture

## Layers

- **Backend** (`/src/backend`) — NestJS API. Stateless, tenant-aware via configurable tenant resolution. DynamoDB single-table design for persistence. Serves frontend static files.
- **Frontend** (`/src/frontend`) — React + Vite demo UI. Single-page app served from the same container. Interacts with API via same-origin fetch.
- **Mobile** (`/src/mobile`) — React Native client. Consumes the same API. Shares API types via `/src/shared`.
- **Runtime** (`Dockerfile`) — Node.js container. Single process serves both API and frontend.
- **CI/CD** (`buildspec.yml`) — CodeBuild. Build → Docker push → Terraform apply → Cloudflare DNS → system validation.
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
