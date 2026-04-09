# Architecture

## Layers

- **Application** (`/src`) — NestJS API. Stateless, tenant-aware via subdomain. DynamoDB for persistence.
- **Runtime** (`Dockerfile`) — Node.js container. Single process, no sidecar.
- **CI/CD** (`buildspec.yml`) — CodeBuild. Build → Docker push → Terraform apply → Cloudflare DNS.
- **Infrastructure** (`/infrastructure/terraform`) — ECS Fargate behind API Gateway HTTP API. Cloudflare for DNS + TLS.

## Design decisions

- **Stateless** — no session state, no local disk. Horizontally scalable by default.
- **Tenant-aware** — subdomain resolution via middleware. Tenant context available on every request.
- **Minimal** — no ALB, no NAT gateway, no background workers. Single container, single service.
- **Deterministic** — infrastructure fully described in Terraform. No manual steps after initial bootstrap.
- **Separated DNS** — Cloudflare handles TLS termination and DNS. No ACM, no AWS custom domains.

## Request flow

Client → Cloudflare (TLS) → API Gateway → VPC Link → Cloud Map → ECS Fargate → NestJS
