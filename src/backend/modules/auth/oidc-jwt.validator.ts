import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt, { JwtHeader, JwtPayload, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';

import { config } from '../../common/config';
import { AuthPrincipal } from '../../common/context/identity.types';

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@Injectable()
export class OidcJwtValidator {
  private readonly jwksClient: JwksClient | null = config.authProvider === 'oidc'
    ? jwksClient({
        jwksUri: config.oidc.jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      })
    : null;

  isEnabled(): boolean {
    return config.authProvider === 'oidc';
  }

  async validate(rawToken: string): Promise<AuthPrincipal> {
    if (!this.isEnabled()) {
      throw new UnauthorizedException();
    }

    const claims = await this.verify(rawToken);
    const subject = optionalString(claims.sub);
    if (!subject) {
      throw new UnauthorizedException('OIDC token missing subject');
    }

    return {
      provider: 'oidc',
      subject,
      email: optionalString(claims.email),
      name: optionalString(claims.name),
      picture: optionalString(claims.picture),
    };
  }

  private verify(rawToken: string): Promise<JwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        rawToken,
        this.getSigningKey,
        {
          algorithms: ['RS256'],
          issuer: config.oidc.issuer,
          audience: config.oidc.audience,
        },
        (error, decoded) => {
          if (error || !decoded || typeof decoded === 'string') {
            reject(new UnauthorizedException('Invalid OIDC bearer token'));
            return;
          }

          resolve(decoded);
        },
      );
    });
  }

  private readonly getSigningKey = (
    header: JwtHeader,
    callback: SigningKeyCallback,
  ): void => {
    if (!this.jwksClient || !header.kid) {
      callback(new Error('OIDC token is missing a usable key id'));
      return;
    }

    this.jwksClient.getSigningKey(header.kid, (error, key) => {
      if (error || !key) {
        callback(error ?? new Error('OIDC signing key not found'));
        return;
      }

      callback(null, key.getPublicKey());
    });
  };
}