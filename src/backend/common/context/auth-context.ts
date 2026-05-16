import { UnauthorizedException } from '@nestjs/common';

import { AuthPrincipal } from './identity.types';
import { requestContextStore } from './request-context.store';

export class AuthContext {
  static getPrincipal(): AuthPrincipal | null {
    return requestContextStore.getStore()?.principal ?? null;
  }

  static requirePrincipal(): AuthPrincipal {
    const principal = AuthContext.getPrincipal();
    if (!principal) {
      throw new UnauthorizedException();
    }

    return principal;
  }
}