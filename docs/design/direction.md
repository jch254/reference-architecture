# Reference Architecture demo design direction

Status: proposed on 21 November 2026. The two proofs are on the design canvas and nothing in `src/frontend` has changed yet. The system and build stages start once the direction is approved.

Related files: `audit.md` lists every state the UI can be in and the tests that assert on copy or structure. `notes.md` records things that look broken or out of date and were left alone.

## The idea

The demo is a ledger of what the backend did. What you do sits on the left and what the system did with it sits on the right: the request, the response, the tenant, the owner and the key. Every value on the page comes from the live API, set in the mono face, so a visitor reads the architecture from its own behaviour.

Green keeps the one job it has across the family. It marks what is current: the deployment you are on, the record you have selected, an API that is answering.

## How it relates to 603.nz and Namaste

The page is a third member of the 603 family and takes the system from jch254.com unchanged: the header, the tokens, every control and the footer. Its header uses the site switch pattern with `603.nz` as the way back and "Reference Architecture" as the current site.

The signed-out page is built like the 603.nz and Namaste landing pages. The copy keeps the left edge and the sign-in field is the Namaste workspace field with its 2px base line. The product on the right is the real thing: a readout of this deployment and a request log that already holds the calls the page made to load.

The signed-in page is built like Namaste's Today view. A 32px view title with a mono count, a quick add field on a 1px base line, then ledger rows whose mono margin holds the one fact the list is about. In Namaste that fact is a time. Here it is the record id, because the id is the last segment of the DynamoDB sort key.

The AWS orange and the blue dot go. Compute is written in words in the readout and in the comparison, and the current deployment takes the node and the title weight. No colour outside the system is needed to tell Fargate from Lambda.

## Tokens taken

Values are copied from `jch254dotcom/src/styles/` on the `redesign` branch, which copies Namaste (`namaste/src/frontend/src/styles/`). Studio was read (`studiodaw/src/frontend/src/styles/tokens.css`, `global.css`) and contributes what it contributes to Namaste: Spline Sans Mono for every number and the real product in place of an illustration.

| Token | Value | Source |
|---|---|---|
| `--font-sans` | Schibsted Grotesk, variable 400 to 900, self-hosted woff2 | `tokens.css`, `fonts.css` |
| `--font-mono` | Spline Sans Mono, variable 300 to 700, self-hosted woff2 | `tokens.css`, `fonts.css` |
| Type scale | 12, 13, 14.5, 16, 17, 18, 20, 24, 32, 44, 66px | `tokens.css` (`--text-1` to `--text-9`, `--text-body`, `--text-row`) |
| Weights | 450 text, 550 strong, 600 display and buttons, 650 titles | `tokens.css` |
| h1 | fluid 40 to 66px, line height 1.02, tracking -0.04em | `primitives.css` (`.h1`) |
| h2 | fluid 28 to 44px, line height 1.06, tracking -0.035em | `primitives.css` (`.h2`) |
| View title | 32px at 650, tracking -0.025em | Namaste `tokens.css` (`--text-7`, `--tracking-title`) |
| Row name | 20px at 650, tracking -0.015em | `primitives.css` (`.ledger-name`) |
| Leading | 1.4 UI, 1.5 lede, 1.55 body | `tokens.css` |
| Spacing | 4, 8, 12, 16, 24, 32, 40, 48, 72px | `tokens.css` (`--space-*`) |
| Page | gutter `clamp(20px, 5vw, 72px)`, measure 1296px, column gap 64px, section `clamp(72px, 9vw, 128px)`, header 72px | `tokens.css` |
| Radii | 4px controls and row hover, 10px floating surfaces, 50% node | `tokens.css` |
| Motion | 120ms and 200ms, ease-out, zero under reduced motion | `tokens.css`, `base.css` |
| `--page` | `#fbfbf8` light, `#141917` dark | `tokens.css` |
| `--side` | `#f1f2ed`, `#0d110f` | `tokens.css` |
| `--raise` | `#ffffff`, `#1d2421` | `tokens.css` |
| `--hover` | `#eceee7`, `#1c2320` | `tokens.css` |
| `--field` | `#e7e9e2`, `#1a211e` | `tokens.css` |
| `--ink` | `#141a17`, `#ecefe9` | `tokens.css` |
| `--ink-2` | `#3d4741`, `#bcc4bd` | `tokens.css` |
| `--ink-3` | `#5a655e`, `#8f9992` | `tokens.css` |
| `--on-ink` | `#fbfbf8`, `#0d110f` | `tokens.css` |
| `--rule`, `--rule-2` | `#dcdfd7` and `#79827b`, `#272f2b` and `#66716b` | `tokens.css` |
| `--green`, `--green-ink` | `#2bb67d` fills in both themes, `#0b6e47` green text in light | `tokens.css` |
| `--alert`, `--alert-wash` | `#ad3c1c` and `#f6e4dc`, `#f29a78` and `#2e1f19` | `tokens.css` |
| `--lift`, `--lift-sm` | ring plus shadow in light, 1px ring in dark | `tokens.css`, Namaste `tokens.css` |
| Primary button | ink fill, 4px radius, 40px high (44px on touch), 0 18px, 14.5px at 600 | `primitives.css` (`.btn-primary`) |
| Ghost button | no fill, ink 2, 13px at 600, 7% ink fill on hover | Namaste `primitives.css` (`.btn-ghost`) |
| Icon button | 24px (44px on touch), ink 2, 9% ink fill on hover | Namaste `primitives.css` (`.icon-btn`) |
| Text link | 17px at 650, 2px underline, 6px offset, green ink on hover | `primitives.css` (`.link`) |
| Quiet link | ink 2, underline in rule 2, 4px offset | `primitives.css` (`.link-quiet`) |
| Focus | 2px ink outline, 2px offset, both themes | `base.css` |
| Filled input | `--field` fill, no border, 2px ink outline on focus | Namaste `primitives.css` (`.field`) |
| Base line field | mono 18px on a 2px ink rule that doubles on focus | Namaste `landing.css` (`.lp-open-row`) |
| Quick add | 16px input, plus glyph, 1px ink rule | Namaste `list.css` (`.quick-add-input-shell`) |
| Section label | 13px at 650 with a mono count | `primitives.css` (`.section-label`) |
| Ledger row | mono margin, name, one line, 14px block padding | `primitives.css` (`.ledger-row`) |
| App row | 36px (48px on touch), hover fill with a bleed, 4px radius | Namaste `primitives.css` (`.ledger-row`) |
| Node | 6px green circle beside a word | `primitives.css` (`.node`) |
| Status line | node, status, a second fact in ink 3, mono 12px | `primitives.css` (`.status`) |
| Key | mono 11.5px on `--field`, 3px radius | Namaste `primitives.css` (`kbd`) |
| Toast | ink fill, 13px, an outlined action button | Namaste `primitives.css` (`.app-toast`), `App.css` (`.triage-toast-action`) |
| Theme | `data-theme` on `<html>`, system preference until the toggle is pressed, stored under `theme` | `ThemeScript.astro`, `public/theme.js` |
| Site switch, avatar, footer | as built | `Header.astro`, `Footer.astro` |

