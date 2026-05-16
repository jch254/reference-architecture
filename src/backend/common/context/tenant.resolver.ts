import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { config } from '../config';

@Injectable()
export class TenantResolver {
  resolveTenantId(req?: Pick<Request, 'hostname' | 'headers'>): string {
    if (config.tenantResolutionMode === 'fixed') {
      return config.appTenantId;
    }

    return this.resolveSubdomainTenant(req);
  }

  private resolveSubdomainTenant(
    req?: Pick<Request, 'hostname' | 'headers'>,
  ): string {
    const host = this.resolveHost(req);

    return host.endsWith(`.${config.baseDomain}`)
      ? host.slice(0, host.length - config.baseDomain.length - 1) || 'default'
      : 'default';
  }

  private resolveHost(req?: Pick<Request, 'hostname' | 'headers'>): string {
    const headerHost = req?.headers?.host;
    const host =
      req?.hostname ||
      (Array.isArray(headerHost) ? headerHost[0] : headerHost) ||
      '';

    return host.split(':')[0];
  }
}
