# Reference Architecture demo design direction

Status: built on the `redesign` branch on 21 November 2026. The system, every state in `audit.md` and the verification pass are done. "Where the build is" at the end says what is left.

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

## Added in the build

What the proofs did not draw. Namaste and Studio were checked for each one first.

13. Touch rows are 44px, as the 390px proof draws the request log, not Namaste's 48px. A record row on a phone is two lines and 56px.
14. The compact range. From 981 to 1279px the page keeps two columns, but the hero splits evenly, the deployment readout stacks its name over its text and the two identity lists stack. Without it the readout's text column is 2px wide at 1024px. The comparison's five columns keep the proof's proportions with a floor under each, so `internal_magic_link` never runs into the next column.
15. Rename field. Namaste's filled input, 28px high, in the name's place. Its text starts where the name did, so the fill runs 10px into the margin. The two actions become a tick and a cross.
16. Exact time. The list shows "2 min ago". On hover the timestamp the API returned shows above it in a small label with the toast's ink fill. Hover is not the only way to it: the key readout gains a `created` row with the same timestamp, which the keyboard and a finger reach by selecting the record. A label that appeared on keyboard focus was built first and removed, because it covered the row above on every arrow press.
17. A focused row is not filled. Namaste fills a row on hover and on focus. Here the fill also means selected, so a focused row takes the ring only.
18. Notice. An error that stands in for a whole view (the list did not load, the session is no longer valid, Auth0 is not configured) is a block on `--alert-wash` with `--alert` text at the 4px radius. An error that belongs to one control is a line of `--alert` text under it.
19. Loading. A state that is waiting on one request shows the status line and names the request: "Loading the deployment config", "Checking for a session", "Waiting for Auth0". The list shows "Loading your records" in mono at the height of a row. There is no skeleton or spinner.
20. A pending record. A record the API has not answered for yet shows "saving" in the margin where its id will be and cannot be selected.
21. Copy button. Namaste's icon button with the copy glyph, which turns to a tick for a second and a half. Inside a line of mono it stays 24px and a pad widens the touch target to 44px. It is on the key and on the request id. It is not on the user id: with it the UUID no longer fits on one line at 1440px.
22. The status line wraps. On a phone the second fact drops under the host and lines up with it, clear of the node.
23. `AUTH_PROVIDER=none` and a missing Auth0 client id keep the sign-in block's place in the column: a label and a paragraph for the first, a notice for the second.
24. Favicon. The family tile with an "r" from Schibsted Grotesk at weight 650, set at 30 units on the 32 unit tile and converted to outlines. The node sits on the baseline under the arm of the r. `docs/design/tools/assets.mjs` draws the PNG fallbacks and the Open Graph image from it.
25. The undo toast stops its clock while the pointer or the keyboard is on it, and Ctrl or Cmd with Z undoes a held delete.
26. The newest write opens in the request log by itself. Before any write, the signed-out page opens `GET /api/config`.

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

## Decisions

The open questions from the proposal, as answered.

1. Tenancy comes from `deployments.ts` for the three known hosts and the row is left out anywhere else. `/api/config` is unchanged.
2. Expired and used links get one message that is true for both. `auth.controller.ts` is unchanged. A link with no token keeps its own message.
3. The headline is "The baseline I copy when I start a product."
4. A delete is held for five seconds in the browser while a toast offers "Undo". It is sent when the toast closes, when the page is hidden and before signing out.
5. The selected record and the current deployment keep the row hover fill along with the node and the title weight.
6. No guest session.
7. Every row in "Experience changes proposed" is built.

## Open questions

1. Fonts on Lambda. The adapter serves woff2 files broken and the fix is one setting in `src/backend/lambda.ts`. See "Fonts on Lambda" in `notes.md`. It has been reproduced locally and not yet checked on `reference-architecture-lambda.603.nz`.
2. Bundle weight. The Auth0 SDK's own minified build is 171.8 kB, a large share of the 417.2 kB, and the two magic-link deployments never run it. Loading `auth/OidcApp.tsx` with a dynamic import would take it out of their first load. It is still one build and one set of files. Not measured and not done.

## Bundle size

Before, `main` at `5ce4a31` rebuilt on 21 November 2026: 390.1 kB of JavaScript (117.9 kB gzipped) and 5.7 kB of CSS (1.6 kB gzipped), with no font or image files.

After: 417.2 kB of JavaScript (127.7 kB gzipped) and 27.4 kB of CSS (6.1 kB gzipped). That is 27.1 kB more JavaScript, or 9.8 kB gzipped, for the request log, the readouts, the comparison, optimistic writes and undo. The first load also fetches the two Latin fonts, 46.8 kB and 36.5 kB, one avatar (5.0 kB in light, 9.1 kB in dark) and `theme.js` (2.2 kB). The two Latin Extended fonts, 20.9 kB and 20.7 kB, are fetched only if a record's name needs them. Everything under `/assets` is served as immutable.

## Where the build is

| Stage | State |
|---|---|
| System: fonts, tokens, base, primitives, `ui/` | Built |
| Every state in `audit.md`, magic link, OIDC and `none`, both themes | Built |
| Shared signed-in view | Built. `App.tsx` and `auth/OidcApp.tsx` hold only their own auth |
| Verification at 390, 768, 1280 and 1920 | Done with `docs/design/tools/shoot.mjs`: 32 states, 256 captures, no sideways overflow, no target under 44px at 390 or 768, no console error under the Helmet policy. Also run against the real backend on DynamoDB Local, where `pnpm run validate` passes |
| Fonts on the two Lambda deployments | Open. Needs the backend setting above, then a check on the deployed site |
| Deploy | Not done |
