# Architecture

## Layers

- **Application** (`/src`) — NestJS API. Stateless, tenant-aware via subdomain. DynamoDB single-table design for persistence.
- **Runtime** (`Dockerfile`) — Node.js container. Single process, no sidecar.
- **CI/CD** (`buildspec.yml`) — CodeBuild. Build → Docker push → Terraform apply → Cloudflare DNS.
- **Infrastructure** (`/infrastructure/terraform`) — ECS Fargate behind API Gateway HTTP API with custom domain. DynamoDB table (PAY_PER_REQUEST). Cloudflare for DNS + edge proxy.

## Design decisions

- **Stateless** — no session state, no local disk. Horizontally scalable by default.
- **Tenant-aware** — subdomain resolution via middleware. Tenant ID embedded in every DynamoDB partition key — isolation enforced at the data layer.
- **Single-table DynamoDB** — all entities in one table. `PK = TENANT#<tenantId>`, `SK = <ENTITY_TYPE>#<entityId>`. No GSIs. No scans.
- **Minimal** — no ALB, no NAT gateway, no background workers. Single container, single service.
- **Deterministic** — infrastructure fully described in Terraform. No manual steps after initial bootstrap.
- **Rolling deploys** — container health check + grace period ensures new task is healthy before old task is drained.

## Request flow

Client → Cloudflare (TLS + proxy) → API Gateway (custom domain) → VPC Link → Cloud Map → ECS Fargate → NestJS
