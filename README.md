# Reference Architecture

Minimal, production-ready backend architecture. NestJS + DynamoDB + Docker + CodeBuild. No domain logic. No async/background systems.

## Structure

```
/src              → application (NestJS)
Dockerfile        → runtime
buildspec.yml     → CI/CD
```

## Principles

- stateless API
- tenant-aware (subdomain resolution)
- minimal and explicit
- no overengineering

## Endpoints

- `GET /health` → `{ status, timestamp }`
- `GET /example` → `{ message, requestId, tenantId }`

## Running locally

```bash
cp .env.example .env
pnpm install
pnpm run build
pnpm run start:prod
```

## Deployment

Docker build → push to ECR → deploy via CodeBuild. Add `/infrastructure` (Terraform/IaC) per target environment.

## Usage

Used as a reference architecture for generating new applications.

1. Copy as `/example-project` in a new repository
2. Use as architectural context for building domain-specific systems
3. Evolve independently

Reuse structure, not implementation.