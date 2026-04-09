import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { TenantMiddleware } from './common/context/tenant.middleware';
import { DynamoDbModule } from './common/dynamodb/dynamodb.module';
import { ExampleModule } from './modules/example/example.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DynamoDbModule,
    ExampleModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
    consumer.apply(TenantMiddleware).exclude('api/health').forRoutes('{*path}');
  }
}
