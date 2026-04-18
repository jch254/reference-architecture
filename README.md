# Reference Architecture

Minimal, production-ready backend architecture.

- NestJS + DynamoDB + Docker + CodeBuild + IaC
- multi-tenant data layer
- analytics instrumentation (minimal)
- no domain logic
- no async/background systems

**Live:** [reference-architecture.603.nz](https://reference-architecture.603.nz)

## Architecture

```
/src              → application (NestJS API + React frontend)
Dockerfile        → runtime
buildspec.yml     → CI/CD (CodeBuild)
/infrastructure   → deployment (Terraform + Cloudflare)
```

## Principles

- stateless API
- tenant-aware
- minimal and explicit
- no overengineering
- append-only analytics

## Endpoints

- `GET    /api/health`
- `GET    /api/example`
- `POST   /api/example`
- `DELETE /api/example/:id`

## Deployment

Docker + CodeBuild + Terraform. Cloudflare for DNS.

See [infrastructure/README.md](infrastructure/README.md) for details.

## Running locally

```bash
# Backend
pnpm install
pnpm run start:dev

# Frontend (separate terminal)
cd src/frontend
pnpm install
pnpm run dev
```

Frontend dev server proxies `/api` requests to the backend on port 3000.

Production-like (single process):

```bash
pnpm run build
cd src/frontend && pnpm run build && cd ../..
pnpm run start:prod
```

Docker:

```bash
docker compose up --build
```

Starts the app, DynamoDB Local, and creates the table automatically.

## Usage

- used as a reference architecture, not a product
- copied and adapted for new apps