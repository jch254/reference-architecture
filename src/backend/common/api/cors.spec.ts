import { buildCorsOrigin } from './cors';

describe('buildCorsOrigin', () => {
  it('allows local development origins for localhost', () => {
    expect(buildCorsOrigin('localhost', 'fixed')).toBe(true);
  });

  it('allows only the base host in fixed tenant mode', () => {
    const [origin] = buildCorsOrigin('app.example.com', 'fixed') as RegExp[];

    expect(origin.test('https://app.example.com')).toBe(true);
    expect(origin.test('https://tenant.app.example.com')).toBe(false);
  });

  it('allows apex and subdomain hosts in subdomain tenant mode', () => {
    const [origin] = buildCorsOrigin('example.com', 'subdomain') as RegExp[];

    expect(origin.test('https://example.com')).toBe(true);
    expect(origin.test('https://acme.example.com')).toBe(true);
    expect(origin.test('https://deep.acme.example.com')).toBe(false);
  });
});