## Added here

The system has no request log, key readout or deployment comparison. Namaste and Studio were checked for each one first. Every item below is drawn in the proofs.

1. Readout row. The family ledger row with a mono key in the margin (`auth`, `compute`, `tenancy`, `health`), the value as the row name and one line of text. It is the `.ledger-row` grid with an 88px margin.
2. Request log row. Status, method, path and duration in mono 13px (12px below 980px), on the Namaste app row. A status of 400 or above is set in `--alert` and always keeps its number. The whole row is one button.
3. Open log entry. A block filled with `--side` at the 4px radius, mono 13px on 1.6, as jch254.com sets code blocks. It holds the request id, the request body and the response body.
4. JSON in three inks and no hue: keys in ink, values in ink 2, punctuation in ink 3. Same rule as code on jch254.com.
5. Comparison table. The family table (13px labels at 650 over one 1px ink line) with no hairline under the rows. On the other two deployments a value that matches the current one recedes to ink 3 and a value that differs takes ink at 550, so the difference is carried by type.
6. The row the page is about. The current deployment and the selected record take the node, the title weight and the row hover fill, with a 16px bleed so the node sits inside the fill and the names stay aligned.
7. Key readout. `PK` and `SK` in mono 12px in a `--side` block. Fixed prefixes (`TENANT#`, `USER#`, `#EXAMPLE#`) are ink 3 and the ids are ink, which shows how the key is composed. A three row legend under it says where each id came from.
8. Quick add hint. The mono slot that holds Namaste's syntax key names the request the field will make: `POST /api/example`.
9. Identity groups. Two key and value lists side by side, each headed by its name at 16px and the endpoint it came from in mono.
10. Account bar. One mono line under the header: the deployment status line on the left, the signed-in email and a ghost "Sign out" on the right.
11. Code in a sentence is filled with `--field`, as on jch254.com, and never breaks across lines.
12. Header. The site switch shows `603.nz` and the current site. Below 980px the page links move to the footer, as they do on the other two sites.

## Experience changes proposed

Confirm or cut each one. "None" means the change uses what the API returns today.

