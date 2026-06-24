import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';

/**
 * Lambda (container image) entrypoint.
 *
 * The same Nest app that runs on ECS (see app.factory.ts) is served here behind
 * an API Gateway HTTP API (v2) Lambda-proxy integration. The handler is the only
 * Lambda-specific code: it resolves runtime secrets from SSM at cold start, then
 * hands the Express instance to the serverless adapter.
 *
 * Ordering matters: `common/config.ts` reads required secrets from the
 * environment *eagerly at import time*, so secrets must be in `process.env`
 * before the app factory (which imports config) is loaded. That is why
 * `app.factory` and the adapter are pulled in with dynamic `import()` only after
 * `loadSecretsIntoEnv()` has run — never as static top-level imports.
 */

type LambdaHandler = (event: unknown, context: unknown) => Promise<unknown>;

/**
 * Target runtime env var → the env var holding its SSM parameter name. Anything
 * already present in the environment is left untouched, so local/dev runs can
 * inject values directly and skip SSM entirely. Keeping the resolved secret out
 * of the Lambda function config (and Terraform state) is the point of fetching
 * at runtime rather than baking it into the function's environment.
 */
const SECRET_PARAMETER_ENV: Record<string, string> = {
  COOKIE_SECRET: 'COOKIE_SECRET_PARAMETER_NAME',
  RESEND_API_KEY: 'RESEND_API_KEY_PARAMETER_NAME',
};

async function loadSecretsIntoEnv(): Promise<void> {
  const wanted: { target: string; parameterName: string }[] = [];

  for (const [target, parameterNameEnv] of Object.entries(SECRET_PARAMETER_ENV)) {
    if (process.env[target]) continue; // already supplied directly
    const parameterName = process.env[parameterNameEnv];
    if (parameterName) {
      wanted.push({ target, parameterName });
    }
  }

  if (wanted.length === 0) return;

  const client = new SSMClient({});
  const result = await client.send(
    new GetParametersCommand({
      Names: wanted.map((w) => w.parameterName),
      WithDecryption: true,
    }),
  );

  const valueByName = new Map(
    (result.Parameters ?? []).map((p) => [p.Name, p.Value] as const),
  );

  for (const { target, parameterName } of wanted) {
    const value = valueByName.get(parameterName);
    if (value) {
      process.env[target] = value;
    }
  }
}

let handlerPromise: Promise<LambdaHandler> | undefined;

async function bootstrapHandler(): Promise<LambdaHandler> {
  // Populate secrets before config.ts (eager) is imported transitively below.
  await loadSecretsIntoEnv();

  const { createApp } = await import('./app.factory');
  const app = await createApp();
  await app.init();

  const serverlessExpress = (await import('@codegenie/serverless-express')).default;
  return serverlessExpress({
    app: app.getHttpAdapter().getInstance(),
  }) as unknown as LambdaHandler;
}

export const handler = async (event: unknown, context: unknown): Promise<unknown> => {
  handlerPromise ??= bootstrapHandler();
  const wrapped = await handlerPromise;
  return wrapped(event, context);
};
