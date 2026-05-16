import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../../common/analytics/analytics.module';
import { TenantResolver } from '../../common/context/tenant.resolver';
import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';

@Module({
  imports: [DynamoDbModule, AnalyticsModule],
  controllers: [ExampleController],
  providers: [ExampleService, TenantResolver],
})
export class ExampleModule {}
