/** The shapes the demo reads from the API. See src/backend/modules. */

/** An example record, as GET, POST and PATCH /api/example return it. */
export interface Example {
  id: string;
  userId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** A record in the list. `pending` is one the API has not answered for yet. */
export interface RecordRow extends Example {
  pending?: boolean;
}

/** Where keyboard focus can be sent besides a record: the quick add field. */
export const QUICK_ADD = 'quick-add';

/** The local user, from GET /api/me. */
export interface LocalUser {
  userId: string;
  tenantId?: string;
  provider: string;
  providerSubject?: string;
  email?: string;
  name?: string;
  createdAt?: string;
}

/** The provider principal, from GET /api/auth/check. */
export interface Principal {
  provider: string;
  subject: string;
  email?: string;
  name?: string;
}
