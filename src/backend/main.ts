import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { join } from 'path';

import { AppModule } from './app.module';
import { config } from './common/config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser(config.cookieSecret));
  app.use(helmet());
  app.set('trust proxy', 1);

  const isLocal = config.baseDomain === 'localhost';
  app.enableCors({
    origin: isLocal
      ? true
      : [new RegExp(`https?://([^.]+\\.)?${config.baseDomain.replace('.', '\\.')}`)],
    credentials: true,
  });
  app.setGlobalPrefix('api');

  // Serve frontend static files
  const frontendPath = join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));

  // SPA fallback: non-API routes serve index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(frontendPath, 'index.html'));
  });

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Application listening on port ${config.port}`);
}

bootstrap();
