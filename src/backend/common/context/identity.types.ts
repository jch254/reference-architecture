/** Authenticated user identity — set by AuthGuard, decoupled from domain entities */
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
}
