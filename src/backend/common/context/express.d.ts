import { UserIdentity } from './identity.types';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      tenantSlug: string;
      user?: UserIdentity;
    }
  }
}
