import { describe, it, expect, beforeEach, vi } from 'vitest';

import { api, setToken, setTokenProvider } from './api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api-client bearer token strategy', () => {
  beforeEach(() => {
    setTokenProvider(null);
    vi.restoreAllMocks();
    // jsdom's localStorage is inconsistent across versions; use a minimal
    // deterministic in-memory implementation for these unit tests.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it('attaches Authorization header from the registered token provider', async () => {
    setTokenProvider(() => Promise.resolve('jwt-from-auth0'));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/me');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-from-auth0');
  });

  it('omits Authorization header when no token is available', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/example');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('falls back to the localStorage token when no provider is set (magic-link path)', async () => {
    setToken('magic-link-token');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/auth/session');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer magic-link-token');
  });
});
