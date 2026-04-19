import type { ApiErrorCode, ApiErrorResponse } from '../../../shared/api-types';
import { clearToken, getToken } from './token-storage';

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

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null): void {
  onUnauthorized = cb;
}

let baseUrl = '';

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, '');
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const token = await getToken();

  const init: RequestInit = {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Network request failed');
  }

  if (res.status === 401) {
    await clearToken();
    onUnauthorized?.();
    throw new ApiError('UNAUTHORIZED', 'Unauthorized', 401);
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
