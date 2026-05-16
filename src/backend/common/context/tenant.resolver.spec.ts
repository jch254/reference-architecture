import { requestContextStore } from './request-context.store';
import { TenantMiddleware } from './tenant.middleware';
import type { TenantResolver } from './tenant.resolver';

describe('TenantResolver', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  function loadResolver(options: {
    mode: 'fixed' | 'subdomain';
    appTenantId?: string;
    baseDomain?: string;
  }): TenantResolver {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      DYNAMODB_TABLE: 'test-table',
      TENANT_RESOLUTION_MODE: options.mode,
      COOKIE_SECRET: 'test-cookie-secret',
      EMAIL_MODE: 'noop',
      BASE_DOMAIN: options.baseDomain ?? 'example.com',
    };
    if (options.appTenantId) {
      process.env.APP_TENANT_ID = options.appTenantId;
    } else {
      delete process.env.APP_TENANT_ID;
    }

    const {
      TenantResolver: IsolatedTenantResolver,
    } = require('./tenant.resolver') as typeof import('./tenant.resolver');

    return new IsolatedTenantResolver();
  }

  it('returns the configured fixed tenant id', () => {
    const resolver = loadResolver({
      mode: 'fixed',
      appTenantId: 'handscape-prod',
    });

    expect(resolver.resolveTenantId()).toBe('handscape-prod');
  });

  it('changes tenant scope when APP_TENANT_ID changes', () => {
    const prodResolver = loadResolver({
      mode: 'fixed',
      appTenantId: 'handscape-prod',
    });
    const testResolver = loadResolver({
      mode: 'fixed',
      appTenantId: 'handscape-test',
    });

    expect(prodResolver.resolveTenantId()).toBe('handscape-prod');
    expect(testResolver.resolveTenantId()).toBe('handscape-test');
  });

  it('ignores Host in fixed mode', () => {
    const resolver = loadResolver({
      mode: 'fixed',
      appTenantId: 'handscape-prod',
      baseDomain: 'handscape.health',
    });

    expect(
      resolver.resolveTenantId({
        hostname: 'test.handscape.health',
        headers: { host: 'test.handscape.health' },
      }),
    ).toBe('handscape-prod');
  });

  it('derives tenant from Host in subdomain mode', () => {
    const resolver = loadResolver({
      mode: 'subdomain',
      baseDomain: 'example.com',
    });

    expect(
      resolver.resolveTenantId({
        hostname: 'acme.example.com',
        headers: { host: 'acme.example.com' },
      }),
    ).toBe('acme');
  });

  it('keeps previous subdomain fallbacks for apex and unrelated hosts', () => {
    const resolver = loadResolver({
      mode: 'subdomain',
      baseDomain: 'example.com',
    });

    expect(
      resolver.resolveTenantId({
        hostname: 'example.com',
        headers: { host: 'example.com' },
      }),
    ).toBe('default');
    expect(
      resolver.resolveTenantId({
        hostname: 'localhost',
        headers: { host: 'localhost:3000' },
      }),
    ).toBe('default');
  });
});

describe('TenantMiddleware', () => {
  it('attaches the fixed tenant id to the request and request context', () => {
    const resolver = { resolveTenantId: jest.fn(() => 'handscape-prod') };
    const middleware = new TenantMiddleware(resolver as unknown as TenantResolver);
    const req = { hostname: 'ignored.example.com' } as { tenantSlug?: string };
    const next = jest.fn();
    const store = { requestId: 'req-1', tenantSlug: '', user: null };

    requestContextStore.run(store, () => {
      middleware.use(req as never, {} as never, next);
    });

    expect(req.tenantSlug).toBe('handscape-prod');
    expect(store.tenantSlug).toBe('handscape-prod');
    expect(resolver.resolveTenantId).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