| Change | Backend change |
|---|---|
| Signed-out page explains the stack and shows a live readout of this deployment from `/api/config` and `/api/health`, with sign-in beside it | None for auth and compute. Tenancy needs one of the two options in open question 1 |
| Deployment comparison driven by `deployments.ts` (which gains a `tenancy` field) and the runtime config | None |
| Request log replaces "Show raw response". Every call appears with method, path, status, duration, `x-request-id` and bodies. It works signed out. Kept in memory, capped at 50 entries | None. The API already sets `x-request-id` on every response. The log is fed by an observer on `api-client.ts`. The Authorization header is replaced with `Bearer [redacted]` before an entry is stored |
| Identity readout: the principal from `/api/auth/check` beside the local user from `/api/me` | None. The page makes one more request after sign-in |
| Key readout for the selected record, built from `tenantId` and `userId` in `/api/me` and the record id | None. The pattern from `Keys.userExample` is repeated in one demo module, with a test that pins it |
| Optimistic create, rename and delete, with the list reconciled from each response | None |
| Undo on delete. The row leaves at once, a toast offers "Undo" for five seconds and the DELETE is sent when the toast closes or the page is hidden | None. See open question 4 |
| Relative timestamps with the exact time on hover and focus, copy buttons on ids and keys, a list loading state, an empty state that says what creating a record will do | None |
| Keyboard: Enter saves and Esc cancels a rename, as today. Focus returns to the row afterwards and the selected record follows the arrow keys | None |
| "Check your email" state and link errors get full layouts | None for one honest message. See open question 2 |
| "What you are looking at" section with links to the README, `docs/architecture.md` and `infrastructure/README.md` | None |
| Light and dark themes with the family toggle | None. The theme script ships as a file because the CSP only runs scripts from the page's own origin |
| `App.tsx` and `auth/OidcApp.tsx` share one signed-in view | None. They duplicate the markup and the CRUD handlers today. Each shell keeps only its own auth |
| Truthful copy for `AUTH_PROVIDER=none` | None |
| Description, Open Graph tags, favicon and theme colours in `index.html` | None |

A guest session was considered and is not proposed. It would need a new public endpoint that creates a throwaway principal and a session, rate limiting on that endpoint and an expiry on the users and records it creates. That is a second auth path in a backend whose docs say each deployment runs exactly one, and a generated app would have to delete it. The signed-out page now gives a visitor the readout, the comparison and a working request log without an email address, which covers most of the reason for a guest session.

## Where the code will live

Three folders under `src/frontend/src`, so an app generated from this repo deletes the demo in one step.

`styles/` holds `tokens.css`, `fonts.css`, `base.css` and `primitives.css`, copied from jch254.com with the additions above. `ui/` holds the primitives worth keeping: header, footer, theme toggle, button, field, ledger row, toast, code and key readouts. `demo/` holds everything that exists to explain the project: the deployment readout and comparison, the request log, the identity and key readouts, the explainer section, `deployments.ts`, `demo-copy.ts` and the avatar.

No dependency is added. The CSS stays plain with custom properties.

## The proofs

Eight artboards on the design canvas: the signed-out page and the signed-in page with three records and the request log open, each at 1440 and 390 pixels wide, in light and dark. They are generated from one markup source with the token values inline, so the values in the table are the values drawn. The proofs show the magic-link deployment on ECS Fargate. On the Auth0 deployment the sign-in field becomes one primary button, "Log in with Auth0", and nothing else on the page moves.

Contrast in the proofs, lowest value across the surfaces each colour sits on: ink 14.4 light and 13.8 dark, ink 2 7.9 and 9.0, ink 3 5.2 and 5.5, alert 5.2 and 7.4, button text 17.0 and 16.4. The node is 2.5 on light paper, so it always sits beside a word.

## Open questions

1. Tenancy in the readout. `/api/config` returns the auth provider and the compute backend and says nothing about tenant mode. Adding `tenantResolutionMode` to that response is one public field the backend already holds. Without it the value comes from `deployments.ts` for the three known hosts and the row is left out anywhere else, such as local development. Which do you want?
2. Expired and used links. The web branch of `GET /api/auth/verify` redirects every failure to `/?auth=error&reason=consumed`, so the frontend cannot tell an expired link from a used one. I would write one message that is true for both. Telling them apart needs a change to `auth.controller.ts` and `auth.service.ts`.
3. Headline. The proof says "The baseline I copy when I start a product." It is taken from how you describe the repo. Change it if you would put it differently.
4. Undo on delete is done by holding the DELETE for five seconds in the browser. Nothing is added to the backend, and a record deleted just before the tab is killed may survive. The alternative is to delete at once and have "Undo" create a new record, which gives it a new id and a new key.
5. The selected record's fill. The family uses `--hover` only for hover. Here the selected row keeps it so the row and the readout read as a pair. Say if you would sooner keep to the node and the weight.
6. Fonts on Lambda. Two of the three deployments serve static files through `@codegenie/serverless-express` behind API Gateway. I have not yet confirmed that a woff2 file comes back intact that way. It gets checked on the Lambda demo before the build stage relies on it. The fonts will be imported from CSS so Vite puts them under `/assets` with the immutable cache header.

## Bundle size

Before, from the build in `src/frontend/dist`: 390.1 kB of JavaScript (117.5 kB gzipped) and 5.7 kB of CSS (1.6 kB gzipped), with no font files. The redesign adds two Latin woff2 files, 46.8 kB and 20.7 kB, cached as immutable assets. The after numbers are reported at the end of the build stage.
