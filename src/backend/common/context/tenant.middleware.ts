import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { requestContextStore } from './request-context.store';
import { TenantResolver } from './tenant.resolver';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantResolver: TenantResolver) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    req.tenantSlug = this.tenantResolver.resolveTenantId(req);

    const store = requestContextStore.getStore();
    if (store) store.tenantSlug = req.tenantSlug;

    next();
  }
}
