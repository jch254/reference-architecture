import { validateSystem } from '../../../scripts/validate-system';

interface FetchCall {
  input: string | URL | Request;
  init?: RequestInit;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
}

function createLogger() {
  const logs: unknown[][] = [];
  const errors: unknown[][] = [];

  return {
    logger: {
      log: (...args: unknown[]) => logs.push(args),
      error: (...args: unknown[]) => errors.push(args),
    },
    logs,
    errors,
    allText: () => [...logs, ...errors].flat().join(' '),
  };
}

describe('validateSystem', () => {
  it('sends the supplied bearer token and validates the OIDC principal', async () => {
    const calls: FetchCall[] = [];
    const { logger, errors, allText } = createLogger();
    const token = 'secret.header.payload.signature';
    const fetchFn = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input, init });
      const path = input.toString();

      if (path.endsWith('/api/health')) {
        return jsonResponse({ data: { status: 'ok' } });
      }

      if (path.endsWith('/api/auth/check') && !init?.headers) {
        return jsonResponse({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
      }

      return jsonResponse({
        data: {
          authenticated: true,
          principal: {
            provider: 'oidc',
            subject: 'client-id@clients',
          },
        },
      });
    }) as jest.MockedFunction<typeof fetch>;

    const result = await validateSystem({
      baseUrl: 'https://reference-architecture-auth0.603.nz',
      authProvider: 'oidc',
      authBearerToken: token,
      fetchFn,
      logger,
    });

    expect(result).toEqual({ ok: true, partial: false });
    expect(errors).toEqual([]);
    expect(calls[2]?.init?.headers).toEqual({
      Authorization: `Bearer ${token}`,
    });
    expect(allText()).not.toContain(token);
  });

  it('fails OIDC validation when the authenticated response is not from the OIDC provider', async () => {
    const { logger, errors } = createLogger();
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { status: 'ok' } }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({
        data: {
          authenticated: true,
          principal: {
            provider: 'internal_magic_link',
            subject: 'user@example.com',
          },
        },
      })) as jest.MockedFunction<typeof fetch>;

    const result = await validateSystem({
      baseUrl: 'https://reference-architecture-auth0.603.nz',
      authProvider: 'oidc',
      authBearerToken: 'token',
      fetchFn,
      logger,
    });

    expect(result.ok).toBe(false);
    expect(errors.flat().join(' ')).toContain('principal.provider=oidc');
  });

  it('skips OIDC bearer-token validation without a token when strict mode is false', async () => {
    const { logger, logs, errors } = createLogger();
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { status: 'ok' } }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })) as jest.MockedFunction<typeof fetch>;

    const result = await validateSystem({
      baseUrl: 'https://reference-architecture-auth0.603.nz',
      authProvider: 'oidc',
      fetchFn,
      logger,
    });

    expect(result).toEqual({ ok: true, partial: true });
    expect(errors).toEqual([]);
    expect(logs.flat().join(' ')).toContain('AUTH_BEARER_TOKEN not set');
    expect(logs.flat().join(' ')).toContain('SYSTEM VALIDATION PASSED (PARTIAL)');
  });

  it('fails OIDC validation without a token when strict mode is true', async () => {
    const { logger, errors } = createLogger();
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { status: 'ok' } }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })) as jest.MockedFunction<typeof fetch>;

    const result = await validateSystem({
      baseUrl: 'https://reference-architecture-auth0.603.nz',
      authProvider: 'oidc',
      requireAuth: true,
      fetchFn,
      logger,
    });

    expect(result.ok).toBe(false);
    expect(errors.flat().join(' ')).toContain('AUTH_BEARER_TOKEN not set');
  });

  it('preserves the internal magic-link validation path by default', async () => {
    let createdName = '';
    const { logger, errors } = createLogger();
    const fetchFn = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = input.toString();

      if (path.endsWith('/api/health')) {
        return jsonResponse({ data: { status: 'ok' } });
      }

      if (path.endsWith('/api/auth/request-link')) {
        return jsonResponse({ data: { token: 'magic-token' } });
      }

      if (path.includes('/api/auth/verify')) {
        return jsonResponse(
          { data: { ok: true, token: 'api-token' } },
          { headers: { 'set-cookie': '__session=signed; Path=/; HttpOnly' } },
        );
      }

      if (path.endsWith('/api/example') && init?.method === 'POST') {
        const payload = JSON.parse(init.body?.toString() ?? '{}') as { name?: string };
        if (!payload.name) {
          return jsonResponse({ error: { code: 'VALIDATION_ERROR' } }, { status: 400 });
        }
        createdName = payload.name;
        return jsonResponse({
          data: {
            id: 'example-1',
            name: createdName,
            createdAt: '2026-05-17T00:00:00.000Z',
            updatedAt: '2026-05-17T00:00:00.000Z',
          },
        });
      }

      if (path.endsWith('/api/example') && init?.headers && 'Host' in init.headers) {
        return jsonResponse({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
      }

      if (path.endsWith('/api/example')) {
        return jsonResponse({
          data: createdName
            ? [{ id: 'example-1', name: createdName }]
            : [],
        });
      }

      if (path.endsWith('/api/example/example-1') && init?.method === 'DELETE') {
        return jsonResponse({ data: { ok: true } });
      }

      return jsonResponse({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    }) as jest.MockedFunction<typeof fetch>;

    const result = await validateSystem({
      baseUrl: 'https://reference-architecture.603.nz',
      cookieSecret: 'cookie-secret',
      fetchFn,
      logger,
    });

    expect(result).toEqual({ ok: true, partial: false });
    expect(errors).toEqual([]);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://reference-architecture.603.nz/api/auth/request-link',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-cookie-secret': 'cookie-secret' }),
      }),
    );
  });
});
