import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [DynamoDbModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
