# Reference Architecture

Minimal, production-ready architecture. NestJS + React + DynamoDB + Docker + CodeBuild + Terraform. Multi-tenant data layer. Append-only analytics. Frontend demo layer. No domain logic. No async/background systems.

## Architecture

```
/src/backend                → API (NestJS)
/src/frontend               → demo UI (React + Vite)
Dockerfile                  → runtime (single container serves both)
buildspec.yml               → CI/CD (CodeBuild)
/infrastructure/terraform   → deployment (Terraform + Cloudflare)
```

## Principles

- stateless API
- tenant-aware
- minimal and explicit
- no overengineering
- append-only analytics
- single container (API + frontend)

## Endpoints

- `GET  /api/health`
- `GET  /api/example`
- `POST /api/example`
- `GET  /` → frontend

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

To run as a single process (production-like):

```bash
pnpm run build
cd src/frontend && pnpm run build && cd ../..
pnpm run start:prod
```

With Docker:

```bash
docker compose up --build
```

This starts the app, DynamoDB Local, and creates the table automatically.

## Deployment

Docker + CodeBuild + Terraform. Cloudflare for DNS.

See [infrastructure/terraform/README.md](infrastructure/terraform/README.md) for details.

## Usage

This is a reference architecture — not a product. Copy it as a starting point for new apps (as done with `/example-project`). Reuse the patterns directly.