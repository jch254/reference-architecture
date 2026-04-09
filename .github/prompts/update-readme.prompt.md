---
description: Update README and add minimal supporting docs to reflect current architecture
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
- /infrastructure → deployment (IaC)

This is NOT a product. It is a minimal, reusable reference architecture.

---

## Goals

- Make the repository understandable in under 60 seconds
- Reflect the current architecture accurately
- Keep documentation minimal and intentional
- Avoid duplication and unnecessary detail

---

## Strict Rules

- Do NOT over-document
- Do NOT add tutorials or step-by-step guides
- Do NOT add marketing language
- Do NOT duplicate information across files
- Only document what is necessary to understand and use the system

---

## Task 1 — Update README.md

Ensure README contains ONLY the following sections:

### Title

Reference Architecture

---

### What this is

- minimal production-ready backend architecture
- built with NestJS + DynamoDB + Docker + CodeBuild + IaC
- no domain logic
- no async/background systems

---

### Architecture Overview

Describe structure:

- /src → application  
- Dockerfile → runtime  
- buildspec.yml → CI/CD  
- /infrastructure → deployment  

---

### Principles

- stateless API  
- tenant-aware  
- minimal and explicit  
- no overengineering  

---

### Endpoints

- GET /health  
- GET /example  

---

### Running locally

Keep concise:

- install dependencies  
- build  
- run  

(No long instructions)

---

### Deployment

- Docker + CodeBuild + infrastructure layer  
- no deep explanation  

---

### Usage

Explain briefly:

- used as a reference architecture
- copied as /example-project for new apps
- reused for systems like GTD

---

## Task 2 — Add docs only if necessary

Create `/docs` ONLY if it adds value.

Allowed files:

---

### /docs/architecture.md

Content:

- explain system layering (src / runtime / infra)
- explain design decisions (minimal, stateless, deterministic)
- keep under ~30 lines

---

### /docs/infrastructure.md

Content:

- describe ECS + API Gateway + networking at a high level
- explain how infra aligns with the app
- no deep AWS explanations

---

## Task 3 — Do NOT create docs for

- frontend (not implemented yet)
- DynamoDB deep theory
- anything obvious from code
- anything already explained in README

---

## Task 4 — Consistency check

Ensure:

- README and docs align
- no contradictions
- no outdated references

---

## Output

- updated README.md
- any new docs under /docs (only if justified)
- brief summary of changes

---

## Principle

If documentation feels long → reduce it  
If something is obvious from code → remove it  
If something is repeated → consolidate it  

---

## Final Goal

A repository that:

- is immediately understandable
- reflects the real system
- remains minimal and intentional