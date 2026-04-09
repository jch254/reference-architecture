import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { requestContextStore } from './request-context.store';

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const host = (req.hostname || '').split(':')[0];

    req.tenantSlug =
      host.endsWith(`.${BASE_DOMAIN}`)
        ? host.slice(0, host.length - BASE_DOMAIN.length - 1) || 'default'
        : 'default';

    const store = requestContextStore.getStore();
    if (store) store.tenantSlug = req.tenantSlug;

    next();
  }
}
