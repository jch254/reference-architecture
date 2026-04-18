import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { SessionClaims } from '../../common/context/identity.types';
import { requestContextStore } from '../../common/context/request-context.store';
import { AuthService } from './auth.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
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
    req.user = user;

    const store = requestContextStore.getStore();
    if (store) store.user = user;

    return true;
  }
}
