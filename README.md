# Reference Architecture

Minimal, production-ready backend architecture. NestJS + DynamoDB + Docker + CodeBuild + Terraform. Multi-tenant data layer. Append-only analytics. No domain logic. No async/background systems.

## Architecture

```
/src                        → application (NestJS)
Dockerfile                  → runtime
buildspec.yml               → CI/CD (CodeBuild)
/infrastructure/terraform   → deployment (Terraform + Cloudflare)
```

## Principles

- stateless API
- tenant-aware
- minimal and explicit
- no overengineering
- append-only analytics

## Endpoints

- `GET  /api/health`
- `POST /api/example`
- `GET  /api/example`

## Running locally

```bash
pnpm install
pnpm run build
pnpm run start:prod
```

## Deployment

Docker + CodeBuild + Terraform. Cloudflare for DNS.

See [infrastructure/terraform/README.md](infrastructure/terraform/README.md) for details.

## Usage

This is a reference architecture — not a product. Copy it as a starting point for new apps (as done with `/example-project`). Reuse the patterns directly.