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
};

export const SKPrefix = {
  EXAMPLE: 'EXAMPLE#',
};
