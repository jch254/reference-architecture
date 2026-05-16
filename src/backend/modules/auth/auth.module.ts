import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { DynamoDbModule } from '../../common/dynamodb/dynamodb.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OidcJwtValidator } from './oidc-jwt.validator';

@Module({
  imports: [DynamoDbModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OidcJwtValidator,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [AuthService, OidcJwtValidator],
})
export class AuthModule {}
