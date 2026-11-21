// Do the built frontend's binary files survive the Lambda adapter?
//
//   node docs/design/tools/lambda-static.mjs
//
// The two Lambda deployments serve static files through
// @codegenie/serverless-express behind an API Gateway HTTP API. The adapter
// returns a response body as base64 only when it decides the response is
// binary, and otherwise as a UTF-8 string, which destroys a binary file.
//
// This runs the adapter here, with the same options src/backend/lambda.ts
// passes it, in front of express.static with the cache headers from
// src/backend/app.factory.ts. It sends an HTTP API (payload v2) event for
// every file in src/frontend/dist and compares what comes back with the
// file on disk. It needs a build in src/frontend/dist and the root
// node_modules. It is a local stand-in for the check on the deployed
// Lambda, not a replacement for it.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const dist = path.join(root, 'src/frontend/dist');
const require = createRequire(path.join(root, 'package.json'));

const express = require('express');
const serverlessExpress = require('@codegenie/serverless-express');

const app = express();
app.use(
  express.static(dist, {
    setHeaders: (res, filePath) => {
      res.setHeader(
        'Cache-Control',
        filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  }),
);

// The options lambda.ts passes. Add binarySettings here to try a fix.
const handler = serverlessExpress({ app, ...JSON.parse(process.env.ADAPTER_OPTIONS ?? '{}') });

const event = (rawPath) => ({
  version: '2.0',
  routeKey: '$default',
  rawPath,
  rawQueryString: '',
  headers: { host: 'reference-architecture-lambda.603.nz', accept: '*/*' },
  requestContext: {
    accountId: '000000000000',
    apiId: 'local',
    domainName: 'reference-architecture-lambda.603.nz',
    http: { method: 'GET', path: rawPath, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'lambda-static' },
    requestId: 'local',
    routeKey: '$default',
    stage: '$default',
    time: new Date().toISOString(),
    timeEpoch: Date.now(),
  },
  isBase64Encoded: false,
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

let broken = 0;
for (const file of walk(dist).sort()) {
  const rawPath = '/' + path.relative(dist, file).split(path.sep).join('/');
  const response = await handler(event(rawPath), {});
  const body = Buffer.from(response.body ?? '', response.isBase64Encoded ? 'base64' : 'utf8');
  const intact = body.equals(fs.readFileSync(file));
  if (!intact) broken += 1;
  console.log(
    `${intact ? 'intact ' : 'BROKEN '} ${rawPath.padEnd(52)} ${String(response.headers['content-type']).padEnd(28)} ` +
      `${response.isBase64Encoded ? 'base64' : 'utf8  '} ${fs.statSync(file).size} -> ${body.length} bytes`,
  );
}

console.log(broken ? `\n${broken} file(s) would be served broken.` : '\nEvery file comes back intact.');
process.exit(broken ? 1 : 0);
