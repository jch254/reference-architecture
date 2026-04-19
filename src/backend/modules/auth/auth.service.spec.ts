import { Test, TestingModule } from '@nestjs/testing';
import { createHash, randomBytes } from 'crypto';

import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';
import { AuthService } from './auth.service';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

describe('AuthService — token isolation', () => {
  let service: AuthService;
  let mockDb: Record<string, jest.Mock>;
  let storedItems: Record<string, unknown>[];

  beforeEach(async () => {
    storedItems = [];

    mockDb = {
      getItem: jest.fn(),
      putItem: jest.fn().mockImplementation((_table: string, item: Record<string, unknown>) => {
        storedItems.push(item);
      }),
      updateItem: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      deleteItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DynamoDbService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('issueApiToken', () => {
    it('should reject when no admin exists (no auto-creation)', async () => {
      mockDb.getItem.mockResolvedValue(null); // no admin

      await expect(service.issueApiToken('admin@tenant-a.com', 'tenant-a')).rejects.toThrow('No admin record found');

      // No putItem calls — no admin creation, no token creation
      expect(mockDb.putItem).not.toHaveBeenCalled();
    });

    it('should issue a token for any user when admin exists', async () => {
      mockDb.getItem.mockResolvedValue({
        PK: 'TENANT#tenant-a',
        SK: 'TENANT_ADMIN',
        email: 'admin@tenant-a.com',
        tenantSlug: 'tenant-a',
      });

      const token = await service.issueApiToken('other-user@example.com', 'tenant-a');

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token!.length).toBe(64);
      expect(mockDb.putItem).toHaveBeenCalledTimes(1);
      expect(storedItems[0].entityType).toBe('API_TOKEN');
      expect(storedItems[0].email).toBe('other-user@example.com');
    });

    it('should issue a token for an existing admin with matching email', async () => {
      mockDb.getItem.mockResolvedValue({
        PK: 'TENANT#tenant-a',
        SK: 'TENANT_ADMIN',
        email: 'admin@tenant-a.com',
        tenantSlug: 'tenant-a',
      });

      const token = await service.issueApiToken('admin@tenant-a.com', 'tenant-a');

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token!.length).toBe(64); // 32 bytes hex

      // Only API token created, no admin creation
      expect(mockDb.putItem).toHaveBeenCalledTimes(1);
      expect(storedItems[0].entityType).toBe('API_TOKEN');
      expect(storedItems[0].PK).toBe('TENANT#tenant-a');
      expect(storedItems[0].email).toBe('admin@tenant-a.com');
      expect(storedItems[0].tokenHash).toBe(hashToken(token!));
    });

    it('should normalise email to lowercase', async () => {
      mockDb.getItem.mockResolvedValue({
        PK: 'TENANT#tenant-a',
        SK: 'TENANT_ADMIN',
        email: 'admin@tenant-a.com',
        tenantSlug: 'tenant-a',
      });

      const token = await service.issueApiToken('Admin@Tenant-A.com', 'tenant-a');

      expect(token).toBeTruthy();
      expect(storedItems[0].email).toBe('admin@tenant-a.com');
    });
  });

  describe('validateApiToken — cross-session isolation', () => {
    const tenantAEmail = 'admin@tenant-a.com';
    const tenantBEmail = 'admin@tenant-b.com';

    it('should validate a token for the correct tenant', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);

      mockDb.query.mockResolvedValue([
        {
          PK: 'TENANT#tenant-a',
          SK: 'API_TOKEN#abc123',
          tokenHash,
          email: tenantAEmail,
          tenantSlug: 'tenant-a',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);
      mockDb.getItem.mockResolvedValue({
        PK: 'TENANT#tenant-a',
        SK: 'TENANT_ADMIN',
        email: tenantAEmail,
        tenantSlug: 'tenant-a',
      });

      const result = await service.validateApiToken(rawToken, 'tenant-a');

      expect(result).toEqual({ email: tenantAEmail, tenantSlug: 'tenant-a' });
    });

    it('should reject a valid token when used against a different tenant', async () => {
      const rawToken = randomBytes(32).toString('hex');

      // tenant-b has no API_TOKEN records
      mockDb.query.mockResolvedValue([]);

      const result = await service.validateApiToken(rawToken, 'tenant-b');

      expect(result).toBeNull();
    });

    it('should reject a token whose record has a mismatched tenantSlug', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);

      // Simulates a record somehow scoped to tenant-a being queried via tenant-b
      mockDb.query.mockResolvedValue([
        {
          PK: 'TENANT#tenant-b',
          SK: 'API_TOKEN#abc123',
          tokenHash,
          email: tenantAEmail,
          tenantSlug: 'tenant-a', // mismatch!
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);

      const result = await service.validateApiToken(rawToken, 'tenant-b');

      expect(result).toBeNull();
    });

    it('should reject an expired token', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);

      mockDb.query.mockResolvedValue([
        {
          PK: 'TENANT#tenant-a',
          SK: 'API_TOKEN#abc123',
          tokenHash,
          email: tenantAEmail,
          tenantSlug: 'tenant-a',
          expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
        },
      ]);

      const result = await service.validateApiToken(rawToken, 'tenant-a');

      expect(result).toBeNull();
    });

    it('should not match a token with a different hash', async () => {
      const rawToken = randomBytes(32).toString('hex');
      const differentToken = randomBytes(32).toString('hex');

      mockDb.query.mockResolvedValue([
        {
          PK: 'TENANT#tenant-a',
          SK: 'API_TOKEN#abc123',
          tokenHash: hashToken(differentToken), // different hash
          email: tenantAEmail,
          tenantSlug: 'tenant-a',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);

      const result = await service.validateApiToken(rawToken, 'tenant-a');

      expect(result).toBeNull();
    });
  });

  describe('multi-tenant token isolation', () => {
    it('tokens issued for tenant-a and tenant-b should be fully isolated', async () => {
      // --- Issue token for tenant-a ---
      mockDb.getItem.mockResolvedValueOnce({
        PK: 'TENANT#tenant-a',
        SK: 'TENANT_ADMIN',
        email: 'admin@a.com',
        tenantSlug: 'tenant-a',
      });
      const tokenA = await service.issueApiToken('admin@a.com', 'tenant-a');
      expect(tokenA).toBeTruthy();

      // --- Issue token for tenant-b ---
      mockDb.getItem.mockResolvedValueOnce({
        PK: 'TENANT#tenant-b',
        SK: 'TENANT_ADMIN',
        email: 'admin@b.com',
        tenantSlug: 'tenant-b',
      });
      const tokenB = await service.issueApiToken('admin@b.com', 'tenant-b');
      expect(tokenB).toBeTruthy();

      // Tokens must be different
      expect(tokenA).not.toBe(tokenB);

      // --- Validate tokenA against tenant-a: should succeed ---
      const tokenAItem = storedItems.find(
        (i) => i.entityType === 'API_TOKEN' && i.tenantSlug === 'tenant-a',
      )!;
      mockDb.query.mockResolvedValueOnce([tokenAItem]);
      mockDb.getItem.mockResolvedValueOnce({
        PK: 'TENANT#tenant-a',
        SK: 'TENANT_ADMIN',
        email: 'admin@a.com',
        tenantSlug: 'tenant-a',
      });

      const resultA = await service.validateApiToken(tokenA!, 'tenant-a');
      expect(resultA).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });

      // --- Validate tokenA against tenant-b: should fail (no matching records) ---
      mockDb.query.mockResolvedValueOnce([]); // tenant-b has no matching token

      const resultACrossB = await service.validateApiToken(tokenA!, 'tenant-b');
      expect(resultACrossB).toBeNull();

      // --- Validate tokenB against tenant-b: should succeed ---
      const tokenBItem = storedItems.find(
        (i) => i.entityType === 'API_TOKEN' && i.tenantSlug === 'tenant-b',
      )!;
      mockDb.query.mockResolvedValueOnce([tokenBItem]);
      mockDb.getItem.mockResolvedValueOnce({
        PK: 'TENANT#tenant-b',
        SK: 'TENANT_ADMIN',
        email: 'admin@b.com',
        tenantSlug: 'tenant-b',
      });

      const resultB = await service.validateApiToken(tokenB!, 'tenant-b');
      expect(resultB).toEqual({ email: 'admin@b.com', tenantSlug: 'tenant-b' });

      // --- Validate tokenB against tenant-a: should fail ---
      mockDb.query.mockResolvedValueOnce([]); // tenant-a has no matching token

      const resultBCrossA = await service.validateApiToken(tokenB!, 'tenant-a');
      expect(resultBCrossA).toBeNull();
    });

    it('multiple tokens for the same tenant should each validate independently', async () => {
      mockDb.getItem.mockResolvedValue({
        PK: 'TENANT#tenant-a',
        SK: 'TENANT_ADMIN',
        email: 'admin@a.com',
        tenantSlug: 'tenant-a',
      });

      const token1 = await service.issueApiToken('admin@a.com', 'tenant-a');
      const token2 = await service.issueApiToken('admin@a.com', 'tenant-a');

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);

      // Each token has its own unique hash
      const token1Item = storedItems[0];
      const token2Item = storedItems[1];
      expect(token1Item.tokenHash).not.toBe(token2Item.tokenHash);

      // Validate token1
      mockDb.query.mockResolvedValueOnce([token1Item]);
      const result1 = await service.validateApiToken(token1!, 'tenant-a');
      expect(result1).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });

      // Validate token2
      mockDb.query.mockResolvedValueOnce([token2Item]);
      const result2 = await service.validateApiToken(token2!, 'tenant-a');
      expect(result2).toEqual({ email: 'admin@a.com', tenantSlug: 'tenant-a' });
    });
  });
});
