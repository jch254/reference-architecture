import { describe, it, expect, beforeEach, vi } from 'vitest';

import { api, observeApi, setToken, setTokenProvider, type ApiExchange } from './api-client';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
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

describe('api-client observer', () => {
  let seen: ApiExchange[];
  let stop: () => void;

  beforeEach(() => {
    setTokenProvider(null);
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    seen = [];
    stop = observeApi((exchange) => seen.push(exchange));
    return () => stop();
  });

  it('reports the method, path, status, request id and both bodies', async () => {
    const created = { data: { id: '3f9a1c2e', name: 'First' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(created, 201, { 'x-request-id': 'c41e9b70' })),
    );

    await api.post('/api/example', { name: 'First' });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      method: 'POST',
      path: '/api/example',
      status: 201,
      requestId: 'c41e9b70',
      requestBody: { name: 'First' },
      responseBody: created,
    });
    expect(seen[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('never hands an observer the access token', async () => {
    setTokenProvider(() => Promise.resolve('jwt-from-auth0'));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/me');

    // The request itself still carries the token.
    const sent = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(sent.Authorization).toBe('Bearer jwt-from-auth0');

    expect(seen[0].requestHeaders.Authorization).toBe('Bearer [redacted]');
    expect(JSON.stringify(seen[0])).not.toContain('jwt-from-auth0');
  });

  it('reports an error response with its envelope and still throws', async () => {
    const body = { error: { code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: '5d0be2a7' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body, 401, { 'x-request-id': '5d0be2a7' })));

    await expect(api.get('/api/auth/session')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });

    expect(seen[0]).toMatchObject({ status: 401, requestId: '5d0be2a7', responseBody: body });
  });

  it('reports a request that got no answer with a null status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api.get('/api/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    expect(seen[0]).toMatchObject({ method: 'GET', path: '/api/health', status: null, requestId: null });
  });

  it('stops reporting once the observer is removed, and a throwing observer breaks nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse({ data: [] })));
    const stopBroken = observeApi(() => {
      throw new Error('observer failed');
    });

    await expect(api.get('/api/example')).resolves.toEqual([]);
    expect(seen).toHaveLength(1);

    stop();
    stopBroken();
    await api.get('/api/example');
    expect(seen).toHaveLength(1);
  });

  it('passes keepalive through on a delete', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'abc' } }));
    vi.stubGlobal('fetch', fetchMock);

    await api.delete('/api/example/abc', { keepalive: true });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE', keepalive: true });
  });
});
