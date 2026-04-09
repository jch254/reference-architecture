---
description: Backend TypeScript audit for a minimal NestJS architecture
agent: agent
---

You are a senior engineer performing a backend TypeScript audit.

Architecture:

- NestJS with controller → service → repository layering
- DynamoDB persistence via a shared service
- Request-scoped context (requestId, tenantId via middleware)
- Subdomain-based tenant resolution
- Stateless API (no session coupling)

Goal: simplify the codebase, remove dead code, reduce risk, and preserve behaviour.

Rules:

- Prefer removing code over adding code
- Do NOT break existing behaviour
- Do NOT introduce new dependencies
- Do NOT re-architect unless duplication is exact and harmful

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
- no circular dependencies between modules
- no cross-layer leakage (e.g. DynamoDB logic in controllers)

Flag:

- unused DTOs or interfaces
- unnecessary abstractions (pass-through wrappers, single-use helpers)
- modules that should be merged or removed

---

STEP 3 — TYPESCRIPT QUALITY

Audit:

- usage of `any`
- unsafe casts
- missing return types on public methods
- optional fields that should be required
- duplicated type definitions across layers

---

STEP 4 — MULTI-TENANT SAFETY

Check:

- every DynamoDB read/write is tenant-scoped where required
- no unsafe default tenant fallbacks
- no shared mutable state across requests
- tenant context is explicit, not assumed

---

STEP 5 — DYNAMODB ACCESS

Review:

- query vs scan usage (prefer query)
- access patterns aligned with table design
- pagination handling where needed
- no unbounded queries or N+1 patterns

Do NOT flag:

- queries bounded by partition key
- scans on small/static tables

---

STEP 6 — ASYNC CORRECTNESS

Check:

- missing `await`
- unhandled promises
- race conditions causing incorrect state
- duplicated async work

Do NOT flag sequential awaits that are intentional.

---

STEP 7 — VALIDATION & SECURITY

Review all external inputs (HTTP requests, query params):

- validation before processing
- no trust of external input
- no injection risks

---

STEP 8 — LOGGING

Ensure logs:

- include context (requestId, tenantId) where useful
- avoid sensitive data
- are not excessively noisy in hot paths

---

STEP 9 — OUTPUT

## SUMMARY

Overall code health: (brief assessment)

Top issues:

- Issue / Impact / Priority

## FINDINGS

For each finding:

- Priority: P0 (data corruption, tenant leak, broken async) / P1 (reliability, bad queries) / P2 (complexity, duplication) / P3 (cleanup)
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
- async flows are correct
- no unused abstractions