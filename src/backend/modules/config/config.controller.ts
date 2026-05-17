import { Controller, Get } from '@nestjs/common';

import { config } from '../../common/config';
import { Public } from '../auth/auth.guard';
import type { RuntimeConfig } from '../../../shared/api-types';

/**
 * Public runtime config. The same frontend bundle ships to every deployment;
 * it calls this endpoint at boot to learn which auth provider is active and,
 * for OIDC deployments, the public Auth0 SPA settings. No secrets are exposed:
 * the Auth0 SPA client id is a public value and the M2M/client secret is never
 * surfaced here.
 */
@Controller('config')
export class ConfigController {
  @Public()
  @Get()
  getConfig(): RuntimeConfig {
    return { authProvider: config.authProvider, auth0: this.auth0Config() };
  }

  private auth0Config(): RuntimeConfig['auth0'] {
    if (config.authProvider !== 'oidc') return null;

    const { issuer, audience } = config.oidc;
    const clientId = config.auth0SpaClientId;
    if (!issuer || !audience || !clientId) return null;

    let domain: string;
    try {
      domain = new URL(issuer).host;
    } catch {
      return null;
    }

    return { domain, clientId, audience };
  }
}
