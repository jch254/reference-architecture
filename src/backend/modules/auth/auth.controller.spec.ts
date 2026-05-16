import { AuthPrincipal } from '../../common/context/identity.types';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('returns the current principal from auth check', () => {
    const controller = new AuthController({} as never);
    const principal: AuthPrincipal = {
      provider: 'oidc',
      subject: 'auth0|user-123',
      email: 'user@example.com',
    };

    expect(controller.check(principal)).toEqual({
      authenticated: true,
      principal,
    });
  });
});