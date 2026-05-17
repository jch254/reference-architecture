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

  authToken: (tenantId: string, email: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: `AUTH_TOKEN#${email}`,
  }),

  apiToken: (tenantId: string, tokenId: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: `API_TOKEN#${tokenId}`,
  }),

  user: (tenantId: string, userId: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: `USER#${userId}`,
  }),

  userIdentity: (tenantId: string, provider: string, subjectHash: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: `USER_IDENTITY#${provider}#${subjectHash}`,
  }),

  userExample: (tenantId: string, userId: string, exampleId: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: `USER#${userId}#EXAMPLE#${exampleId}`,
  }),

  tenantAdmin: (tenantId: string) => ({
    PK: `TENANT#${tenantId}`,
    SK: 'TENANT_ADMIN',
  }),
};

export const SKPrefix = {
  EXAMPLE: 'EXAMPLE#',
  EVENT: 'EVENT#',
  AUTH_TOKEN: 'AUTH_TOKEN#',
  API_TOKEN: 'API_TOKEN#',
  USER: 'USER#',
  USER_IDENTITY: 'USER_IDENTITY#',
  TENANT_ADMIN: 'TENANT_ADMIN',
};

export function extractId(sk: string): string {
  const [, id] = sk.split('#');
  return id;
}
