import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';
import { randomBytes } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { BINARY_CONTENT_TYPES } from './lambda';

type ProxyResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
};

type Handler = (event: unknown, context: unknown) => Promise<ProxyResult>;

/** An API Gateway HTTP API (payload v2) event for a GET. */
function httpApiEvent(rawPath: string) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath,
    rawQueryString: '',
    headers: { host: 'reference-architecture-lambda.603.nz', accept: '*/*' },
    requestContext: {
      accountId: '000000000000',
      apiId: 'test',
      domainName: 'reference-architecture-lambda.603.nz',
      http: { method: 'GET', path: rawPath, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
      requestId: 'test',
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  };
}

function decode(result: ProxyResult): Buffer {
  return Buffer.from(result.body ?? '', result.isBase64Encoded ? 'base64' : 'utf8');
}

describe('Lambda adapter binary responses', () => {
  let dir: string;
  // Random bytes are not valid UTF-8, which is what a real font or image is
  // to the adapter.
  const font = randomBytes(4096);
  const image = randomBytes(2048);
  const script = 'console.log("théme");\n';

  function handlerWith(binarySettings?: { contentTypes: string[] }): Handler {
    const app = express();
    app.use(express.static(dir));
    return serverlessExpress({ app, ...(binarySettings && { binarySettings }) }) as unknown as Handler;
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'lambda-static-'));
    writeFileSync(join(dir, 'font.woff2'), font);
    writeFileSync(join(dir, 'avatar.webp'), image);
    writeFileSync(join(dir, 'theme.js'), script);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns a woff2 font intact, as base64', async () => {
    const handler = handlerWith({ contentTypes: BINARY_CONTENT_TYPES });

    const result = await handler(httpApiEvent('/font.woff2'), {});

    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toBe('font/woff2');
    expect(result.isBase64Encoded).toBe(true);
    expect(decode(result).equals(font)).toBe(true);
  });

  it('still returns an image intact', async () => {
    const handler = handlerWith({ contentTypes: BINARY_CONTENT_TYPES });

    const result = await handler(httpApiEvent('/avatar.webp'), {});

    expect(result.isBase64Encoded).toBe(true);
    expect(decode(result).equals(image)).toBe(true);
  });

  it('leaves text as text', async () => {
    const handler = handlerWith({ contentTypes: BINARY_CONTENT_TYPES });

    const result = await handler(httpApiEvent('/theme.js'), {});

    expect(result.isBase64Encoded).toBe(false);
    expect(result.body).toBe(script);
  });

  // The reason BINARY_CONTENT_TYPES exists. If this starts failing, the
  // adapter's default has changed and the setting may no longer be needed.
  it('breaks a font with the adapter left at its defaults', async () => {
    const handler = handlerWith();

    const result = await handler(httpApiEvent('/font.woff2'), {});

    expect(result.isBase64Encoded).toBe(false);
    expect(decode(result).equals(font)).toBe(false);
  });
});
