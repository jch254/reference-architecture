import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  tenantSlug: string;
}

export const requestContextStore = new AsyncLocalStorage<RequestContext>();
