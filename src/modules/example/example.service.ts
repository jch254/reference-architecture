import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { AnalyticsService } from '../../common/analytics/analytics.service';
import { config } from '../../common/config';
import {
  BaseEntity,
  Keys,
  SKPrefix,
} from '../../common/dynamodb/entity.types';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';

export interface ExampleEntity extends BaseEntity {
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

  getHealth(): { status: string; timestamp: number } {
    return {
      status: 'ok',
      timestamp: Date.now(),
    };
  }

  async createExample(
    tenantSlug: string,
    name: string,
  ): Promise<ExampleEntity> {
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

    return item;
  }

  async listExamples(tenantSlug: string): Promise<ExampleEntity[]> {
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

    return items;
  }
}
