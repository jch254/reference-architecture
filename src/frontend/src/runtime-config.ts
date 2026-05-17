import { api } from './api/api-client';
import type { RuntimeConfig } from '../../shared/api-types';

export type { RuntimeConfig };

/**
 * Fetch the deployment's public runtime config. The same frontend bundle ships
 * everywhere; this tells it which auth provider is active and, for OIDC
 * deployments, the public Auth0 SPA settings. No secrets are returned.
 */
export function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  return api.get<RuntimeConfig>('/api/config');
}
