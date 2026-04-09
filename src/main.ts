import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { config } from './common/config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());
  app.set('trust proxy', 1);
  app.enableCors();
  app.setGlobalPrefix('api');

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Application listening on port ${config.port}`);
}

bootstrap();
