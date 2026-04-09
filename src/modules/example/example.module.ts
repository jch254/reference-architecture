import { Module } from '@nestjs/common';

import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';

@Module({
  imports: [DynamoDbModule],
  controllers: [ExampleController],
  providers: [ExampleService],
})
export class ExampleModule {}
