---
description: Dead code elimination audit for a minimal NestJS backend
agent: agent
---

You are a senior engineer performing a dead code elimination audit.

Goal: identify and safely remove unused code while preserving runtime behaviour.

Rules:

- Prefer deletion over addition
- Do NOT break runtime behaviour
- Do NOT remove indirectly referenced code (NestJS module wiring, middleware, DI)
- Do NOT introduce new abstractions
- If uncertain → do NOT delete

---

STEP 1 — IDENTIFY ENTRY POINTS

Account for:

- NestJS bootstrap (`main.ts`)
- module imports and DI wiring
- middleware registration
- controller route handlers

A symbol is NOT unused if it is wired through NestJS modules, middleware, or DI.

---

STEP 2 — SCAN FOR UNUSED CODE

Find:

- unused imports
- unused functions and methods
- unused classes and modules
- unused interfaces, types, and constants
- commented-out code
- pass-through wrappers with no added value
- one-use helpers that should be inlined

Classify each as: safe to delete / review required / keep

---

STEP 3 — ENFORCE "EVERY FILE MUST HAVE A PURPOSE"

For every file in `src/`:

- confirm it is imported or wired into the module graph
- confirm it contains meaningful logic (not just re-exports or stubs)
- flag empty or near-empty files

---

STEP 4 — OUTPUT

## SUMMARY

- Unused modules: X
- Unused symbols: X
- Safe deletions: X
- Review required: X

## FINDINGS

For each finding:

- File:
- Symbol (if applicable):
- Reason:
- Classification: safe to delete / review required
- Priority: P0 (breaks if wrong) / P1 (likely safe) / P2 (clearly safe)

## SAFE DELETIONS

Show concrete diffs for high-confidence removals only.

## FINAL CHECKLIST

- TypeScript compiles without errors
- NestJS application starts successfully
- no missing imports or broken DI
- all route handlers still reachable