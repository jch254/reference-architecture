---
description: Update README and all nested READMEs to reflect current architecture
agent: agent
---

You are a senior staff engineer.

Your task is to update the repository documentation so it accurately reflects the current architecture while remaining minimal and high-signal.

---

## Context

The repository is a layered reference architecture consisting of:

- /src → backend application (NestJS)
- Dockerfile → runtime
- buildspec.yml → CI/CD
- /infrastructure → deployment (IaC, including nested layers like Terraform and Cloudflare)

This is NOT a product. It is a minimal, reusable reference architecture.

---

## Goals

- Make the repository understandable in under 60 seconds
- Reflect the current architecture accurately
- Keep documentation minimal and intentional
- Ensure each layer documents itself (not centrally duplicated)

---

## Strict Rules

- Do NOT over-document
- Do NOT add tutorials or step-by-step guides
- Do NOT add marketing language
- Do NOT duplicate information across files
- Do NOT centralize details that belong to a specific layer
- Each layer owns its own explanation

---

## Task 1 — Update root README.md

README is the ENTRY POINT only.

It must remain high-level and minimal.

---

### README must contain ONLY:

#### Title

Reference Architecture

---

#### What this is

- minimal production-ready backend architecture
- built with NestJS + DynamoDB + Docker + CodeBuild + IaC
- multi-tenant data layer
- analytics instrumentation (minimal)
- no domain logic
- no async/background systems

---

#### Architecture Overview

Describe structure:

- /src → application  
- Dockerfile → runtime  
- buildspec.yml → CI/CD  
- /infrastructure → deployment  

DO NOT explain internals here.

---

#### Principles

- stateless API  
- tenant-aware  
- minimal and explicit  
- no overengineering  
- append-only analytics  

---

#### Endpoints

- GET /api/health  
- GET /api/example  
- POST /api/example  

---

#### Deployment

- Docker + CodeBuild + infrastructure layer  
- Cloudflare DNS (high-level mention only)  

NO details.

---

#### Usage

- used as a reference architecture
- copied as /example-project for new apps
- reused for systems like GTD

---

## Task 2 — Enforce nested README ownership (CRITICAL)

Each major layer MUST have its own README if it has non-obvious behavior.

---

### Required nested READMEs:

#### /infrastructure/README.md

Must describe:

- overall infra structure
- relationship between AWS + Cloudflare layers
- how deployment flows (high-level only)

---

#### /infrastructure/terraform/README.md

Must describe:

- ECS + API Gateway + VPC Link pattern
- why no ALB / NAT
- how app connects to infra

DO NOT include deep AWS explanations.

---

#### /infrastructure/terraform/cloudflare/README.md

Must describe:

- DNS role only
- subdomain → API Gateway mapping
- Cloudflare handles TLS

DO NOT include provider setup instructions.

---

### Optional (only if needed):

#### /src/README.md

Only if clarity is needed.

Content:

- request flow (controller → service → DynamoDB)
- tenant context usage
- analytics placement

---

## Task 3 — No duplication rule (VERY IMPORTANT)

Enforce:

- root README = overview only
- nested READMEs = layer-specific detail
- no repeating the same explanation across files

Example:

❌ DO NOT explain ECS in root README  
✅ Explain ECS in /infrastructure/terraform/README.md  

---

## Task 4 — Minimal docs folder (only if needed)

Create `/docs` ONLY if something cannot belong to a layer.

Allowed:

### /docs/architecture.md

- explain layering (src → runtime → infra)
- explain design philosophy
- keep under ~30 lines

---

## Task 5 — Consistency check

Ensure:

- all READMEs align with actual code
- no outdated references (e.g. ACM, ALB, old infra)
- no contradictions
- no references to removed systems

---

## Task 6 — Remove bad documentation

Delete or fix:

- outdated instructions
- duplicated explanations
- references to removed infra (ACM, ALB, etc.)
- anything that leaks internal strategy or cost decisions

---

## Output

- updated root README.md
- updated or created nested READMEs where appropriate
- optional /docs files (only if justified)
- brief summary of changes

---

## Principles

- root explains WHAT
- nested explains HOW (lightly)
- code explains DETAILS

---

## Final Goal

A repository where:

- root README is instantly understandable
- each layer explains itself
- nothing is duplicated
- nothing is over-explained
- documentation matches the real system exactly