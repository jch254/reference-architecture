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
- **Tenant-aware** — subdomain resolution via middleware. Tenant ID embedded in every DynamoDB partition key — isolation enforced at the data layer.
- **Single-table DynamoDB** — all entities in one table. `PK = TENANT#<tenantId>`, `SK = <ENTITY_TYPE>#<entityId>`. No GSIs. No scans.
- **Analytics** — append-only event tracking. Writes to same DynamoDB table (`PK = TENANT#<tenantId>`, `SK = EVENT#<ts>#<name>#<reqId>`). Resolves context via AsyncLocalStorage — callsites pass only event name. Non-blocking (failures logged, never thrown).
- **Single container** — no ALB, no NAT gateway, no background workers. One container serves API (`/api/*`) and frontend (`/*`).
- **Deterministic** — infrastructure fully described in Terraform. No manual steps after initial bootstrap.
- **Rolling deploys** — container health check + grace period ensures new task is healthy before old task is drained.

## Request flow

Client → Cloudflare (TLS + proxy) → API Gateway (custom domain) → VPC Link → Cloud Map → ECS Fargate → NestJS

- `/api/*` → NestJS controllers
- `/*` → static files (Vite build output) with SPA fallback to `index.html`
