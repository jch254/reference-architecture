import { Body, Controller, Get, Headers, HttpException, Logger, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { Request, Response } from 'express';

import { config } from '../../common/config';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';

// Per-email rate limiter (complements per-IP throttling from @nestjs/throttler)
const emailRateMap = new Map<string, { count: number; resetAt: number }>();
const EMAIL_RATE_LIMIT = 3;
const EMAIL_RATE_WINDOW = 60_000;

function checkEmailRate(ip: string, email: string): boolean {
  const key = createHash('sha256').update(`${ip}:${email.toLowerCase().trim()}`).digest('hex');
  const now = Date.now();
  const entry = emailRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    emailRateMap.set(key, { count: 1, resetAt: now + EMAIL_RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= EMAIL_RATE_LIMIT;
}

// Periodic cleanup of stale entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of emailRateMap) {
    if (now > entry.resetAt) emailRateMap.delete(key);
  }
}, 5 * 60_000).unref();

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('request-link')
  async requestLink(
    @Body('email') email: string,
    @Req() req: Request,
    @Headers('x-cookie-secret') secret: string,
  ): Promise<{ message: string } | { token: string }> {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { message: 'If that email is valid, a link has been sent.' };
    }

    if (!checkEmailRate(req.ip ?? 'unknown', email)) {
      this.logger.warn(`request-link rate limited (ip+email) for ${email} in tenant ${req.tenantSlug}`);
      throw new HttpException('Too Many Requests', 429);
    }

    if (secret && secret === config.cookieSecret) {
      const token = await this.authService.requestLink(email, req.tenantSlug, true);
      if (!token) throw new UnauthorizedException();
      this.logger.log(`request-link issued (suppressed) for ${email} in tenant ${req.tenantSlug}`);
      return { token };
    }

    await this.authService.requestLink(email, req.tenantSlug);
    this.logger.log(`request-link issued for ${email} in tenant ${req.tenantSlug}`);
    return { message: 'If that email is valid, a link has been sent.' };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Get('verify')
  async verify(
    @Query('token') token: string,
    @Query('json') json: string,
    @Query('web') web: string,
    @Query('email') emailParam: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {

    if (!token) {
      if (json === '1') {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing token' } });
      } else {
        res.redirect('/?auth=error');
      }
      return;
    }

    // Mobile / API: consume the OTP and return a bearer token
    if (json === '1') {
      try {
        const session = await this.authService.verify(token, req.tenantSlug);

        // Also set a session cookie for web clients
        const payload = JSON.stringify({
          email: session.email,
          tenantSlug: session.tenantSlug,
          sessionVersion: session.sessionVersion,
          iat: Date.now(),
        });

        const isLocal = config.baseDomain === 'localhost';

        res.cookie('__session', payload, {
          signed: true,
          httpOnly: true,
          secure: !isLocal,
          sameSite: 'lax',
          path: '/',
          maxAge: config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
        });

        // Issue a bearer token so mobile clients don't need a separate call
        const bearerToken = await this.authService.issueApiToken(session.email, req.tenantSlug);
        this.logger.log(`verify success (json) for ${session.email} in tenant ${req.tenantSlug}`);
        res.json({ data: { ok: true, token: bearerToken } });
      } catch (err) {
        this.logger.warn(`verify failure (json) in tenant ${req.tenantSlug}: ${err instanceof Error ? err.message : 'unknown'}`);
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
      }
      return;
    }

    // Web browser: consume the OTP, set session cookie, redirect to app
    if (web === '1') {
      try {
        const session = await this.authService.verify(token, req.tenantSlug);
        const payload = JSON.stringify({
          email: session.email,
          tenantSlug: session.tenantSlug,
          sessionVersion: session.sessionVersion,
          iat: Date.now(),
        });

        const isLocal = config.baseDomain === 'localhost';

        res.cookie('__session', payload, {
          signed: true,
          httpOnly: true,
          secure: !isLocal,
          sameSite: 'lax',
          path: '/',
          maxAge: config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
        });

        this.logger.log(`verify success (web) for ${session.email} in tenant ${req.tenantSlug}`);
        res.redirect('/?auth=success');
      } catch (err) {
        this.logger.warn(`verify failure (web) in tenant ${req.tenantSlug}: ${err instanceof Error ? err.message : 'unknown'}`);
        res.redirect('/?auth=error&reason=consumed');
      }
      return;
    }

    // Browser fallback: 302 redirect to app deep link without consuming the token
    const email = emailParam || '';
    const appLink = `referenceapp://auth/verify?token=${encodeURIComponent(token)}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
    res.redirect(302, appLink);
  }

  @Post('logout')
  async logout(@Res() res: Response): Promise<void> {
    const isLocal = config.baseDomain === 'localhost';
    res.clearCookie('__session', {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      path: '/',
    });
    res.json({ message: 'Logged out' });
  }

  @Get('session')
  async session(@Req() req: Request): Promise<{ email: string; tenantSlug: string }> {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return { email: req.user.email, tenantSlug: req.user.tenantSlug };
  }
}
