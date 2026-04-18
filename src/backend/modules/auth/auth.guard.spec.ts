import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { requestContextStore } from '../../common/context/request-context.store';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

function createMockContext(overrides: {
  authorization?: string;
  signedCookies?: Record<string, unknown>;
  tenantSlug?: string;
  isPublic?: boolean;
}): { context: ExecutionContext; req: Record<string, unknown> } {
  const req: Record<string, unknown> = {
    headers: { authorization: overrides.authorization },
    signedCookies: overrides.signedCookies ?? {},
    tenantSlug: overrides.tenantSlug ?? 'default',
  };

  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, req };
}

describe('AuthGuard — session isolation', () => {
  let guard: AuthGuard;
  let mockAuthService: Record<string, jest.Mock>;
  let mockReflector: Reflector;

  beforeEach(async () => {
    mockAuthService = {
      validateApiToken: jest.fn(),
      validateSession: jest.fn(),
      issueApiToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: mockAuthService },
        Reflector,
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    mockReflector = module.get<Reflector>(Reflector);
  });

  describe('Bearer token path', () => {
    it('should authenticate with a valid Bearer token', async () => {
      const { context, req } = createMockContext({
        authorization: 'Bearer valid-token-abc',
        tenantSlug: 'tenant-a',
      });

      mockAuthService.validateApiToken.mockResolvedValue({
        email: 'admin@a.com',
        tenantSlug: 'tenant-a',
      });

      const store = { user: null, tenantSlug: 'tenant-a', requestId: 'req-1' };
      const result = await requestContextStore.run(store, () => guard.canActivate(context));

      expect(result).toBe(true);
      expect(req.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(store.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(mockAuthService.validateApiToken).toHaveBeenCalledWith('valid-token-abc', 'tenant-a');
    });

    it('should reject an invalid Bearer token', async () => {
      const { context } = createMockContext({
        authorization: 'Bearer invalid-token',
        tenantSlug: 'tenant-a',
      });

      mockAuthService.validateApiToken.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should pass tenantSlug to validateApiToken — no cross-tenant leakage', async () => {
      // Token valid for tenant-a, presented to tenant-b
      const { context } = createMockContext({
        authorization: 'Bearer token-for-tenant-a',
        tenantSlug: 'tenant-b',
      });

      mockAuthService.validateApiToken.mockResolvedValue(null); // service rejects cross-tenant

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.validateApiToken).toHaveBeenCalledWith('token-for-tenant-a', 'tenant-b');
    });

    it('should not fall through to cookie auth when Bearer token is present but invalid', async () => {
      const { context } = createMockContext({
        authorization: 'Bearer bad-token',
        tenantSlug: 'tenant-a',
        signedCookies: {
          __session: JSON.stringify({
            email: 'admin@a.com',
            tenantSlug: 'tenant-a',
            sessionVersion: 'v1',
            iat: Date.now(),
          }),
        },
      });

      mockAuthService.validateApiToken.mockResolvedValue(null);

      // Should throw immediately, NOT try the cookie
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.validateSession).not.toHaveBeenCalled();
    });
  });

  describe('cookie fallback path', () => {
    it('should authenticate via signed cookie when no Bearer header', async () => {
      const sessionPayload = {
        email: 'admin@a.com',
        tenantSlug: 'tenant-a',
        sessionVersion: 'v1',
        iat: Date.now(),
      };

      const { context, req } = createMockContext({
        tenantSlug: 'tenant-a',
        signedCookies: { __session: JSON.stringify(sessionPayload) },
      });

      mockAuthService.validateSession.mockResolvedValue(true);

      const store = { user: null, tenantSlug: 'tenant-a', requestId: 'req-1' };
      const result = await requestContextStore.run(store, () => guard.canActivate(context));

      expect(result).toBe(true);
      expect(req.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(mockAuthService.validateApiToken).not.toHaveBeenCalled();
    });

    it('should reject when no Bearer and no cookie', async () => {
      const { context } = createMockContext({ tenantSlug: 'tenant-a' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an invalid cookie session', async () => {
      const { context } = createMockContext({
        tenantSlug: 'tenant-a',
        signedCookies: {
          __session: JSON.stringify({
            email: 'admin@a.com',
            tenantSlug: 'tenant-a',
            sessionVersion: 'expired-v',
            iat: Date.now(),
          }),
        },
      });

      mockAuthService.validateSession.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject malformed cookie JSON', async () => {
      const { context } = createMockContext({
        tenantSlug: 'tenant-a',
        signedCookies: { __session: 'not-json{{{' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('cross-session isolation', () => {
    it('should isolate user identity between consecutive requests', async () => {
      // Request 1: tenant-a
      const { context: ctx1, req: req1 } = createMockContext({
        authorization: 'Bearer token-a',
        tenantSlug: 'tenant-a',
      });
      mockAuthService.validateApiToken.mockResolvedValueOnce({
        email: 'admin@a.com',
        tenantSlug: 'tenant-a',
      });

      const store1 = { user: null, tenantSlug: 'tenant-a', requestId: 'req-1' };
      await requestContextStore.run(store1, () => guard.canActivate(ctx1));

      // Request 2: tenant-b
      const { context: ctx2, req: req2 } = createMockContext({
        authorization: 'Bearer token-b',
        tenantSlug: 'tenant-b',
      });
      mockAuthService.validateApiToken.mockResolvedValueOnce({
        email: 'admin@b.com',
        tenantSlug: 'tenant-b',
      });

      const store2 = { user: null, tenantSlug: 'tenant-b', requestId: 'req-2' };
      await requestContextStore.run(store2, () => guard.canActivate(ctx2));

      // Verify complete isolation
      expect(req1.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(req2.user).toEqual({ email: 'admin@b.com', tenantSlug: 'tenant-b' });
      expect(store1.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(store2.user).toEqual({ email: 'admin@b.com', tenantSlug: 'tenant-b' });
    });

    it('should not leak user from a failed request to a subsequent request', async () => {
      // Request 1: fails auth
      const { context: ctx1 } = createMockContext({
        authorization: 'Bearer bad-token',
        tenantSlug: 'tenant-a',
      });
      mockAuthService.validateApiToken.mockResolvedValueOnce(null);

      await expect(guard.canActivate(ctx1)).rejects.toThrow(UnauthorizedException);

      // Request 2: succeeds
      const { context: ctx2, req: req2 } = createMockContext({
        authorization: 'Bearer good-token',
        tenantSlug: 'tenant-b',
      });
      mockAuthService.validateApiToken.mockResolvedValueOnce({
        email: 'admin@b.com',
        tenantSlug: 'tenant-b',
      });

      const store2 = { user: null, tenantSlug: 'tenant-b', requestId: 'req-2' };
      await requestContextStore.run(store2, () => guard.canActivate(ctx2));

      expect(req2.user).toEqual({ email: 'admin@b.com', tenantSlug: 'tenant-b' });
      // No leaked tenant-a data
      expect(store2.user).toEqual({ email: 'admin@b.com', tenantSlug: 'tenant-b' });
    });

    it('should not leak user between Bearer and cookie auth methods', async () => {
      // Request 1: Bearer auth for tenant-a
      const { context: ctx1, req: req1 } = createMockContext({
        authorization: 'Bearer token-a',
        tenantSlug: 'tenant-a',
      });
      mockAuthService.validateApiToken.mockResolvedValueOnce({
        email: 'bearer@a.com',
        tenantSlug: 'tenant-a',
      });

      const store1 = { user: null, tenantSlug: 'tenant-a', requestId: 'req-1' };
      await requestContextStore.run(store1, () => guard.canActivate(ctx1));

      // Request 2: Cookie auth for tenant-b
      const { context: ctx2, req: req2 } = createMockContext({
        tenantSlug: 'tenant-b',
        signedCookies: {
          __session: JSON.stringify({
            email: 'cookie@b.com',
            tenantSlug: 'tenant-b',
            sessionVersion: 'v1',
            iat: Date.now(),
          }),
        },
      });
      mockAuthService.validateSession.mockResolvedValueOnce(true);

      const store2 = { user: null, tenantSlug: 'tenant-b', requestId: 'req-2' };
      await requestContextStore.run(store2, () => guard.canActivate(ctx2));

      // Verify no leakage
      expect(req1.user).toEqual({ email: 'bearer@a.com', tenantSlug: 'tenant-a' });
      expect(req2.user).toEqual({ email: 'cookie@b.com', tenantSlug: 'tenant-b' });
      expect(store1.user).toEqual({ email: 'bearer@a.com', tenantSlug: 'tenant-a' });
      expect(store2.user).toEqual({ email: 'cookie@b.com', tenantSlug: 'tenant-b' });
    });
  });
});
