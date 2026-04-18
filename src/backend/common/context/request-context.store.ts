import { AsyncLocalStorage } from 'async_hooks';

import { RequestContext } from './identity.types';

export type { RequestContext };

export const requestContextStore = new AsyncLocalStorage<RequestContext>();
