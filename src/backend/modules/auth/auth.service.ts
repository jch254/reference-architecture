import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
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

    // Check if tenant has an admin
    const admin = await this.getAdmin(tenantSlug);

    if (!admin) {
      // First visit — register this email as tenant admin
      await this.createAdmin(tenantSlug, normalisedEmail);
      return this.generateAndSendToken(normalisedEmail, tenantSlug, suppressEmail);
    }

    // Tenant exists — only send token if email matches admin
    if (admin.email === normalisedEmail) {
      return this.generateAndSendToken(normalisedEmail, tenantSlug, suppressEmail);
    }

    // Always return silently — no email enumeration
    return null;
  }

  async verify(rawToken: string, tenantSlug: string): Promise<{ email: string; tenantSlug: string; sessionVersion: string }> {
    const tokenHash = this.hashToken(rawToken);

    const records = await this.dynamoDb.query<AuthTokenRecord>(
      this.tableName,
      'PK = :pk AND begins_with(SK, :skPrefix)',
      { ':pk': `TENANT#${tenantSlug}`, ':skPrefix': 'AUTH_TOKEN#' },
    );

    const record = records.find((r) => r.tokenHash === tokenHash);

    if (!record) {
      throw new UnauthorizedException('Invalid or expired link');
    }

    if (new Date(record.expiresAt) < new Date()) {
      await this.dynamoDb.deleteItem(this.tableName, Keys.authToken(tenantSlug, record.email));
      throw new UnauthorizedException('Invalid or expired link');
    }

    if (record.tenantSlug !== tenantSlug) {
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

    return { email: record.email, tenantSlug: record.tenantSlug, sessionVersion };
  }

  async validateSession(payload: { email: string; tenantSlug: string; iat: number; sessionVersion?: string }, requestTenantSlug: string): Promise<boolean> {
    if (payload.tenantSlug !== requestTenantSlug) return false;

    const maxAge = config.sessionMaxAgeDays * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.iat > maxAge) return false;

    // Sessions without a version are always invalid
    if (!payload.sessionVersion) return false;

    // Verify the email is still the tenant admin and session version matches
    const admin = await this.getAdmin(requestTenantSlug);
    if (!admin || admin.email !== payload.email) return false;

    // Reject sessions issued before the latest login (sessionVersion mismatch)
    if (admin.sessionVersion !== payload.sessionVersion) return false;

    return true;
  }

  async issueApiToken(email: string, tenantSlug: string): Promise<string | null> {
    const normalisedEmail = email.toLowerCase().trim();

    // Check if tenant has an admin
    const admin = await this.getAdmin(tenantSlug);

    if (!admin) {
      // First visit — register this email as tenant admin
      await this.createAdmin(tenantSlug, normalisedEmail);
    } else if (admin.email !== normalisedEmail) {
      // Email doesn't match admin — reject silently
      return null;
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

    // Verify email is still the tenant admin
    const admin = await this.getAdmin(tenantSlug);
    if (!admin || admin.email !== record.email) return null;

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
    const port = config.baseDomain === 'localhost' ? `:${config.port}` : '';
    const link = `${protocol}://${tenantSlug}.${config.baseDomain}${port}/api/auth/verify?t=${rawToken}`;

    if (suppressEmail) {
      this.logger.log(`[suppressed] Email suppressed (escape hatch) — magic link for ${email}: ${link}`);
      return rawToken;
    }

    switch (config.emailMode) {
      case 'noop':
        this.logger.log(`[noop] Email suppressed — magic link for ${email}: ${link}`);
        break;

      case 'redirect': {
        const redirectTo = config.resendRedirectEmail || email;
        try {
          await this.resend.emails.send({
            from: config.resendFromEmail,
            to: redirectTo,
            subject: `[REDIRECT] Sign-in link for ${email}`,
            html: `<p><strong>Originally for:</strong> ${email}</p><p><a href="${link}">${link}</a></p><p>This link expires in ${config.authTokenExpiryMinutes} minutes.</p>`,
          });
        } catch (error) {
          this.logger.error(`Failed to send redirected magic link email: ${error}`);
        }
        break;
      }

      case 'live':
      default:
        try {
          await this.resend.emails.send({
            from: config.resendFromEmail,
            to: email,
            subject: 'Your sign-in link',
            html: `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${config.authTokenExpiryMinutes} minutes.</p>`,
          });
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
