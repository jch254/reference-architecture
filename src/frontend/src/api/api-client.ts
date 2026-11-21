import type { ApiErrorCode, ApiErrorResponse } from '../../../shared/api-types';

export type { ApiErrorCode };

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode | 'NETWORK_ERROR',
    message: string,
    public readonly status?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TOKEN_KEY = 'api_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Optional async bearer-token source. OIDC deployments register an Auth0
 * access-token getter here; magic-link/default deployments leave it unset and
 * fall back to the localStorage token (plus the signed session cookie).
 * Only one auth provider is active per deployment, so a module-level slot is
 * sufficient and avoids threading the token through every call site.
 */
type TokenProvider = () => Promise<string | null> | string | null;

let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

async function resolveToken(): Promise<string | null> {
  if (tokenProvider) {
    try {
      return await tokenProvider();
    } catch {
      // Token acquisition failed (e.g. login required / refresh expired).
      // Treat as unauthenticated rather than throwing here; the request will
      // proceed without a token and the API returns a predictable 401.
      return null;
    }
  }
  return getToken();
}

/**
 * What an observer is told about one finished request. It never holds a
 * credential: the Authorization header is replaced before the exchange is
 * built, so no token leaves this module.
 */
export interface ApiExchange {
  method: string;
  path: string;
  /** The HTTP status, or null when the request got no answer. */
  status: number | null;
  durationMs: number;
  /** The x-request-id response header. */
  requestId: string | null;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  /** The parsed JSON body, envelope included, when there was one. */
  responseBody?: unknown;
}

export type ApiObserver = (exchange: ApiExchange) => void;

export const REDACTED_AUTHORIZATION = 'Bearer [redacted]';

const observers = new Set<ApiObserver>();

/**
 * Watch every request this client makes, for logging or metrics. Returns a
 * function that stops watching. With no observer registered the client does
 * no extra work.
 */
export function observeApi(observer: ApiObserver): () => void {
  observers.add(observer);
  return () => {
    observers.delete(observer);
  };
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      name.toLowerCase() === 'authorization' ? REDACTED_AUTHORIZATION : value,
    ]),
  );
}

function notify(exchange: ApiExchange): void {
  for (const observer of observers) {
    try {
      observer(exchange);
    } catch {
      // An observer must never break a request.
    }
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Let the request outlive the page, for a write sent as the page is hidden. */
  keepalive?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, keepalive } = options;

  const token = await resolveToken();

  const requestHeaders: Record<string, string> = {
    ...(body !== undefined && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...headers,
  };

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: requestHeaders,
    ...(body !== undefined && { body: JSON.stringify(body) }),
    ...(keepalive && { keepalive }),
  };

  const started = performance.now();
  const report = (res: Response | null, responseBody?: unknown) => {
    if (observers.size === 0) return;
    notify({
      method,
      path,
      status: res ? res.status : null,
      durationMs: Math.round(performance.now() - started),
      requestId: res ? res.headers.get('x-request-id') : null,
      requestHeaders: redactHeaders(requestHeaders),
      ...(body !== undefined && { requestBody: body }),
      ...(responseBody !== undefined && { responseBody }),
    });
  };

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    report(null);
    throw new ApiError('NETWORK_ERROR', 'Network request failed');
  }

  if (!res.ok) {
    let errorBody: ApiErrorResponse | undefined;
    try {
      errorBody = await res.json();
    } catch {
      // Response body is not JSON
    }
    report(res, errorBody);
    const error = errorBody?.error;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      error?.requestId,
    );
  }

  if (res.status === 204) {
    report(res);
    return undefined as T;
  }

  let json: { data: T };
  try {
    json = await res.json();
  } catch (err) {
    report(res);
    throw err;
  }
  report(res, json);
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, options: Pick<RequestOptions, 'keepalive'> = {}) =>
    request<T>(path, { method: 'DELETE', ...options }),
};
