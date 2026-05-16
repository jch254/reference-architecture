export type EmailMode = 'live' | 'redirect' | 'noop';
export type TenantResolutionMode = 'fixed' | 'subdomain';
export type AuthProvider = 'none' | 'internal_magic_link' | 'oidc';

export interface OidcAuthConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
}

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

function parseAuthProvider(): AuthProvider {
  const value = process.env.AUTH_PROVIDER || 'internal_magic_link';
  if (value === 'none' || value === 'internal_magic_link' || value === 'oidc') {
    return value;
  }

  throw new Error(
    `Invalid AUTH_PROVIDER: ${value}. Expected "none", "internal_magic_link", or "oidc".`,
  );
}

const authProvider = parseAuthProvider();

function requireUrlEnv(name: string): string {
  const value = requireEnv(name);
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid ${name}: must be a valid URL.`);
  }

  return value;
}

function deriveJwksUri(issuer: string): string {
  const issuerBase = issuer.endsWith('/') ? issuer : `${issuer}/`;
  return new URL('.well-known/jwks.json', issuerBase).toString();
}

function parseOidcConfig(): OidcAuthConfig {
  if (authProvider !== 'oidc') {
    return {
      issuer: process.env.OIDC_ISSUER || '',
      audience: process.env.OIDC_AUDIENCE || '',
      jwksUri: process.env.OIDC_JWKS_URI || '',
    };
  }

  const issuer = requireUrlEnv('OIDC_ISSUER');
  const audience = requireEnv('OIDC_AUDIENCE');
  const jwksUri = process.env.OIDC_JWKS_URI
    ? requireUrlEnv('OIDC_JWKS_URI')
    : deriveJwksUri(issuer);

  return {
    issuer,
    audience,
    jwksUri,
  };
}

const oidc = parseOidcConfig();

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
  authProvider,
  oidc,
};
