import { Module } from '@nestjs/common';

import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DynamoDbModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
