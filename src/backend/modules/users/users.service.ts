import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import { config } from '../../common/config';
import { AuthPrincipal } from '../../common/context/identity.types';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';
import { Keys } from '../../common/dynamodb/entity.types';
import { User, UserEntity, UserIdentityEntity } from './user.types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly tableName = config.dynamoDbTable;

  constructor(private readonly dynamoDb: DynamoDbService) {}

  async findOrCreateFromPrincipal(
    tenantId: string,
    principal: AuthPrincipal,
  ): Promise<User> {
    const existing = await this.findByIdentity(tenantId, principal);
    if (existing) {
      return this.touchFromPrincipal(existing, principal);
    }

    return this.createFromPrincipal(tenantId, principal);
  }

  private async findByIdentity(
    tenantId: string,
    principal: AuthPrincipal,
  ): Promise<UserEntity | null> {
    const identity = await this.dynamoDb.getItem<UserIdentityEntity>(
      this.tableName,
      this.identityKey(tenantId, principal),
      true,
    );
    if (!identity) return null;

    return this.dynamoDb.getItem<UserEntity>(
      this.tableName,
      Keys.user(tenantId, identity.userId),
      true,
    );
  }

  private async createFromPrincipal(
    tenantId: string,
    principal: AuthPrincipal,
  ): Promise<User> {
    const userId = randomUUID();
    const subjectHash = this.subjectHash(principal.subject);
    const now = new Date().toISOString();

    const user: UserEntity = {
      ...Keys.user(tenantId, userId),
      entityType: 'USER',
      userId,
      tenantId,
      provider: principal.provider,
      providerSubject: principal.subject,
      ...this.profileFields(principal),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    };

    const identity: UserIdentityEntity = {
      ...Keys.userIdentity(tenantId, principal.provider, subjectHash),
      entityType: 'USER_IDENTITY',
      userId,
      tenantId,
      provider: principal.provider,
      providerSubject: principal.subject,
      subjectHash,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.dynamoDb.transactWrite([
        {
          Put: {
            TableName: this.tableName,
            Item: identity,
            ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: user,
            ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
          },
        },
      ]);

      this.logger.log(
        `Created user ${userId} for ${principal.provider} principal in tenant ${tenantId}`,
      );
      return this.toUser(user);
    } catch (error) {
      if (this.isTransactionConflict(error)) {
        const existing = await this.findByIdentity(tenantId, principal);
        if (existing) return this.touchFromPrincipal(existing, principal);
      }

      throw error;
    }
  }

  private async touchFromPrincipal(
    user: UserEntity,
    principal: AuthPrincipal,
  ): Promise<User> {
    const now = new Date().toISOString();
    const profile = this.profileFields(principal);
    const updates: string[] = ['lastSeenAt = :lastSeenAt'];
    const values: Record<string, string> = {
      ':lastSeenAt': now,
    };
    const names: Record<string, string> = {};
    let profileChanged = false;

    for (const field of ['email', 'name', 'picture'] as const) {
      const next = profile[field];
      if (next === undefined || next === user[field]) continue;

      names[`#${field}`] = field;
      values[`:${field}`] = next;
      updates.push(`#${field} = :${field}`);
      profileChanged = true;
    }

    if (profileChanged) {
      values[':updatedAt'] = now;
      updates.push('updatedAt = :updatedAt');
    }

    const updated = await this.dynamoDb.updateItem<UserEntity>(
      this.tableName,
      Keys.user(user.tenantId, user.userId),
      `SET ${updates.join(', ')}`,
      values,
      Object.keys(names).length ? names : undefined,
    );

    return this.toUser(updated ?? { ...user, lastSeenAt: now });
  }

  private identityKey(tenantId: string, principal: AuthPrincipal) {
    return Keys.userIdentity(
      tenantId,
      principal.provider,
      this.subjectHash(principal.subject),
    );
  }

  private subjectHash(providerSubject: string): string {
    return createHash('sha256').update(providerSubject).digest('hex');
  }

  private profileFields(
    principal: AuthPrincipal,
  ): Pick<User, 'email' | 'name' | 'picture'> {
    return {
      email: this.optionalString(principal.email),
      name: this.optionalString(principal.name),
      picture: this.optionalString(principal.picture),
    };
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private toUser(entity: UserEntity): User {
    return {
      userId: entity.userId,
      tenantId: entity.tenantId,
      provider: entity.provider,
      providerSubject: entity.providerSubject,
      email: entity.email,
      name: entity.name,
      picture: entity.picture,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lastSeenAt: entity.lastSeenAt,
    };
  }

  private isTransactionConflict(error: unknown): boolean {
    return (
      error instanceof TransactionCanceledException ||
      (error instanceof Error && error.name === 'TransactionCanceledException')
    );
  }
}
