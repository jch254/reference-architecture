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

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const token = getToken();

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Network request failed');
  }

  if (!res.ok) {
    let errorBody: ApiErrorResponse | undefined;
    try {
      errorBody = await res.json();
    } catch {
      // Response body is not JSON
    }
    const error = errorBody?.error;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      error?.requestId,
    );
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json();
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
