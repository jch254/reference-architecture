import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { config } from '../../common/config';
import { AuthPrincipal, SessionClaims, UserIdentity } from '../../common/context/identity.types';
import { requestContextStore } from '../../common/context/request-context.store';
import { AuthService } from './auth.service';
import { OidcJwtValidator } from './oidc-jwt.validator';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly oidcJwtValidator: OidcJwtValidator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();

    switch (config.authProvider) {
      case 'none':
        throw new UnauthorizedException();
      case 'oidc':
        return this.authenticateOidc(req);
      case 'internal_magic_link':
        return this.authenticateInternalMagicLink(req);
    }
  }

  private async authenticateOidc(req: Request): Promise<boolean> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException();
    }

    const rawToken = this.parseBearerToken(authHeader);
    if (!this.isJwt(rawToken)) {
      throw new UnauthorizedException();
    }

    const principal = await this.oidcJwtValidator.validate(rawToken);
    this.attachPrincipal(req, principal);
    return true;
  }

  private async authenticateInternalMagicLink(req: Request): Promise<boolean> {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const rawToken = this.parseBearerToken(authHeader);
      if (this.isJwt(rawToken)) {
        throw new UnauthorizedException();
      }

      const identity = await this.authService.validateApiToken(rawToken, req.tenantSlug);
      if (!identity) throw new UnauthorizedException();

      this.attachPrincipal(
        req,
        this.authService.toMagicLinkPrincipal(identity.email),
        identity,
      );
      return true;
    }

    // Fall back to signed cookie
    const payloadStr = req.signedCookies?.['__session'];

    if (!payloadStr || typeof payloadStr !== 'string') {
      throw new UnauthorizedException();
    }

    let payload: SessionClaims;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      throw new UnauthorizedException();
    }

    const valid = await this.authService.validateSession(payload, req.tenantSlug);
    if (!valid) throw new UnauthorizedException();

    const user = { email: payload.email, tenantSlug: payload.tenantSlug };
    this.attachPrincipal(
      req,
      this.authService.toMagicLinkPrincipal(payload.email),
      user,
    );

    return true;
  }

  private parseBearerToken(authHeader: string): string {
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const rawToken = authHeader.slice('Bearer '.length);
    if (!rawToken || rawToken.trim() !== rawToken || /\s/.test(rawToken)) {
      throw new UnauthorizedException();
    }

    return rawToken;
  }

  private isJwt(rawToken: string): boolean {
    return rawToken.split('.').length === 3;
  }

  private attachPrincipal(
    req: Request,
    principal: AuthPrincipal,
    user?: UserIdentity,
  ): void {
    req.principal = principal;
    if (user) req.user = user;

    const store = requestContextStore.getStore();
    if (!store) return;

    store.principal = principal;
    store.user = user ?? null;
  }
}
