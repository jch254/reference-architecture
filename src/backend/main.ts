import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { join } from 'path';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api/http-exception.filter';
import { ApiResponseInterceptor } from './common/api/response.interceptor';
import { config } from './common/config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser(config.cookieSecret));
  app.use(helmet());
  app.set('trust proxy', 1);

  const isLocal = config.baseDomain === 'localhost';
  app.enableCors({
    origin: isLocal
      ? true
      : [new RegExp(`https?://([^.]+\\.)?${config.baseDomain.replace('.', '\\.')}`)],
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  // Serve frontend static files
  const frontendPath = join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));

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
  <title>Opening app\u2026</title>
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
  <script>setTimeout(function(){window.location.href=${safeDeepLink}},100)</script>
</body>
</html>`);
  });

  // SPA fallback: non-API routes serve index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(frontendPath, 'index.html'));
  });

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Application listening on port ${config.port}`);
}

bootstrap();
