describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      DYNAMODB_TABLE: 'test-table',
      TENANT_RESOLUTION_MODE: 'fixed',
      APP_TENANT_ID: 'handscape-test',
      COOKIE_SECRET: 'test-cookie-secret',
      EMAIL_MODE: 'noop',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('loads APP_TENANT_ID from the environment', () => {
    const { config } = require('./config') as typeof import('./config');

    expect(config.tenantResolutionMode).toBe('fixed');
    expect(config.appTenantId).toBe('handscape-test');
  });

  it('fails clearly when fixed mode is missing APP_TENANT_ID', () => {
    delete process.env.APP_TENANT_ID;

    expect(() => require('./config')).toThrow(
      'Missing required environment variable: APP_TENANT_ID',
    );
  });

  it('does not require APP_TENANT_ID in subdomain mode', () => {
    process.env.TENANT_RESOLUTION_MODE = 'subdomain';
    delete process.env.APP_TENANT_ID;

    const { config } = require('./config') as typeof import('./config');

    expect(config.tenantResolutionMode).toBe('subdomain');
    expect(config.appTenantId).toBe('');
  });

  it('fails clearly for an invalid tenant resolution mode', () => {
    process.env.TENANT_RESOLUTION_MODE = 'invalid-mode';

    expect(() => require('./config')).toThrow(
      'Invalid TENANT_RESOLUTION_MODE: invalid-mode. Expected "fixed" or "subdomain".',
    );
  });
});
