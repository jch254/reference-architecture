export interface BaseEntity {
  PK: string;
  SK: string;
  entityType: string;
  createdAt: string;
  updatedAt: string;
}

export const Keys = {
  tenantEntity: (tenantId: string, entityType: string, entityId: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: `${entityType}#${entityId}`,
  }),

  analyticsEvent: (tenantId: string, timestamp: number, eventName: string, requestId: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: `EVENT#${timestamp}#${eventName}#${requestId}`,
  }),
};

export const SKPrefix = {
  EXAMPLE: 'EXAMPLE#',
  EVENT: 'EVENT#',
};

export function extractId(sk: string): string {
  const [, id] = sk.split('#');
  return id;
}
