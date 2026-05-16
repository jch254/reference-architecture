import { buildMagicLinkWebUrl } from './auth-links';

describe('buildMagicLinkWebUrl', () => {
  it('uses localhost and port for local magic-link web URLs', () => {
    expect(buildMagicLinkWebUrl({
      baseDomain: 'localhost',
      port: 3000,
      tenantResolutionMode: 'fixed',
      tenantSlug: 'ignored',
      token: 'abc123',
      email: 'user@example.com',
    })).toBe('http://localhost:3000/auth/verify?token=abc123&email=user%40example.com&source=email');
  });

  it('ignores tenant slug in fixed mode magic-link web URLs', () => {
    expect(buildMagicLinkWebUrl({
      baseDomain: 'app.example.com',
      port: 3000,
      tenantResolutionMode: 'fixed',
      tenantSlug: 'acme',
      token: 'abc123',
      email: 'user@example.com',
    })).toBe('https://app.example.com/auth/verify?token=abc123&email=user%40example.com&source=email');
  });

  it('uses tenant subdomain in subdomain mode magic-link web URLs', () => {
    expect(buildMagicLinkWebUrl({
      baseDomain: 'example.com',
      port: 3000,
      tenantResolutionMode: 'subdomain',
      tenantSlug: 'acme',
      token: 'abc123',
      email: 'user@example.com',
    })).toBe('https://acme.example.com/auth/verify?token=abc123&email=user%40example.com&source=email');
  });
});