import { AuthPrincipal } from '../../common/context/identity.types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  it('returns the local user envelope for the authenticated principal and request tenant', async () => {
    const user = {
      userId: 'user-1',
      tenantId: 'tenant-a',
      provider: 'oidc' as const,
      providerSubject: 'auth0|user-123',
      email: 'user@example.com',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
      lastSeenAt: '2026-05-17T00:00:00.000Z',
    };
    const usersService = {
      findOrCreateFromPrincipal: jest.fn().mockResolvedValue(user),
    };
    const controller = new UsersController(
      usersService as unknown as UsersService,
    );
    const principal: AuthPrincipal & { rawClaims?: unknown; secret?: string } = {
      provider: 'oidc',
      subject: 'auth0|user-123',
      email: 'user@example.com',
      rawClaims: { tenant: 'evil-tenant' },
      secret: 'do-not-return',
    };

    await expect(
      controller.me({ tenantSlug: 'tenant-a' } as never, principal),
    ).resolves.toEqual({ user });
    expect(usersService.findOrCreateFromPrincipal).toHaveBeenCalledWith(
      'tenant-a',
      principal,
    );
  });
});
