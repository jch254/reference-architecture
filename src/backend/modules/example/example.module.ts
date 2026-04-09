import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../../common/analytics/analytics.module';
import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';

@Module({
  imports: [DynamoDbModule, AnalyticsModule],
  controllers: [ExampleController],
  providers: [ExampleService],
})
export class ExampleModule {}
