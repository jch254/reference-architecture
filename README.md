# Reference Architecture

Minimal, production-ready backend architecture. NestJS + DynamoDB + Docker + CodeBuild + Terraform. Multi-tenant data layer. Append-only analytics. React demo UI (same container). No domain logic. No async/background systems.

**Live:** [reference-architecture.603.nz](https://reference-architecture.603.nz)

## Architecture

```
/src/backend                → API (NestJS)
/src/frontend               → demo UI (React + Vite)
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

This is a reference architecture — not a product. Copy it as a starting point for new apps (as done with `/example-project`). Reuse the patterns directly.