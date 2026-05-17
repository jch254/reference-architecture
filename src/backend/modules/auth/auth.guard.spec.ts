import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { config } from '../../common/config';
import { AuthProvider } from '../../common/context/identity.types';
import { requestContextStore } from '../../common/context/request-context.store';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OidcJwtValidator } from './oidc-jwt.validator';

function magicPrincipal(email: string) {
  return { provider: 'internal_magic_link' as const, subject: email, email };
}

function createMockContext(overrides: {
  authorization?: string;
  signedCookies?: Record<string, unknown>;
  tenantSlug?: string;
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

describe('AuthGuard — selected auth provider resolution', () => {
  let guard: AuthGuard;
  let reflector: Reflector;
  let mockAuthService: Record<string, jest.Mock>;
  let mockOidcJwtValidator: Record<string, jest.Mock>;

  function setAuthProvider(provider: AuthProvider | 'none'): void {
    config.authProvider = provider;
  }

  beforeEach(async () => {
    setAuthProvider('internal_magic_link');
    mockAuthService = {
      validateApiToken: jest.fn(),
      validateSession: jest.fn(),
      issueApiToken: jest.fn(),
      isInternalMagicLinkAuthEnabled: jest.fn(() => true),
      toMagicLinkPrincipal: jest.fn((email: string) => magicPrincipal(email)),
    };
    mockOidcJwtValidator = {
      isEnabled: jest.fn(() => false),
      validate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: mockAuthService },
        { provide: OidcJwtValidator, useValue: mockOidcJwtValidator },
        Reflector,
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('public routes', () => {
    it('allows public routes such as health without any auth provider', async () => {
      setAuthProvider('none');
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
      const { context } = createMockContext({ tenantSlug: 'tenant-a' });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(mockAuthService.validateApiToken).not.toHaveBeenCalled();
      expect(mockOidcJwtValidator.validate).not.toHaveBeenCalled();
    });
  });

  describe('AUTH_PROVIDER=oidc', () => {
    beforeEach(() => {
      setAuthProvider('oidc');
    });

    it('accepts a valid OIDC JWT and attaches AuthPrincipal', async () => {
      const principal = {
        provider: 'oidc' as const,
        subject: 'auth0|user-123',
        email: 'user@example.com',
        name: 'Example User',
      };
      const { context, req } = createMockContext({
        authorization: 'Bearer header.payload.signature',
        tenantSlug: 'tenant-a',
      });

      mockOidcJwtValidator.validate.mockResolvedValue(principal);

      const store = { user: null, tenantSlug: 'tenant-a', requestId: 'req-1', principal: null };
      const result = await requestContextStore.run(store, () => guard.canActivate(context));

      expect(result).toBe(true);
      expect(req.principal).toEqual(principal);
      expect(req.user).toBeUndefined();
      expect(store.principal).toEqual(principal);
      expect(store.user).toBeNull();
      expect(mockOidcJwtValidator.validate).toHaveBeenCalledWith('header.payload.signature');
      expect(mockAuthService.validateApiToken).not.toHaveBeenCalled();
      expect(mockAuthService.validateSession).not.toHaveBeenCalled();
    });

    it('rejects protected routes such as /api/me without a bearer token', async () => {
      const { context } = createMockContext({
        tenantSlug: 'tenant-a',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockOidcJwtValidator.validate).not.toHaveBeenCalled();
    });

    it('rejects a magic-link opaque bearer token', async () => {
      const { context } = createMockContext({
        authorization: 'Bearer opaque-magic-token',
        tenantSlug: 'tenant-a',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.validateApiToken).not.toHaveBeenCalled();
    });

    it('rejects a magic-link session cookie', async () => {
      const { context } = createMockContext({
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

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.validateSession).not.toHaveBeenCalled();
    });
  });

  describe('AUTH_PROVIDER=internal_magic_link', () => {
    beforeEach(() => {
      setAuthProvider('internal_magic_link');
    });

    it('accepts a valid opaque Bearer token', async () => {
      const { context, req } = createMockContext({
        authorization: 'Bearer valid-token-abc',
        tenantSlug: 'tenant-a',
      });

      mockAuthService.validateApiToken.mockResolvedValue({
        email: 'admin@a.com',
        tenantSlug: 'tenant-a',
      });

      const store = { user: null, tenantSlug: 'tenant-a', requestId: 'req-1', principal: null };
      const result = await requestContextStore.run(store, () => guard.canActivate(context));

      expect(result).toBe(true);
      expect(req.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(req.principal).toEqual(magicPrincipal('admin@a.com'));
      expect(store.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(store.principal).toEqual(magicPrincipal('admin@a.com'));
      expect(mockAuthService.validateApiToken).toHaveBeenCalledWith('valid-token-abc', 'tenant-a');
    });

    it('accepts a valid signed session cookie', async () => {
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

      const store = { user: null, tenantSlug: 'tenant-a', requestId: 'req-1', principal: null };
      const result = await requestContextStore.run(store, () => guard.canActivate(context));

      expect(result).toBe(true);
      expect(req.user).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
      expect(req.principal).toEqual(magicPrincipal('admin@a.com'));
      expect(mockAuthService.validateApiToken).not.toHaveBeenCalled();
    });

    it('rejects an OIDC JWT bearer token', async () => {
      const { context } = createMockContext({
        authorization: 'Bearer header.payload.signature',
        tenantSlug: 'tenant-a',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockOidcJwtValidator.validate).not.toHaveBeenCalled();
      expect(mockAuthService.validateApiToken).not.toHaveBeenCalled();
    });

    it('passes tenantSlug to validateApiToken without trusting token claims for tenancy', async () => {
      const { context } = createMockContext({
        authorization: 'Bearer token-for-tenant-a',
        tenantSlug: 'tenant-b',
      });

      mockAuthService.validateApiToken.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.validateApiToken).toHaveBeenCalledWith('token-for-tenant-a', 'tenant-b');
    });

    it('rejects malformed cookie JSON', async () => {
      const { context } = createMockContext({
        tenantSlug: 'tenant-a',
        signedCookies: { __session: 'not-json{{{' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('AUTH_PROVIDER=none', () => {
    beforeEach(() => {
      setAuthProvider('none');
    });

    it('rejects protected-route auth even when credentials are present', async () => {
      const { context } = createMockContext({
        authorization: 'Bearer header.payload.signature',
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

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockOidcJwtValidator.validate).not.toHaveBeenCalled();
      expect(mockAuthService.validateApiToken).not.toHaveBeenCalled();
      expect(mockAuthService.validateSession).not.toHaveBeenCalled();
    });
  });
});
