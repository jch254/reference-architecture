import { generateKeyPairSync, KeyObject } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

import jwt, { SignOptions } from 'jsonwebtoken';

import type { OidcJwtValidator } from './oidc-jwt.validator';

const issuer = 'https://issuer.example.com/';
const audience = 'api://reference';
const keyId = 'test-key';

describe('OidcJwtValidator', () => {
  const originalEnv = process.env;
  let privateKey: KeyObject;
  let invalidPrivateKey: KeyObject;
  let jwksUri: string;
  let server: Server;

  beforeAll(async () => {
    const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const invalidKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = keyPair.privateKey;
    invalidPrivateKey = invalidKeyPair.privateKey;

    const jwk = keyPair.publicKey.export({ format: 'jwk' });
    const jwks = {
      keys: [{ ...jwk, kid: keyId, use: 'sig', alg: 'RS256' }],
    };

    server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(jwks));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    jwksUri = `http://127.0.0.1:${address.port}/.well-known/jwks.json`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      DYNAMODB_TABLE: 'test-table',
      TENANT_RESOLUTION_MODE: 'fixed',
      APP_TENANT_ID: 'test-tenant',
      COOKIE_SECRET: 'test-cookie-secret',
      EMAIL_MODE: 'noop',
      AUTH_PROVIDER: 'oidc',
      OIDC_ISSUER: issuer,
      OIDC_AUDIENCE: audience,
      OIDC_JWKS_URI: jwksUri,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  function loadValidator(): OidcJwtValidator {
    const {
      OidcJwtValidator: IsolatedOidcJwtValidator,
    } = require('./oidc-jwt.validator') as typeof import('./oidc-jwt.validator');

    return new IsolatedOidcJwtValidator();
  }

  function signToken(options: {
    subject?: string;
    tokenIssuer?: string;
    tokenAudience?: string;
    expiresIn?: SignOptions['expiresIn'];
    signingKey?: KeyObject;
    payload?: Record<string, unknown>;
  } = {}): string {
    const signOptions: SignOptions = {
      algorithm: 'RS256',
      keyid: keyId,
      issuer: options.tokenIssuer ?? issuer,
      audience: options.tokenAudience ?? audience,
      expiresIn: options.expiresIn ?? '5m',
    };
    if (options.subject) {
      signOptions.subject = options.subject;
    }

    return jwt.sign(
      {
        email: 'user@example.com',
        name: 'Example User',
        picture: 'https://example.com/avatar.png',
        ...options.payload,
      },
      options.signingKey ?? privateKey,
      signOptions,
    );
  }

  it('accepts a valid token and returns a provider-neutral principal', async () => {
    const validator = loadValidator();
    const token = signToken({
      subject: 'auth0|user-123',
      payload: {
        org_id: 'org_ignored',
        tenant_id: 'tenant-ignored',
        'https://example.com/tenant': 'also-ignored',
      },
    });

    await expect(validator.validate(token)).resolves.toEqual({
      provider: 'oidc',
      subject: 'auth0|user-123',
      email: 'user@example.com',
      name: 'Example User',
      picture: 'https://example.com/avatar.png',
    });
  });

  it('rejects an expired token', async () => {
    const validator = loadValidator();
    const token = signToken({ subject: 'auth0|user-123', expiresIn: '-10s' });

    await expect(validator.validate(token)).rejects.toThrow('Invalid OIDC bearer token');
  });

  it('rejects a token with the wrong issuer', async () => {
    const validator = loadValidator();
    const token = signToken({ subject: 'auth0|user-123', tokenIssuer: 'https://wrong.example.com/' });

    await expect(validator.validate(token)).rejects.toThrow('Invalid OIDC bearer token');
  });

  it('rejects a token with the wrong audience', async () => {
    const validator = loadValidator();
    const token = signToken({ subject: 'auth0|user-123', tokenAudience: 'api://wrong' });

    await expect(validator.validate(token)).rejects.toThrow('Invalid OIDC bearer token');
  });

  it('rejects a token without subject', async () => {
    const validator = loadValidator();
    const token = signToken();

    await expect(validator.validate(token)).rejects.toThrow('OIDC token missing subject');
  });

  it('rejects a token with an invalid signature', async () => {
    const validator = loadValidator();
    const token = signToken({ subject: 'auth0|user-123', signingKey: invalidPrivateKey });

    await expect(validator.validate(token)).rejects.toThrow('Invalid OIDC bearer token');
  });
});