import { vi } from 'vitest';

import type { Example, LocalUser, Principal } from './demo/types';

/**
 * A stand-in for the API, for component tests. It answers the routes the page
 * calls with the envelopes and the x-request-id header the real API sends,
 * and it keeps the example records in memory so writes can be read back.
 */

export const USER: LocalUser = {
  userId: '6f1c2a9e-4b7d-4e2a-9c31-0d5e8a7b2f14',
  tenantId: 'reference-architecture',
  provider: 'internal_magic_link',
  providerSubject: 'ada@example.com',
  email: 'ada@example.com',
  createdAt: '2026-11-21T10:34:40.212Z',
};

export const PRINCIPAL: Principal = {
  provider: 'internal_magic_link',
  subject: 'ada@example.com',
  email: 'ada@example.com',
};

export function example(id: string, name: string, createdAt: string): Example {
  return { id, userId: USER.userId, name, createdAt, updatedAt: createdAt };
}

interface FakeApiOptions {
  /** The magic-link session. null answers 401, as the API does when signed out. */
  session?: { email: string; tenantSlug: string } | null;
  user?: LocalUser;
  principal?: Principal;
  records?: Example[];
  /** Answer a request some other way. Return undefined to fall through. */
  override?: (method: string, path: string, init: RequestInit) => Response | undefined;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-request-id': Math.random().toString(16).slice(2, 10) },
  });
}

export function apiError(status: number, code: string, message: string): Response {
  return json({ error: { code, message, requestId: 'req-1' } }, status);
}

export function fakeApi(options: FakeApiOptions = {}) {
  const { session = null, user = USER, principal = PRINCIPAL, override } = options;
  let records = [...(options.records ?? [])];
  let created = 0;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}): Promise<Response> => {
    const method = init.method ?? 'GET';
    const overridden = override?.(method, url, init);
    if (overridden) return overridden;

    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const id = url.startsWith('/api/example/') ? url.slice('/api/example/'.length) : null;

    if (url === '/api/health') return json({ data: { status: 'ok' } });
    if (url === '/api/auth/session') {
      return session ? json({ data: session }) : apiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (url === '/api/auth/request-link') return json({ data: { message: 'If that email is valid, a link has been sent.' } }, 201);
    if (url === '/api/auth/logout') return json({ message: 'Logged out' }, 201);
    if (url === '/api/auth/check') return json({ data: { authenticated: true, principal } });
    if (url === '/api/me') return json({ data: { user } });
    if (url === '/api/example' && method === 'GET') return json({ data: records });
    if (url === '/api/example' && method === 'POST') {
      created += 1;
      const record = example(`new0000${created}`, body.name, new Date().toISOString());
      records = [record, ...records];
      return json({ data: record }, 201);
    }
    if (id && method === 'PATCH') {
      const record = records.find((item) => item.id === id);
      if (!record) return apiError(404, 'NOT_FOUND', 'Example not found');
      const updated = { ...record, name: body.name, updatedAt: new Date().toISOString() };
      records = records.map((item) => (item.id === id ? updated : item));
      return json({ data: updated });
    }
    if (id && method === 'DELETE') {
      records = records.filter((item) => item.id !== id);
      return json({ data: { id } });
    }
    return apiError(404, 'NOT_FOUND', `Cannot ${method} ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);

  /** Every request made so far to this method and path. */
  const calls = (method: string, path: string) =>
    fetchMock.mock.calls.filter(([url, init]) => url === path && (init?.method ?? 'GET') === method);

  return { fetchMock, calls };
}

/** jsdom's localStorage is inconsistent across versions. This one is not. */
export function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
}

declare const jsdom: { reconfigure: (options: { url: string }) => void };

/** Load the page as if from this host. Vitest exposes the jsdom instance. */
export function visit(host: string, path = '/') {
  jsdom.reconfigure({ url: `https://${host}${path}` });
}
