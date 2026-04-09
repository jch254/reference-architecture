# Architecture

## Layers

- **Application** (`/src`) — NestJS API. Stateless, tenant-aware via subdomain. DynamoDB for persistence.
- **Runtime** (`Dockerfile`) — Node.js container. Single process, no sidecar.
- **CI/CD** (`buildspec.yml`) — CodeBuild. Build → Docker push → Terraform apply → Cloudflare DNS.
- **Infrastructure** (`/infrastructure/terraform`) — ECS Fargate behind API Gateway HTTP API with custom domain. Cloudflare for DNS + edge proxy.

## Design decisions

- **Stateless** — no session state, no local disk. Horizontally scalable by default.
- **Tenant-aware** — subdomain resolution via middleware. Tenant context available on every request.
- **Minimal** — no ALB, no NAT gateway, no background workers. Single container, single service.
- **Deterministic** — infrastructure fully described in Terraform. No manual steps after initial bootstrap.
- **Custom domain** — ACM cert + API Gateway custom domain. Cloudflare proxies to the custom domain target, preserving Host header.
- **Rolling deploys** — container health check + grace period ensures new task is healthy before old task is drained.

## Request flow

Client → Cloudflare (TLS + proxy) → API Gateway (custom domain) → VPC Link → Cloud Map → ECS Fargate → NestJS
