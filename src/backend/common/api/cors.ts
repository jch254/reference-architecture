import type { TenantResolutionMode } from '../config';

export function buildCorsOrigin(
  baseDomain: string,
  tenantResolutionMode: TenantResolutionMode,
): boolean | RegExp[] {
  if (baseDomain === 'localhost') return true;

  const escapedBaseDomain = baseDomain.replace(/\./g, '\\.');

  return tenantResolutionMode === 'fixed'
    ? [new RegExp(`^https?://${escapedBaseDomain}$`)]
    : [new RegExp(`^https?://([^.]+\\.)?${escapedBaseDomain}$`)];
}