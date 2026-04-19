import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Resend } from 'resend';

import { config } from '../../common/config';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';
import { Keys } from '../../common/dynamodb/entity.types';

interface AuthTokenRecord {
  PK: string;
  SK: string;
  entityType: string;
  tokenHash: string;
  email: string;
  tenantSlug: string;
  expiresAt: string;
  ttl: number;
  createdAt: string;
  updatedAt: string;
}

interface TenantAdminRecord {
  PK: string;
  SK: string;
  entityType: string;
  email: string;
  tenantSlug: string;
  sessionVersion?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tableName = config.dynamoDbTable;
  private readonly resend = new Resend(config.resendApiKey);

  constructor(private readonly dynamoDb: DynamoDbService) {}

  async requestLink(email: string, tenantSlug: string, suppressEmail = false): Promise<string | null> {
    const normalisedEmail = email.toLowerCase().trim();

    // Ensure tenant has an admin record (first user bootstraps it)
    const admin = await this.getAdmin(tenantSlug);

    if (!admin) {
      await this.createAdmin(tenantSlug, normalisedEmail);
    }

    return this.generateAndSendToken(normalisedEmail, tenantSlug, suppressEmail);
  }

  async verify(rawToken: string, tenantSlug: string): Promise<{ email: string; tenantSlug: string; sessionVersion: string }> {
    const tokenHash = this.hashToken(rawToken);

    const records = await this.dynamoDb.query<AuthTokenRecord>(
      this.tableName,
      'PK = :pk AND begins_with(SK, :skPrefix)',
      { ':pk': `TENANT#${tenantSlug}`, ':skPrefix': 'AUTH_TOKEN#' },
    );

    const tokenHashBuf = Buffer.from(tokenHash);
    const record = records.find((r) => {
      const stored = Buffer.from(r.tokenHash);
      return stored.length === tokenHashBuf.length && timingSafeEqual(stored, tokenHashBuf);
    });

    if (!record) {
      this.logger.warn(`Verify failed: invalid token for tenant ${tenantSlug}`);
      throw new UnauthorizedException('Invalid or expired link');
    }

    if (new Date(record.expiresAt) < new Date()) {
      await this.dynamoDb.deleteItem(this.tableName, Keys.authToken(tenantSlug, record.email));
      this.logger.warn(`Verify failed: expired token for ${record.email} in tenant ${tenantSlug}`);
      throw new UnauthorizedException('Invalid or expired link');
    }

    if (record.tenantSlug !== tenantSlug) {
      this.logger.warn(`Verify failed: tenant mismatch for ${record.email}`);
      throw new UnauthorizedException('Invalid or expired link');
    }

    // One-time use — delete token
    await this.dynamoDb.deleteItem(this.tableName, Keys.authToken(tenantSlug, record.email));

    // Rotate session version — invalidates all previously issued session cookies
    const sessionVersion = randomBytes(16).toString('hex');
    await this.dynamoDb.updateItem(
      this.tableName,
      Keys.tenantAdmin(tenantSlug),
      'SET sessionVersion = :sv, updatedAt = :ua',
      { ':sv': sessionVersion, ':ua': new Date().toISOString() },
    );

    this.logger.log(`Verify success for ${record.email} in tenant ${tenantSlug}`);
    return { email: record.email, tenantSlug: record.tenantSlug, sessionVersion };
  }

  async validateSession(payload: { email: string; tenantSlug: string; iat: number; sessionVersion?: string }, requestTenantSlug: string): Promise<boolean> {
    if (payload.tenantSlug !== requestTenantSlug) return false;

    const maxAge = config.sessionMaxAgeDays * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.iat > maxAge) return false;

    if (!payload.sessionVersion) {
      this.logger.warn(`Session rejected: missing sessionVersion for ${payload.email}`);
      return false;
    }

    const admin = await this.getAdmin(requestTenantSlug);
    if (!admin) {
      this.logger.warn(`Session rejected: no admin record for tenant ${requestTenantSlug}`);
      return false;
    }

    if (payload.sessionVersion !== admin.sessionVersion) {
      this.logger.warn(`Session rejected: stale sessionVersion for ${payload.email}`);
      return false;
    }

