export type AuthProvider = 'internal_magic_link' | 'oidc';

/** Provider-neutral authenticated identity, set by AuthGuard. */
export interface AuthPrincipal {
  provider: AuthProvider;
  subject: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** Legacy magic-link identity — preserved for existing request handlers. */
export interface UserIdentity {
  email: string;
  tenantSlug: string;
}

/** Cookie/session claims — used only during auth validation */
export interface SessionClaims {
  email: string;
  tenantSlug: string;
  sessionVersion: string;
  iat: number;
}

/** Request context stored in AsyncLocalStorage */
export interface RequestContext {
  requestId: string;
  tenantSlug: string;
  user: UserIdentity | null;
  principal?: AuthPrincipal | null;
}
