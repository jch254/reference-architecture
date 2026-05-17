import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { TenantMiddleware } from './common/context/tenant.middleware';
import { TenantResolver } from './common/context/tenant.resolver';
import { DynamoDbModule } from './common/dynamodb/dynamodb.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExampleModule } from './modules/example/example.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{
      ttl: 60_000,
      limit: 10,
    }]),
    DynamoDbModule,
    AuthModule,
    UsersModule,
    ExampleModule,
  ],
  providers: [TenantResolver],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
    consumer.apply(TenantMiddleware).exclude('api/health').forRoutes('{*path}');
  }
}