    return true;
  }

  async issueApiToken(email: string, tenantSlug: string): Promise<string> {
    const normalisedEmail = email.toLowerCase().trim();

    const admin = await this.getAdmin(tenantSlug);

    if (!admin) {
      this.logger.warn(`API token rejected: no admin record for tenant ${tenantSlug}`);
      throw new UnauthorizedException('No admin record found');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenId = randomBytes(16).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000);
    const now = new Date().toISOString();

    await this.dynamoDb.putItem(this.tableName, {
      ...Keys.apiToken(tenantSlug, tokenId),
      entityType: 'API_TOKEN',
      tokenHash,
      email: normalisedEmail,
      tenantSlug,
      expiresAt: expiresAt.toISOString(),
      ttl: Math.floor(expiresAt.getTime() / 1000) + 300,
      createdAt: now,
      updatedAt: now,
    });

    this.logger.log(`API token issued for ${normalisedEmail} in tenant ${tenantSlug}`);
    return rawToken;
  }

  async validateApiToken(rawToken: string, tenantSlug: string): Promise<{ email: string; tenantSlug: string } | null> {
    const tokenHash = this.hashToken(rawToken);

    const records = await this.dynamoDb.query<{
      PK: string;
      SK: string;
      tokenHash: string;
      email: string;
      tenantSlug: string;
      expiresAt: string;
    }>(
      this.tableName,
      'PK = :pk AND begins_with(SK, :skPrefix)',
      { ':pk': `TENANT#${tenantSlug}`, ':skPrefix': 'API_TOKEN#' },
    );

    const record = records.find((r) => r.tokenHash === tokenHash);
    if (!record) return null;

    if (new Date(record.expiresAt) < new Date()) return null;
    if (record.tenantSlug !== tenantSlug) return null;

    return { email: record.email, tenantSlug: record.tenantSlug };
  }

  private async getAdmin(tenantSlug: string): Promise<TenantAdminRecord | null> {
    return this.dynamoDb.getItem<TenantAdminRecord>(
      this.tableName,
      Keys.tenantAdmin(tenantSlug),
    );
  }

  private async createAdmin(tenantSlug: string, email: string): Promise<void> {
    const now = new Date().toISOString();
    await this.dynamoDb.putItem(this.tableName, {
      ...Keys.tenantAdmin(tenantSlug),
      entityType: 'TENANT_ADMIN',
      email,
      tenantSlug,
      sessionVersion: randomBytes(16).toString('hex'),
      createdAt: now,
      updatedAt: now,
    });
    this.logger.log(`Tenant admin created: ${tenantSlug} → ${email}`);
  }

  private async generateAndSendToken(email: string, tenantSlug: string, suppressEmail = false): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.authTokenExpiryMinutes * 60 * 1000);
    const now = new Date().toISOString();

    await this.dynamoDb.putItem(this.tableName, {
      ...Keys.authToken(tenantSlug, email),
      entityType: 'AUTH_TOKEN',
      tokenHash,
      email,
      tenantSlug,
      expiresAt: expiresAt.toISOString(),
      ttl: Math.floor(expiresAt.getTime() / 1000) + 300,
      createdAt: now,
      updatedAt: now,
    });

    const protocol = config.baseDomain === 'localhost' ? 'http' : 'https';
    const host = config.baseDomain === 'localhost'
      ? `localhost:${config.port}`
      : `${tenantSlug}.${config.baseDomain}`;
    // Web link opens the deep-link redirect page (NOT the API endpoint)
    const webLink = `${protocol}://${host}/auth/verify?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
    const appLink = `referenceapp://auth/verify?token=${rawToken}&email=${encodeURIComponent(email)}`;

    if (suppressEmail) {
      this.logger.log(`[suppressed] Email suppressed (escape hatch) — app link for ${email}: ${appLink}`);
      return rawToken;
    }

    switch (config.emailMode) {
      case 'noop':
        this.logger.log(`[noop] Email suppressed — app link for ${email}: ${appLink}`);
        break;

      case 'redirect': {
        const redirectTo = config.resendRedirectEmail || email;
        try {
          const { error } = await this.resend.emails.send({
            from: config.resendFromEmail,
            to: redirectTo,
            subject: `[REDIRECT] Sign-in link for ${email}`,
            html: `<p><strong>Originally for:</strong> ${email}</p><p style="margin:24px 0"><a href="${webLink}" style="background:#007AFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open in App</a></p><p>This link expires in ${config.authTokenExpiryMinutes} minutes.</p>`,
          });
          if (error) {
            this.logger.error(`Failed to send redirected magic link email: ${error.name} - ${error.message}`);
          }
        } catch (error) {
          this.logger.error(`Failed to send redirected magic link email: ${error}`);
        }
        break;
      }

      case 'live':
      default:
        try {
          const { error } = await this.resend.emails.send({
            from: config.resendFromEmail,
            to: email,
            subject: 'Your sign-in link',
            html: `<p>Tap the button below to sign in:</p><p style="margin:24px 0"><a href="${webLink}" style="background:#007AFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open in App</a></p><p>This link expires in ${config.authTokenExpiryMinutes} minutes.</p>`,
          });
          if (error) {
            this.logger.error(`Failed to send magic link email to ${email}: ${error.name} - ${error.message}`);
          }
        } catch (error) {
          this.logger.error(`Failed to send magic link email to ${email}: ${error}`);
        }
        break;
    }

    return rawToken;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
