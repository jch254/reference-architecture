# Reference Architecture

Minimal, production-ready backend architecture. NestJS + DynamoDB + Docker + CodeBuild + Terraform. No domain logic. No async/background systems.

## Architecture

```
/src                        → application (NestJS)
Dockerfile                  → runtime
buildspec.yml               → CI/CD (CodeBuild)
/infrastructure/terraform   → deployment (Terraform)
```

## Principles

- stateless API
- tenant-aware (subdomain-based)
- minimal and explicit
- no overengineering

## Endpoints

- `GET /health` → `{ status, timestamp }`
- `GET /example` → `{ message, requestId, tenantId }`

## Running locally

```bash
pnpm install
pnpm run build
pnpm run start:prod
```

Or with Docker:

```bash
docker build -t ref-arch .
docker run -p 3000:3000 ref-arch
```

## Deployment

Push to `main` → CodeBuild → Docker image to ECR → Terraform apply → ECS Fargate → Cloudflare DNS.

## Usage

Used as a reference architecture for generating new applications.

1. Copy as `/example-project` in a new repository
2. Use as architectural context for building domain-specific systems
3. Evolve independently

Reuse structure, not implementation.