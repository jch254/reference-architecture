import { AuthProvider } from '../../common/context/identity.types';
import { BaseEntity } from '../../common/dynamodb/entity.types';

export interface User {
  userId: string;
  tenantId: string;
  provider: AuthProvider;
  providerSubject: string;
  email?: string;
  name?: string;
  picture?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface UserEntity extends BaseEntity {
  entityType: 'USER';
  userId: string;
  tenantId: string;
  provider: AuthProvider;
  providerSubject: string;
  email?: string;
  name?: string;
  picture?: string;
  lastSeenAt: string;
}

export interface UserIdentityEntity extends BaseEntity {
  entityType: 'USER_IDENTITY';
  userId: string;
  tenantId: string;
  provider: AuthProvider;
  providerSubject: string;
  subjectHash: string;
}
