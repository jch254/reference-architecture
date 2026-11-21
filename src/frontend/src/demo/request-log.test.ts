import { describe, it, expect, beforeEach } from 'vitest';

import type { ApiExchange } from '../api/api-client';

import {
  MAX_ENTRIES,
  clearRequestLog,
  getRequestLog,
  recordExchange,
  redact,
  setRequestLogScope,
} from './request-log';

function exchange(overrides: Partial<ApiExchange> = {}): ApiExchange {
  return {
    method: 'GET',
    path: '/api/example',
    status: 200,
    durationMs: 12,
    requestId: 'c41e9b70',
    requestHeaders: {},
    ...overrides,
  };
}

describe('request log', () => {
  beforeEach(() => {
    clearRequestLog();
    setRequestLogScope(null);
  });

  it('lists the newest request first', () => {
    recordExchange(exchange({ path: '/api/config' }));
    recordExchange(exchange({ path: '/api/health' }));

    expect(getRequestLog().map((entry) => entry.path)).toEqual(['/api/health', '/api/config']);
  });

  it(`keeps the newest ${MAX_ENTRIES} entries and drops the rest`, () => {
    for (let index = 0; index < MAX_ENTRIES + 10; index += 1) {
      recordExchange(exchange({ path: `/api/example/${index}` }));
    }

    const log = getRequestLog();
    expect(log).toHaveLength(MAX_ENTRIES);
    expect(log[0].path).toBe(`/api/example/${MAX_ENTRIES + 9}`);
    expect(log.at(-1)?.path).toBe('/api/example/10');
  });

  it('replaces the Authorization header before an entry is stored', () => {
    recordExchange(exchange({ requestHeaders: { Authorization: 'Bearer real-access-token', Accept: 'application/json' } }));
    recordExchange(exchange({ requestHeaders: { authorization: 'Bearer another-token' } }));

    const [second, first] = getRequestLog();
    expect(first.requestHeaders).toEqual({ Authorization: 'Bearer [redacted]', Accept: 'application/json' });
    expect(second.requestHeaders).toEqual({ authorization: 'Bearer [redacted]' });
    expect(JSON.stringify(getRequestLog())).not.toMatch(/real-access-token|another-token/);
  });

  it('redacts anything in a body that could be a credential', () => {
    recordExchange(
      exchange({
        requestBody: { email: 'ada@example.com' },
        responseBody: { data: { ok: true, token: 'opaque-api-token', nested: [{ access_token: 'jwt' }] } },
      }),
    );

    const [entry] = getRequestLog();
    expect(entry.requestBody).toEqual({ email: 'ada@example.com' });
    expect(entry.responseBody).toEqual({
      data: { ok: true, token: '[redacted]', nested: [{ access_token: '[redacted]' }] },
    });
  });

  it('leaves ordinary values alone when it redacts', () => {
    const body = { data: { id: '3f9a1c2e', name: 'A name', count: 2, auth0: null, list: [1, 'two'] } };
    expect(redact(body)).toEqual(body);
  });

  it('stamps record requests with the tenant and owner once they are known', () => {
    recordExchange(exchange({ path: '/api/example' }));
    setRequestLogScope({ tenant: 'reference-architecture', owner: 'user-1' });
    recordExchange(exchange({ path: '/api/example/3f9a1c2e', method: 'PATCH' }));
    recordExchange(exchange({ path: '/api/me' }));

    const [me, patch, list] = getRequestLog();
    expect(list.scope).toBeNull();
    expect(patch.scope).toEqual({ tenant: 'reference-architecture', owner: 'user-1' });
    expect(me.scope).toBeNull();
  });

  it('empties when cleared', () => {
    recordExchange(exchange());
    clearRequestLog();
    expect(getRequestLog()).toEqual([]);
  });
});
