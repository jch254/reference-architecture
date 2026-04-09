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

  entity: (tenantId: string, entityType: string, entityId: string) => ({
    PK: `${entityType}#${tenantId}#${entityId}`,
    SK: 'META',
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
