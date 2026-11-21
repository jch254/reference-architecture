# Reference Architecture demo audit

Read on 21 November 2026 at commit `5ce4a31` on `main`: everything in `src/frontend`, `src/shared/api-types.ts` and the four backend controllers the frontend calls (`config`, `auth`, `users`, `example`).

## What the frontend calls

| Request | Auth | Returns | Used today |
|---|---|---|---|
| `GET /api/config` | Public | `authProvider`, `compute`, `auth0` | Yes, at boot |
| `GET /api/health` | Public | `status: "ok"` | No |
| `GET /api/auth/session` | Magic link only | `email`, `tenantSlug` | Yes, to decide signed in or out. Answers 401 when signed out |
| `POST /api/auth/request-link` | Public, rate limited | `message` | Yes |
| `GET /api/auth/verify?web=1` | Public | A redirect to `/?auth=success` or `/?auth=error&reason=consumed` | Yes, by way of the emailed link |
| `POST /api/auth/logout` | Protected | `message` | Yes, magic link only |
| `GET /api/auth/check` | Protected | `authenticated`, `principal` | No |
| `GET /api/me` | Protected | `user`: `userId`, `tenantId`, `provider`, `providerSubject`, `email`, `name`, `picture`, `createdAt`, `updatedAt`, `lastSeenAt` | Yes, but only `userId`, `provider` and `email` are shown |
| `GET /api/example` | Protected | A list of `id`, `userId`, `name`, `createdAt`, `updatedAt` | Yes |
| `POST /api/example` | Protected | The record, status 201 | Yes |
| `PATCH /api/example/:id` | Protected | The record | Yes |
| `DELETE /api/example/:id` | Protected | `id` | Yes |

Every response carries an `x-request-id` header. Success bodies are wrapped as `{ "data": ... }` and errors as `{ "error": { "code", "message", "requestId" } }`.

The tenant mode (`fixed` or `subdomain`) is not exposed by any endpoint. The tenant id is: `tenantId` in `/api/me` and `tenantSlug` in `/api/auth/session`.

## States

Shell (`Root.tsx`):

1. Config loading. "Loading…" under a header that assumes magic link.
2. Config failed. Falls back to the magic-link app with no compute shown and no error.
3. OIDC misconfigured. `authProvider` is `oidc` and `auth0` is null. An error line names `AUTH0_SPA_CLIENT_ID`.

Magic link (`App.tsx`), also rendered for `AUTH_PROVIDER=none`:

4. Session loading.
5. Signed out. Email field and "Send link".
6. Sending the link. The button reads "Sending…".
7. Request failed. Covers a network error and the 429 from the rate limiter.
8. Link sent. "Check your email" with "Try again".
9. Link error, reason `consumed`.
10. Link error, any other reason. In practice this is a verify link with no token. See `notes.md`.
11. Signed in, user loading. The auth bar shows the session email until `/api/me` answers.
12. Signed in, no records. "No examples yet."
13. Signed in with records.
14. Creating. The button reads "Creating…".
15. Inline editing. Enter saves, Esc cancels.
16. API error. One red line under the create form, shared by create, rename, delete, list and `/api/me`.
17. Session expired. A 401 on any call signs the user out and returns to state 5 with no message.

OIDC (`auth/OidcApp.tsx`):

18. Auth0 loading.
19. Signed out. "Log in with Auth0".
20. Auth0 sign-in error. "Sign-in failed:" and the SDK message.
21. Redirecting to and back from Auth0. No UI of its own.
22. Signed in, bootstrapping. `/api/me` then the list.
23. Bootstrap error.
24. Signed in, no records, with records, creating, inline editing and API error, as states 12 to 16.
25. Session no longer valid. A 401 shows "Your session is no longer valid. Please sign in again." and clears the local user while Auth0 still reports signed in.

States the redesign adds: list loading, a record selected, delete pending with undo, a log entry open, the log empty and each theme.

## Duplication

`App.tsx` and `auth/OidcApp.tsx` each declare the `Example` and `LocalUser` types and each contain the auth bar, the create form, the example list with inline editing, the raw response toggle and the four CRUD handlers. The markup is the same apart from line wrapping. They differ in how they sign in and out, in how they treat a 401 and in the sign-out label ("Sign Out" and "Log Out").

## Tests that assert on copy or structure

`Root.test.tsx`: the button "send link", the heading "Reference Architecture Demo", the text "AWS Lambda", the links "magic-link on ECS Fargate" and "Auth0/OIDC on AWS Lambda" with their addresses, the absence of a link to the current deployment, the placeholder `you@example.com`, the button "log in with auth0" and the heading "Reference Architecture Auth0 Demo".

`App.test.tsx`: a call to `/api/me`, the text "jordan@example.com · internal_magic_link · user-123" and the button "sign out".

`auth/OidcApp.test.tsx`: the heading "Reference Architecture Auth0 Demo", the two deployment links, the button "log in with auth0", the text "local app user", a call to `/api/me` with `Authorization: Bearer access-token-xyz`, the button "log out", the text "demo@example.com · oidc · u-1", the buttons "show raw response" and "hide raw response", the placeholder "Name", the button "create" and the text "loading".

`api/api-client.test.ts` asserts on headers only and is not affected by copy.

`scripts/validate-system.ts` checks the API and does not read the page.

## Smaller findings

The four-column list grid gives the actions a fixed 48px for two buttons that need about 88px. Worked out from the CSS and not yet screenshotted: the pair overflows to the left at every width, and at 390px the name and timestamp columns are about 92px each, so the buttons sit over the timestamp. The id and the ISO timestamp are both cut with an ellipsis. Buttons and the delete control are below 44px. The primary button text is `#fff` and the row hover is `#fafafa`, both outside the tokens. `index.html` has a title and a viewport tag and nothing else. The font stack names Inter and no font file is loaded.
