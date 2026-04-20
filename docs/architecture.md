# Architecture

## Layers

- **Backend** (`/src/backend`) — NestJS API. Stateless, tenant-aware via subdomain. DynamoDB single-table design for persistence. Serves frontend static files.
- **Frontend** (`/src/frontend`) — React + Vite demo UI. Single-page app served from the same container. Tenant extracted from hostname. Interacts with API via same-origin fetch.
- **Mobile** (`/src/mobile`) — React Native client. Consumes the same API. Shares API types via `/src/shared`.
- **Runtime** (`Dockerfile`) — Node.js container. Single process serves both API and frontend.
- **CI/CD** (`buildspec.yml`) — CodeBuild. Build → Docker push → Terraform apply → Cloudflare DNS → system validation.
- **Infrastructure** (`/infrastructure/terraform`) — ECS Fargate behind API Gateway HTTP API with custom domain. DynamoDB table (PAY_PER_REQUEST). Cloudflare for DNS + edge proxy.

## Design decisions

- **Stateless** — no session state, no local disk. Horizontally scalable by default.
- **Tenant-aware** — subdomain resolution via middleware. Tenant ID embedded in every DynamoDB partition key — isolation enforced at the data layer. See [Multi-tenancy](#multi-tenancy) below.
- **Single-table DynamoDB** — all entities in one table. `PK = TENANT#<tenantId>`, `SK = <ENTITY_TYPE>#<entityId>`. No GSIs. No scans.
- **Analytics** — append-only event tracking. Writes to same DynamoDB table (`PK = TENANT#<tenantId>`, `SK = EVENT#<ts>#<name>#<reqId>`). Resolves context via AsyncLocalStorage — callsites pass only event name. Non-blocking (failures logged, never thrown).
- **Single container** — no ALB, no NAT gateway, no background workers. One container serves API (`/api/*`) and frontend (`/*`).
- **Deterministic** — infrastructure fully described in Terraform. No manual steps after initial bootstrap.
- **Rolling deploys** — container health check + grace period ensures new task is healthy before old task is drained.

## Request flow

Client → Cloudflare (TLS + proxy) → API Gateway (custom domain) → VPC Link → Cloud Map → ECS Fargate → NestJS

- `/api/*` → NestJS controllers
- `/*` → static files (Vite build output) with SPA fallback to `index.html`

## Multi-tenancy

The service is fully multi-tenant at every layer. The demo deployment runs on `reference-architecture.603.nz` as a single tenant — all traffic resolves to `tenantSlug = "default"`.

For real implementations, the service should be hosted on an apex domain (e.g. `yoursaas.com`) with a landing page, and each user workspace served from a subdomain (e.g. `acme.yoursaas.com`). Wildcard DNS routes all subdomains to the same service; the first sign-in on a new subdomain bootstraps that tenant automatically.

### How tenant resolution works

`TenantMiddleware` runs on every request and extracts the tenant slug from the subdomain:

| Host header | Resolved `tenantSlug` |
|---|---|
| `acme.yourdomain.com` | `acme` |
| `yourdomain.com` (apex) | `default` |
| `localhost` | `default` |

The resolved slug is attached to `req.tenantSlug` and stored in `AsyncLocalStorage` for the lifetime of the request.

### Data isolation

Every DynamoDB item is partitioned by tenant:

```
PK = TENANT#<tenantSlug>   SK = <ENTITY_TYPE>#<entityId>
```

Queries always include the `PK` condition, so a tenant can never read or write another tenant's data — enforced at the data layer, not just the application layer.

### Auth isolation

- **Magic links** — issued and verified against a specific `tenantSlug`. A link for `acme` cannot be used on `globex`.
- **Sessions** — the session cookie payload includes `tenantSlug`. `AuthGuard` rejects any session whose `tenantSlug` doesn't match the current request's tenant.
- **API tokens** — stored under `TENANT#<tenantSlug>` and validated against the request tenant. Cross-tenant use returns `null`.

