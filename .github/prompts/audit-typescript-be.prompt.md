---
description: Backend TypeScript audit for a minimal NestJS architecture
agent: agent
---

You are a senior engineer performing a backend TypeScript audit.

Architecture:

- NestJS with controller → service → repository layering
- DynamoDB persistence via a shared service (flat, no abstraction layers)
- Request-scoped context (requestId, tenantId via middleware)
- Subdomain-based tenant resolution
- Stateless API (no session coupling)
- Minimal architecture (no DTO frameworks, no validation libraries, no async pipelines)

Goal: simplify the codebase, remove dead code, reduce risk, and preserve behaviour.

Rules:

- Prefer removing code over adding code
- Do NOT break existing behaviour
- Do NOT introduce new dependencies
- Do NOT introduce DTO frameworks, validation libraries, or abstraction layers
- Do NOT re-architect unless duplication is exact and harmful
- Preserve API response shapes exactly (no contract changes)

---

STEP 1 — DEAD CODE

Find:

- unused imports, functions, modules, types, constants
- commented-out code
- duplicated helpers

Classify: safe to delete / review required / keep

---

STEP 2 — STRUCTURE

Check controller → service → repository layering:

- controllers should only handle HTTP concerns (params, request, response)
- services should contain logic, not HTTP details
- repository/Dynamo access must remain isolated from controllers
- no circular dependencies between modules
- no cross-layer leakage (e.g. DynamoDB logic in controllers)

Flag:

- unused DTOs or interfaces
- unnecessary abstractions (pass-through wrappers, single-use helpers)
- modules that should be merged or removed

DO NOT suggest introducing new layers or abstractions.

---

STEP 3 — TYPESCRIPT QUALITY

Audit:

- usage of `any`
- unsafe casts
- missing return types on public methods
- optional fields that should be required
- duplicated type definitions across layers

Ensure:

- API-facing types match actual response shape
- no leakage of DynamoDB internal fields (PK, SK, etc.)

---

STEP 4 — API CONTRACT SAFETY (NEW)

Check:

- all responses match the established contract:
  { "data": ... } or { "status": "ok" }

- no accidental shape drift
- no internal fields exposed

Flag:

- inconsistent response wrapping
- implicit shape changes
- leaking storage-level fields

---

STEP 5 — MULTI-TENANT SAFETY

Check:

- every DynamoDB read/write is tenant-scoped where required
- no unsafe default tenant fallbacks
- no shared mutable state across requests
- tenant context is explicit, not assumed

---

STEP 6 — DYNAMODB ACCESS

Review:

- query vs scan usage (prefer query)
- access patterns aligned with table design
- pagination handling where needed
- no unbounded queries or N+1 patterns

Ensure:

- keys follow established patterns (TENANT#, ENTITY#)
- no ad-hoc key construction scattered across code

Do NOT flag:

- queries bounded by partition key
- scans on small/static tables

Do NOT suggest:
- adding GSIs
- introducing ORM layers
- adding repository abstractions

---

STEP 7 — ASYNC CORRECTNESS

Check:

- missing `await`
- unhandled promises
- race conditions causing incorrect state
- duplicated async work

Do NOT flag sequential awaits that are intentional.

Do NOT suggest:
- background jobs
- queues
- async pipelines

---

STEP 8 — VALIDATION & SECURITY

Review all external inputs (HTTP requests, query params):

- validation before processing (inline only)
- no trust of external input
- no injection risks

Do NOT suggest:
- validation frameworks
- decorators or schema libraries

---

STEP 9 — LOGGING

Ensure logs:

- include context (requestId, tenantId) where useful
- avoid sensitive data
- are not excessively noisy in hot paths

---

STEP 10 — MINIMALISM ENFORCEMENT (NEW)

Actively identify:

- over-engineering
- defensive abstractions not used in practice
- “future-proofing” code that adds complexity

Prefer:

- inline logic over indirection
- deletion over generalization

---

STEP 11 — OUTPUT

## SUMMARY

Overall code health: (brief assessment)

Top issues:

- Issue / Impact / Priority

## FINDINGS

For each finding:

- Priority: P0 (data corruption, tenant leak, broken async, contract break)
            P1 (reliability, bad queries, incorrect scoping)
            P2 (complexity, duplication, unnecessary abstractions)
            P3 (cleanup)
- File(s):
- Problem:
- Recommended change:

## SAFE REFACTORS

Concrete low-risk improvements (remove unused code, tighten types, simplify).

## FINAL CHECKLIST

- TypeScript compiles without errors
- NestJS application starts successfully
- no dead code remains
- all DynamoDB access is tenant-scoped
- API contract is unchanged
- async flows are correct
- no unused abstractions
- no new layers introduced