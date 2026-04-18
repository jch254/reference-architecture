import { Injectable, Logger } from '@nestjs/common';

import { config } from '../config';
import { requestContextStore } from '../context/request-context.store';
import { Keys } from '../dynamodb/entity.types';
import { DynamoDbService } from '../dynamodb/dynamodb.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly tableName = config.dynamoDbTable;

  constructor(private readonly dynamoDb: DynamoDbService) {}

  async track(
    eventName: string,
    metadata?: Record<string, string | number | boolean>,
  ): Promise<void> {
    const store = requestContextStore.getStore();
    const tenantId = store?.tenantSlug || 'unknown';
    const requestId = store?.requestId || 'unknown';
    const userEmail = store?.user?.email || 'unknown';
    const timestamp = Date.now();
    const keys = Keys.analyticsEvent(tenantId, timestamp, eventName, requestId);

    try {
      await this.dynamoDb.putItem(this.tableName, {
        ...keys,
        entityType: 'EVENT',
        eventName,
        timestamp,
        requestId,
        userEmail,
        ...(metadata && { metadata }),
        createdAt: new Date(timestamp).toISOString(),
        updatedAt: new Date(timestamp).toISOString(),
      });

      this.logger.debug(`Tracked ${eventName} for tenant ${tenantId}`);
    } catch (error) {
      this.logger.warn(`Failed to track ${eventName}: ${error}`);
    }
  }
}
