import { Module } from '@nestjs/common';

import { DynamoDbModule } from '../dynamodb/dynamodb.module';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [DynamoDbModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
