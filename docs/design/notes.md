# Notes

Things noticed during the redesign that look broken or out of date. None of them has been changed.

## Backend

Link errors are not told apart. The web branch of `GET /api/auth/verify` in `auth.controller.ts` catches every failure and redirects to `/?auth=error&reason=consumed`. An expired link, a link for another tenant and a used link all arrive with the same reason. The frontend's "invalid or has expired" message is only reached when the link has no token at all.

`AUTH_PROVIDER=none` still serves the sign-in form. The frontend renders the magic-link app for `none`, with copy that describes a link by email. `docs/architecture.md` says this mode creates no authenticated principal, so every protected route answers 401 and signing in leads nowhere. The redesign rewrites the copy. Whether `POST /api/auth/request-link` should still send email in this mode is a backend question.

`/api/config` does not say which tenant mode the deployment runs.

The emailed sign-in button in `auth.service.ts` is styled inline with `#007AFF` and an 8px radius. It will not match the page once the redesign ships.

## Docs

The "Public demo deployments" table in `docs/architecture.md` lists two of the three deployments. `reference-architecture-lambda.603.nz` (`infrastructure/terraform-lambda/environments/prod-lambda/terraform.tfvars`, subdomain tenancy, magic link) is missing.

The same document says of frontend auth that it "renders the existing magic-link UI unchanged" and that the default demo stays "byte-for-byte unaffected". Both lines will be out of date after the redesign.

The README's list of live demos labels the first one "ECS Fargate" and the third "same app on Lambda" without naming their auth. The README also describes the "Running on …" badge in two places. Those two places get updated in the build stage because the UI they describe changes.

The README and `docs/architecture.md` use em dashes and Oxford commas throughout. They are outside this work apart from the badge lines.

## Fonts

The two Spline Sans Mono files carry each other's names. `spline-sans-mono-latin.woff2` (20.7 kB) holds the Latin Extended glyphs and, of ASCII, only the space and `A`. `spline-sans-mono-latin-ext.woff2` (36.5 kB) holds ASCII and Latin-1. The Schibsted Grotesk pair is named correctly. The same two files, byte for byte, are in `studiodaw/src/frontend/public/fonts`, `namaste/src/frontend/public/fonts` and `jch254dotcom/public/fonts`, and each repo's `fonts.css` gives the file called `latin` the Latin `unicode-range`. A browser therefore fetches the Latin Extended file for ASCII, finds no glyph and falls through to the next family, so mono text on Studio, Namaste and jch254.com is set in the system mono (SF Mono on a Mac). Checked by reading each file's character map and by rendering one line three ways in Chromium.

The proofs have the same fault. `proofs/html/fonts/mono.woff2` is the 20.7 kB file, so the mono in the eight proof screenshots is a fallback face and not Spline Sans Mono. Measured in Chromium on this Mac, a line set in Spline Sans Mono is 0.3% narrower than the same line in the fallback, so the measurements in the proofs hold.

In this repo each file is named for what it contains, so `src/frontend/src/styles/fonts/spline-sans-mono-latin.woff2` is the 36.5 kB file. The other three repos have not been touched. `direction.md` gave the first-load font weight as 46.8 kB and 20.7 kB. With the right file it is 46.8 kB and 36.5 kB.

## Fonts on Lambda

Fixed in `src/backend/lambda.ts` on 21 November 2026, with the owner's approval. Still to be confirmed on the deployed Lambda.

Left at its defaults, the Lambda adapter serves the four woff2 files broken. `@codegenie/serverless-express` returns a body as base64 only when the response has a `content-encoding` of gzip, deflate or br, or a content type matching `image/*`. `lambda.ts` passed it no `binarySettings`, so a `font/woff2` response was turned into a UTF-8 string and arrived about 1.8 times its size and unreadable. The avatar, the favicons and the Open Graph image are `image/*` and came through intact.

`lambda.ts` now passes `binarySettings: { contentTypes: BINARY_CONTENT_TYPES }`, which is `image/*` and `font/*`. `lambda.spec.ts` pins it: a font and an image come back byte for byte, text stays text and the adapter's defaults still break a font, so the test says if the setting ever stops being needed.

It was reproduced and checked locally, not on the deployed Lambda. `node docs/design/tools/lambda-static.mjs` runs the adapter with the settings from the built handler in front of `express.static` and compares every file in `src/frontend/dist` with what comes back: all sixteen are intact. `ADAPTER_OPTIONS='{}' node docs/design/tools/lambda-static.mjs` runs it at the adapter's defaults: four files broken, twelve intact.

The fonts and the fix ship in the same branch, so no broken font has been served or cached at the Cloudflare edge. After the first deploy, fetch a woff2 file from `reference-architecture-lambda.603.nz` and `reference-architecture-auth0.603.nz` and compare its size with the file in `dist/assets`. The ECS deployment serves files straight from Express and was never affected.

## Out of date after the redesign

`docs/architecture.md` says the frontend "renders the existing magic-link UI unchanged" for `none` and `internal_magic_link` and that the default demo stays "byte-for-byte unaffected". The README says the same under "Auth0 frontend login" ("renders the existing magic-link demo UI unchanged"). Neither is true now: all three deployments render the new page, and `none` no longer shows a sign-in form. Only the two README lines about the "Running on" badge were changed.

`index.html` gives `og:image` as `https://reference-architecture.603.nz/og.png`. Open Graph images need an absolute address and one bundle serves three hosts, so all three point at the first deployment. There is no `og:url` for the same reason. A product built from this repo needs to change that line.

The redesign's readout and request log now show a failed `GET /api/config`, which the note under Frontend below says went unseen. The fallback itself is unchanged: the page still assumes magic link.

## Frontend

When `/api/config` fails, `Root.tsx` renders the magic-link app with no sign that anything went wrong. On an OIDC deployment that shows an email form that cannot work.

A 401 on the magic-link path signs the user out with no message.

`src/frontend/dist` on this machine was built on 12 July. The bundle sizes in `direction.md` are from that build and get measured again before the build stage.

## Mobile (out of scope)

`src/mobile` was only skimmed. Titles and buttons are in Title Case ("Sign In" in `RootNavigator.tsx` and `SignInScreen.tsx`, "Sign Out" in `SettingsScreen.tsx`). `ScreenLayout.tsx` and `Button.tsx` hard-code `#fff`. The app has a light theme only and loads no font files. Bringing it into the family means bundling Schibsted Grotesk and Spline Sans Mono into both native projects, as noted for Namaste.
