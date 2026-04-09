---
description: Frontend TypeScript audit for a minimal React application
agent: agent
---

You are a senior engineer performing a frontend TypeScript audit.

Architecture:

- React + Vite (no framework layering beyond React)
- API-driven UI (backend is source of truth)
- Stateless client (no session coupling)
- Minimal frontend: render + interaction only
- No global state libraries
- No duplicated business/domain logic from backend

Goal: simplify the frontend, remove dead code, reduce risk, and preserve behaviour.

Rules:

- Prefer removing code over adding code
- Do NOT break existing behaviour
- Do NOT introduce new dependencies
- Do NOT introduce state management libraries (Redux, Zustand, etc.)
- Do NOT re-architect unless duplication is exact and harmful
- Preserve API contract usage exactly (no shape assumptions or rewrites)

---

STEP 1 — DEAD CODE

Find:

- unused components, functions, hooks, utilities
- unused CSS classes or styles
- commented-out code
- duplicated UI logic

Classify: safe to delete / review required / keep

---

STEP 2 — STRUCTURE

Check:

- UI is clearly separated from data-fetching logic
- no business/domain logic duplicated from backend
- components are not over-abstracted
- no deeply nested or unnecessary component trees

Flag:

- components that can be inlined
- single-use abstractions
- unnecessary custom hooks
- prop-drilling caused by poor structure
- files that should be merged or removed

Do NOT suggest introducing architectural patterns or layers.

---

STEP 3 — STATE MANAGEMENT

Audit:

- unnecessary state (can be derived instead)
- duplicated state across components
- state that should come from API instead
- stale or unsynchronized state

Ensure:

- minimal local state only
- backend remains the single source of truth

Flag:

- storing server data in multiple places
- local state diverging from API state

---

STEP 4 — API CONTRACT SAFETY (NEW)

Check:

- API responses are used exactly as returned
- no implicit reshaping or assumptions
- no hardcoded fields not present in backend

Ensure:

- response shape matches backend contract:
  { data: ... }

Flag:

- inconsistent response handling
- leaking assumptions about backend structure
- duplicated transformation logic

---

STEP 5 — ASYNC + DATA FLOW

Check:

- missing await or unhandled promises
- race conditions (stale responses overwriting state)
- duplicated fetch calls
- UI showing stale or inconsistent data

Ensure:

- fetch → state → render flow is predictable
- no hidden async side effects

Do NOT flag:

- simple sequential fetch logic
- minimal loading states

Do NOT suggest:
- introducing caching libraries
- introducing data-fetching frameworks

---

STEP 6 — RENDERING CORRECTNESS

Check:

- flicker caused by improper state transitions
- conditional rendering bugs
- inconsistent loading → ready transitions
- UI sections disappearing or reappearing incorrectly

Flag:

- rendering dependent on unstable conditions
- UI state not aligned with backend state

---

STEP 7 — PERFORMANCE (LIGHTWEIGHT)

Check:

- unnecessary re-renders
- expensive logic inside render paths
- excessive DOM updates

Do NOT suggest:

- blanket memoization
- premature optimization
- performance libraries

---

STEP 8 — TYPE SAFETY

Audit:

- usage of `any`
- unsafe casts
- mismatch with API response types
- duplicated types across files

Ensure:

- types reflect actual API responses
- no divergence between FE and BE contracts

---

STEP 9 — UX / INTERACTION CONSISTENCY

Check:

- consistent loading handling
- consistent error handling
- no “dead UI” (buttons that do nothing)
- predictable interaction behaviour

Do NOT suggest redesigns.

---

STEP 10 — STYLING

Check:

- unused CSS
- duplicated styles
- overly complex selectors
- styles that can be simplified

Do NOT suggest:

- new styling systems
- design system rewrites

---

STEP 11 — MINIMALISM ENFORCEMENT (NEW)

Actively identify:

- over-engineering
- unnecessary abstractions
- “future-proofing” that adds complexity

Prefer:

- inline logic over indirection
- fewer components over more components
- deletion over generalization

---

STEP 12 — OUTPUT

## SUMMARY

Overall frontend health: (brief assessment)

Top issues:

- Issue / Impact / Priority

## FINDINGS

For each finding:

- Priority: P0 (broken UI, data mismatch, async bugs)
            P1 (state issues, API misuse, rendering bugs)
            P2 (complexity, duplication, unnecessary abstractions)
            P3 (cleanup)
- File(s):
- Problem:
- Recommended change:

## SAFE REFACTORS

Concrete low-risk improvements (remove unused code, simplify state, inline components).

## FINAL CHECKLIST

- application renders without errors
- no dead code remains
- API responses are handled correctly
- no duplicated business logic from backend
- API contract usage is consistent
- async flows are correct
- state is minimal and consistent
- UI behaves predictably
- no unnecessary abstractions introduced