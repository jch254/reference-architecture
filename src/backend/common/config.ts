export type EmailMode = 'live' | 'redirect' | 'noop';
export type TenantResolutionMode = 'fixed' | 'subdomain';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const emailMode = (process.env.EMAIL_MODE || 'live') as EmailMode;

function parseTenantResolutionMode(): TenantResolutionMode {
  const value = process.env.TENANT_RESOLUTION_MODE || 'subdomain';
  if (value === 'fixed' || value === 'subdomain') {
    return value;
  }

  throw new Error(
    `Invalid TENANT_RESOLUTION_MODE: ${value}. Expected "fixed" or "subdomain".`,
  );
}

const tenantResolutionMode = parseTenantResolutionMode();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dynamoDbTable: requireEnv('DYNAMODB_TABLE'),
  tenantResolutionMode,
  appTenantId:
    tenantResolutionMode === 'fixed'
      ? requireEnv('APP_TENANT_ID')
      : process.env.APP_TENANT_ID || '',
  baseDomain: process.env.BASE_DOMAIN || 'localhost',
  cookieSecret: requireEnv('COOKIE_SECRET'),
  emailMode,
  // Not required in noop mode — skip validation so CI doesn't need a real key
  resendApiKey: emailMode === 'noop' ? '' : requireEnv('RESEND_API_KEY'),
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
  // Destination address for redirect mode (falls back to the original recipient)
  resendRedirectEmail: process.env.RESEND_REDIRECT_EMAIL || '',
  authTokenExpiryMinutes: 15,
  sessionMaxAgeDays: 7,
};
