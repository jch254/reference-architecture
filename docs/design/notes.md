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

## Frontend

When `/api/config` fails, `Root.tsx` renders the magic-link app with no sign that anything went wrong. On an OIDC deployment that shows an email form that cannot work.

A 401 on the magic-link path signs the user out with no message.

`src/frontend/dist` on this machine was built on 12 July. The bundle sizes in `direction.md` are from that build and get measured again before the build stage.

## Mobile (out of scope)

`src/mobile` was only skimmed. Titles and buttons are in Title Case ("Sign In" in `RootNavigator.tsx` and `SignInScreen.tsx`, "Sign Out" in `SettingsScreen.tsx`). `ScreenLayout.tsx` and `Button.tsx` hard-code `#fff`. The app has a light theme only and loads no font files. Bringing it into the family means bundling Schibsted Grotesk and Spline Sans Mono into both native projects, as noted for Namaste.
