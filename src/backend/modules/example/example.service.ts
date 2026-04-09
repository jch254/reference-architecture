import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AnalyticsService } from '../../common/analytics/analytics.service';
import { config } from '../../common/config';
import {
  BaseEntity,
  extractId,
  Keys,
  SKPrefix,
} from '../../common/dynamodb/entity.types';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';

export interface Example {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ExampleEntity extends BaseEntity {
  name: string;
}

@Injectable()
export class ExampleService {
  private readonly logger = new Logger(ExampleService.name);
  private readonly tableName = config.dynamoDbTable;

  constructor(
    private readonly dynamoDb: DynamoDbService,
    private readonly analytics: AnalyticsService,
  ) {}

  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  async createExample(
    tenantSlug: string,
    name: string,
  ): Promise<Example> {
    const tenantId = tenantSlug;
    const entityId = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const keys = Keys.tenantEntity(tenantId, 'EXAMPLE', entityId);

    const item: ExampleEntity = {
      ...keys,
      entityType: 'EXAMPLE',
      name,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoDb.putItem(this.tableName, item);
    this.logger.log(`Created example ${entityId} for tenant ${tenantId}`);

    await this.analytics.track('example_created', {
      entityType: 'example',
    });

    return this.toExample(item);
  }

  async listExamples(tenantSlug: string): Promise<Example[]> {
    const tenantId = tenantSlug;
    const items = await this.dynamoDb.query<ExampleEntity>(
      this.tableName,
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': `TENANT#${tenantId}`,
        ':skPrefix': SKPrefix.EXAMPLE,
      },
    );

    await this.analytics.track('example_listed', {
      entityType: 'example',
    });

    return items.map((item) => this.toExample(item));
  }

  async deleteExample(tenantSlug: string, id: string): Promise<void> {
    const tenantId = tenantSlug;
    const keys = Keys.tenantEntity(tenantId, 'EXAMPLE', id);

    await this.dynamoDb.deleteItem(this.tableName, keys);
    this.logger.log(`Deleted example ${id} for tenant ${tenantId}`);
  }

  private toExample(entity: ExampleEntity): Example {
    return {
      id: extractId(entity.SK),
      name: entity.name,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
