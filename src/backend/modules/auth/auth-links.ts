import type { TenantResolutionMode } from '../../common/config';

export interface MagicLinkUrlOptions {
  baseDomain: string;
  port: number;
  tenantResolutionMode: TenantResolutionMode;
  tenantSlug: string;
  token: string;
  email: string;
}

export function buildMagicLinkWebUrl(options: MagicLinkUrlOptions): string {
  const protocol = options.baseDomain === 'localhost' ? 'http' : 'https';
  const host = options.baseDomain === 'localhost'
    ? `localhost:${options.port}`
    : options.tenantResolutionMode === 'fixed'
      ? options.baseDomain
      : `${options.tenantSlug}.${options.baseDomain}`;

  return `${protocol}://${host}/auth/verify?token=${encodeURIComponent(options.token)}&email=${encodeURIComponent(options.email)}&source=email`;
}