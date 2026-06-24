/** Standard API error codes */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

/** Standard API success response envelope */
export interface ApiResponse<T> {
  data: T;
}

/** Standard API error response envelope */
export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}

/** Provider-neutral auth provider selector exposed to clients. */
export type RuntimeAuthProvider = 'none' | 'internal_magic_link' | 'oidc';

/**
 * Compute backend serving this deployment. Detected at runtime (Lambda and ECS
 * set distinctive environment variables), so the same bundle reports whichever
 * platform it is actually running on.
 */
export type RuntimeCompute = 'lambda' | 'ecs' | 'local';

/**
 * Public runtime config served by GET /api/config. Lets a single frontend
 * bundle adapt to each deployment's auth provider without build-time env.
 * All values here are public (no secrets); `auth0` is only populated when the
 * deployment runs AUTH_PROVIDER=oidc with a configured SPA client id.
 */
export interface RuntimeConfig {
  authProvider: RuntimeAuthProvider;
  compute: RuntimeCompute;
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
  } | null;
}
