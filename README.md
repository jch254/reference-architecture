# Reference Architecture

Minimal, production-ready backend architecture.

- NestJS + DynamoDB + Docker + CodeBuild + IaC  
- multi-tenant data layer  
- append-only analytics instrumentation  
- no domain logic  
- no async/background systems  

**Live:** [reference-architecture.603.nz](https://reference-architecture.603.nz)

---

## Architecture

```
/src/backend      → NestJS API
/src/frontend     → React (Vite)
/src/mobile       → React Native
Dockerfile        → runtime
buildspec.yml     → CI/CD (CodeBuild)
/infrastructure   → deployment (Terraform + Cloudflare)
```

---

## Principles

- stateless API  
- tenant-aware data model  
- minimal and explicit  
- no overengineering  
- append-only analytics  

---

## Design Constraints

This architecture follows the core ideas of the [Twelve-Factor App](https://12factor.net) where they still hold, with deliberate trade-offs for simplicity and cost.

### What is enforced

- **Stateless compute**  
  Services run as disposable containers. No in-memory state is required for correctness.

- **Externalised state**  
  All persistence lives in DynamoDB or external services.

- **Config via environment**  
  Runtime behaviour is controlled through environment variables.

- **Build / release / run separation**  
  Docker images are built once and promoted across environments.

---

### Intentional deviations

- **DynamoDB single-table design**  
  Data model is coupled to access patterns. Not portable by design.

- **AWS-native infrastructure**  
  API Gateway, ECS, and Cloud Map are used directly. Portability is not a goal.

- **No async systems**  
  This reference avoids queues and background workers. These are added at the application layer when needed.

- **Multi-tenancy as a first-class constraint**  
  Tenant isolation is enforced at the data and service layers.

---

### Guiding invariant

> Any service instance can be terminated and replaced without data loss.

---

## Endpoints

- `GET    /api/health`  
- `GET    /api/example`  
- `POST   /api/example`  
- `PATCH  /api/example/:id`  
- `DELETE /api/example/:id`  

---

## Deployment

Docker + CodeBuild + Terraform. Cloudflare for DNS.

See [infrastructure/README.md](infrastructure/README.md) for details.

---

## Running locally

Backend:

```bash
pnpm install
pnpm run start:dev
```

Frontend (separate terminal):

```bash
cd src/frontend
pnpm install
pnpm run dev
```

Frontend dev server proxies `/api` requests to the backend on port 3000.

Production-like (single process):

```
pnpm run build
cd src/frontend && pnpm run build && cd ../.. 
pnpm run start:prod
```

Docker:

```
docker compose up --build
```

Starts the app, DynamoDB Local, and creates the table automatically.

## Usage
- used as a reference architecture, not a product
- copied and adapted for new apps

## What this is (and isn’t)

This is a baseline:

- proven deployment model
- consistent data patterns
- predictable runtime behaviour

It does not include:

- business/domain logic
- async pipelines or workflows
- complex orchestration

Those are layered on top per application.