import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AnalyticsService } from '../../common/analytics/analytics.service';
import { config } from '../../common/config';
import { AuthPrincipal } from '../../common/context/identity.types';
import { requestContextStore } from '../../common/context/request-context.store';
import { TenantResolver } from '../../common/context/tenant.resolver';
import {
  BaseEntity,
  Keys,
} from '../../common/dynamodb/entity.types';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';
import { UsersService } from '../users/users.service';

export interface Example {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ExampleEntity extends BaseEntity {
  entityType: 'EXAMPLE';
  tenantId: string;
  userId: string;
  exampleId: string;
  name: string;
}

@Injectable()
export class ExampleService {
  private readonly logger = new Logger(ExampleService.name);
  private readonly tableName = config.dynamoDbTable;

  constructor(
    private readonly dynamoDb: DynamoDbService,
    private readonly analytics: AnalyticsService,
    private readonly tenantResolver: TenantResolver,
    private readonly usersService: UsersService,
  ) {}

  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  async createExample(
    principal: AuthPrincipal,
    name: string,
  ): Promise<Example> {
    const { tenantId, userId } = await this.resolveOwner(principal);
    const entityId = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const keys = Keys.userExample(tenantId, userId, entityId);

    const item: ExampleEntity = {
      ...keys,
      entityType: 'EXAMPLE',
      tenantId,
      userId,
      exampleId: entityId,
      name,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoDb.putItem(this.tableName, item);
    this.logger.log(`Created example ${entityId} for user ${userId} in tenant ${tenantId}`);

    await this.analytics.track('example_created', {
      entityType: 'example',
    });

    return this.toExample(item);
  }

  async listExamples(principal: AuthPrincipal): Promise<Example[]> {
    const { tenantId, userId } = await this.resolveOwner(principal);
    const items = await this.dynamoDb.query<ExampleEntity>(
      this.tableName,
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': `TENANT#${tenantId}`,
        ':skPrefix': this.userExamplePrefix(userId),
      },
    );

    await this.analytics.track('example_listed', {
      entityType: 'example',
    });

    return items.map((item) => this.toExample(item));
  }

  async getExample(
    principal: AuthPrincipal,
    id: string,
  ): Promise<Example | null> {
    const { tenantId, userId } = await this.resolveOwner(principal);
    const item = await this.getOwnedExample(tenantId, userId, id);

    return item ? this.toExample(item) : null;
  }

  async updateExample(
    principal: AuthPrincipal,
    id: string,
    name: string,
  ): Promise<Example | null> {
    const { tenantId, userId } = await this.resolveOwner(principal);
    const existing = await this.getOwnedExample(tenantId, userId, id);
    if (!existing) return null;

    const keys = Keys.userExample(tenantId, userId, id);
    const now = new Date().toISOString();

    const updated = await this.dynamoDb.updateItem<ExampleEntity>(
      this.tableName,
      keys,
      'SET #name = :name, updatedAt = :updatedAt',
      { ':name': name, ':updatedAt': now },
      { '#name': 'name' },
    );

    if (!updated) return null;

    this.logger.log(`Updated example ${id} for user ${userId} in tenant ${tenantId}`);
    return this.toExample(updated);
  }

  async deleteExample(
    principal: AuthPrincipal,
    id: string,
  ): Promise<boolean> {
    const { tenantId, userId } = await this.resolveOwner(principal);
    const existing = await this.getOwnedExample(tenantId, userId, id);
    if (!existing) return false;

    const keys = Keys.userExample(tenantId, userId, id);

    await this.dynamoDb.deleteItem(this.tableName, keys);
    this.logger.log(`Deleted example ${id} for user ${userId} in tenant ${tenantId}`);
    return true;
  }

  private toExample(entity: ExampleEntity): Example {
    return {
      id: entity.exampleId,
      userId: entity.userId,
      name: entity.name,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private async resolveOwner(
    principal: AuthPrincipal,
  ): Promise<{ tenantId: string; userId: string }> {
    const tenantId = this.resolveTenantId();
    const user = await this.usersService.findOrCreateFromPrincipal(
      tenantId,
      principal,
    );

    return { tenantId, userId: user.userId };
  }

  private getOwnedExample(
    tenantId: string,
    userId: string,
    exampleId: string,
  ): Promise<ExampleEntity | null> {
    return this.dynamoDb.getItem<ExampleEntity>(
      this.tableName,
      Keys.userExample(tenantId, userId, exampleId),
      true,
    );
  }

  private userExamplePrefix(userId: string): string {
    return `USER#${userId}#EXAMPLE#`;
  }

  private resolveTenantId(): string {
    return (
      requestContextStore.getStore()?.tenantSlug ||
      this.tenantResolver.resolveTenantId()
    );
  }
}
