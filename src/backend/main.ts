import { Logger } from '@nestjs/common';

import { createApp } from './app.factory';
import { config } from './common/config';

/**
 * ECS container / local entrypoint.
 *
 * App wiring lives in `createApp()` (see app.factory.ts) so the same
 * configured app can run here behind a listener and on Lambda via lambda.ts.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await createApp();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Application listening on port ${config.port}`);
}

bootstrap();
