import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { join, sep } from 'path';

import { AppModule } from './app.module';
import { buildCorsOrigin } from './common/api/cors';
import { ApiExceptionFilter } from './common/api/http-exception.filter';
import { ApiResponseInterceptor } from './common/api/response.interceptor';
import { config } from './common/config';

/**
 * Helmet with a strict default CSP.
 *
 * All deployments run behind the Cloudflare proxy, which auto-injects the
 * Cloudflare Web Analytics beacon script. `script-src` always allows
 * `static.cloudflareinsights.com` and `connect-src` always allows
 * `cloudflareinsights.com` so the beacon can load and report.
 *
 * For OIDC deployments the Auth0 SPA SDK must reach the Auth0 origin to
 * exchange the authorization code for tokens (`connect-src`) and to run
 * silent token renewal in a hidden iframe (`frame-src`), so the Auth0 issuer
 * origin is added to those directives only when AUTH_PROVIDER=oidc.
 */
function buildHelmet(): ReturnType<typeof helmet> {
  let auth0Extra: string[] = [];
  if (config.authProvider === 'oidc') {
    try {
      const auth0Origin = new URL(config.oidc.issuer).origin;
      if (auth0Origin) {
        auth0Extra = [auth0Origin];
      }
    } catch {
      // Issuer URL invalid; auth0Extra stays empty.
    }
  }

  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://static.cloudflareinsights.com'],
        'connect-src': ["'self'", 'https://cloudflareinsights.com', ...auth0Extra],
        'frame-src': ["'self'", ...auth0Extra],
      },
    },
  });
}

/**
 * Build and fully configure the Nest application without starting a listener.
 *
 * This is the single source of truth for app wiring (middleware, CSP, CORS,
 * global pipeline, static frontend serving, SPA fallback). It is shared by:
 *
 * - `main.ts`    — calls `app.listen()` for the ECS container / local runtime.
 * - `lambda.ts`  — calls `app.init()` and hands the Express instance to the
 *                  serverless adapter (no listener).
 *
 * Keeping listen-vs-init out of here is what lets the exact same app run on
 * ECS Fargate and on Lambda (container image) with no behavioural drift.
 */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser(config.cookieSecret));
  app.use(buildHelmet());
  app.set('trust proxy', 1);

  app.enableCors({
    origin: buildCorsOrigin(config.baseDomain, config.tenantResolutionMode),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  // Serve frontend static files.
  //
  // Vite content-hashes everything under /assets (e.g. index-ycEsocqM.js), so
  // those are immutable — a content change produces a new filename — and can be
  // cached forever. index.html is the unhashed entrypoint referencing them, so
  // it must always be revalidated (no-cache) or clients would pin stale asset
  // URLs after a deploy. With these headers the Cloudflare edge serves static
  // traffic without revalidating hashed assets against the origin (ECS/Lambda).
  const frontendPath = join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(
    express.static(frontendPath, {
      setHeaders: (res: Response, filePath: string) => {
        if (filePath.includes(`${sep}assets${sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // Deep-link redirect page for magic-link auth
  app.use('/auth/verify', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const token = String(req.query.token ?? '');
    const email = String(req.query.email ?? '');

    if (!token || !/^[a-f0-9]+$/i.test(token)) {
      res.status(400).send('Invalid or missing token');
      return;
    }

    const deepLink = `referenceapp://auth/verify?token=${encodeURIComponent(token)}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
    const safeDeepLink = JSON.stringify(deepLink);           // safe for JS
    const htmlDeepLink = deepLink.replace(/&/g, '&amp;');    // safe for HTML attribute
    const htmlToken = token.replace(/[<>"'&]/g, '');        // hex-only, but belt-and-suspenders
    const webVerifyLink = `/api/auth/verify?token=${encodeURIComponent(token)}&web=1`;
    const htmlWebLink = webVerifyLink.replace(/&/g, '&amp;');

    // Override Helmet CSP to allow the inline redirect script
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
    );

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Opening app…</title>
  <style>
    body{font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:48px 24px;color:#333}
    .btn{display:inline-block;background:#007AFF;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:17px;margin:6px}
    .btn-secondary{background:#555}
    .token{word-break:break-all;background:#f5f5f5;padding:12px;border-radius:6px;font-family:monospace;font-size:13px;margin:8px 0}
    .muted{color:#888;font-size:14px;margin-top:32px}
    .or{color:#888;font-size:14px;margin:16px 0 8px}
  </style>
</head>
<body>
  <h2>Opening app&hellip;</h2>
  <p>If the app doesn&rsquo;t open automatically:</p>
  <p><a href="${htmlDeepLink}" class="btn">Open in App</a></p>
  <p class="or">or</p>
  <p><a href="${htmlWebLink}" class="btn btn-secondary">Continue in Browser</a></p>
  <p class="muted">Don&rsquo;t have the app? Use Continue in Browser above.</p>
  <p class="muted">Or copy this token and paste it in the app:</p>
  <p class="token">${htmlToken}</p>
  <script>setTimeout(function(){window.location.href=${safeDeepLink}},0)</script>
</body>
</html>`);
  });

  // SPA fallback: non-API routes serve index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(frontendPath, 'index.html'), {
      cacheControl: false,
      headers: { 'Cache-Control': 'no-cache' },
    });
  });

  return app;
}
