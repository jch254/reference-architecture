import { Body, Controller, Get, Headers, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';

import { config } from '../../common/config';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('request-link')
  async requestLink(
    @Body('email') email: string,
    @Req() req: Request,
    @Headers('x-cookie-secret') secret: string,
  ): Promise<{ message: string } | { token: string }> {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { message: 'If that email is valid, a link has been sent.' };
    }

    if (secret && secret === config.cookieSecret) {
      const token = await this.authService.requestLink(email, req.tenantSlug, true);
      if (!token) throw new UnauthorizedException();
      return { token };
    }

    await this.authService.requestLink(email, req.tenantSlug);
    return { message: 'If that email is valid, a link has been sent.' };
  }

  @Public()
  @Get('verify')
  async verify(
    @Query('t') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      res.redirect('/?auth=error');
      return;
    }

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

      res.redirect('/');
    } catch {
      res.redirect('/?auth=error');
    }
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
