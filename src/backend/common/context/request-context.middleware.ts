import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

import { requestContextStore } from './request-context.store';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string) || randomUUID().slice(0, 8);
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    requestContextStore.run({ requestId, tenantSlug: '', user: null }, () => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        const { method, originalUrl } = req;
        const { statusCode } = res;

        if (originalUrl.includes('/health')) return;
        if (statusCode < 400) return;

        const line = `[reqId=${requestId}] ${method} ${originalUrl} ${statusCode} ${duration}ms`;
        if (statusCode >= 500) {
          this.logger.error(line);
        } else {
          this.logger.warn(line);
        }
      });

      next();
    });
  }
}
