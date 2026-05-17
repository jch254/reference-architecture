import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';

import { AnalyticsService } from '../../common/analytics/analytics.service';
import { AuthPrincipal } from '../../common/context/identity.types';
import { requestContextStore } from '../../common/context/request-context.store';
import { TenantResolver } from '../../common/context/tenant.resolver';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';
import { UsersService } from '../users/users.service';
import { ExampleService } from './example.service';

type StoredItem = Record<string, unknown> & { PK: string; SK: string };

class InMemoryDynamoDb {
  private readonly items = new Map<string, StoredItem>();
  readonly queryCalls: Array<{
    keyConditionExpression: string;
    expressionAttributeValues: Record<string, unknown>;
  }> = [];

  async getItem<T>(
    _tableName: string,
    key: { PK: string; SK: string },
  ): Promise<T | null> {
    return (this.items.get(this.itemKey(key)) as T | undefined) ?? null;
  }

  async putItem(
    _tableName: string,
    item: StoredItem,
  ): Promise<void> {
    this.items.set(this.itemKey(item), { ...item });
  }

  async transactWrite(
    transactItems: Array<{
      Put?: {
        Item: StoredItem;
        ConditionExpression?: string;
      };
    }>,
  ): Promise<void> {
    for (const item of transactItems) {
      const put = item.Put;
      if (
        put?.ConditionExpression?.includes('attribute_not_exists') &&
        this.items.has(this.itemKey(put.Item))
      ) {
        throw new TransactionCanceledException({
          message: 'Transaction cancelled',
          $metadata: {},
        });
      }
    }

    for (const item of transactItems) {
      if (item.Put) {
        this.items.set(this.itemKey(item.Put.Item), { ...item.Put.Item });
      }
    }
  }

  async query<T>(
    _tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, string>,
  ): Promise<T[]> {
    this.queryCalls.push({
      keyConditionExpression,
      expressionAttributeValues,
    });

    const pk = expressionAttributeValues[':pk'];
    const skPrefix = expressionAttributeValues[':skPrefix'];

    return [...this.items.values()]
      .filter((item) => item.PK === pk && item.SK.startsWith(skPrefix))
      .sort((a, b) => a.SK.localeCompare(b.SK)) as T[];
  }

  async updateItem<T>(
    _tableName: string,
    key: { PK: string; SK: string },
    updateExpression: string,
    expressionAttributeValues: Record<string, unknown>,
    expressionAttributeNames?: Record<string, string>,
  ): Promise<T | null> {
    const item = this.items.get(this.itemKey(key));
    if (!item) return null;

    for (const assignment of updateExpression.replace(/^SET /, '').split(', ')) {
      const [rawName, rawValue] = assignment.split(' = ');
      const name = expressionAttributeNames?.[rawName] ?? rawName;
      item[name] = expressionAttributeValues[rawValue];
    }

    this.items.set(this.itemKey(key), item);
    return item as T;
  }

  async deleteItem(
    _tableName: string,
    key: { PK: string; SK: string },
  ): Promise<void> {
    this.items.delete(this.itemKey(key));
  }

  allItems(): StoredItem[] {
    return [...this.items.values()];
  }

  private itemKey(key: { PK: string; SK: string }): string {
    return `${key.PK}|${key.SK}`;
  }
}

function principal(overrides: Partial<AuthPrincipal> = {}): AuthPrincipal {
  return {
    provider: 'oidc',
    subject: 'auth0|user-123',
    email: 'user@example.com',
    ...overrides,
  };
}

describe('ExampleService user-owned tenant scoping', () => {
  let service: ExampleService;
  let db: InMemoryDynamoDb;
  let mockAnalytics: Record<string, jest.Mock>;
  let mockTenantResolver: Record<string, jest.Mock>;

  async function runAsTenant<T>(
    tenantId: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    return requestContextStore.run(
      { requestId: `req-${tenantId}`, tenantSlug: tenantId, user: null },
      callback,
    );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-17T00:00:00.000Z'));

    db = new InMemoryDynamoDb();
    mockAnalytics = {
      track: jest.fn().mockResolvedValue(undefined),
    };
    mockTenantResolver = {
      resolveTenantId: jest.fn(() => 'handscape-prod'),
    };

    const usersService = new UsersService(db as unknown as DynamoDbService);
    service = new ExampleService(
      db as unknown as DynamoDbService,
      mockAnalytics as unknown as AnalyticsService,
      mockTenantResolver as unknown as TenantResolver,
      usersService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates examples under tenant and local user ownership', async () => {
    const created = await runAsTenant('handscape-prod', () =>
      service.createExample(principal(), 'First example'),
    );

    expect(created).toEqual({
      id: expect.any(String),
      userId: expect.any(String),
      name: 'First example',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    });
    expect(db.allItems()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          PK: 'TENANT#handscape-prod',
          SK: `USER#${created.userId}#EXAMPLE#${created.id}`,
          entityType: 'EXAMPLE',
          tenantId: 'handscape-prod',
          userId: created.userId,
          exampleId: created.id,
          name: 'First example',
        }),
      ]),
    );
  });

  it('lists only the authenticated local user examples without a tenant-wide scan', async () => {
    const userA = principal({ subject: 'auth0|user-a' });
    const userB = principal({ subject: 'auth0|user-b' });
    const first = await runAsTenant('handscape-prod', () =>
      service.createExample(userA, 'A'),
    );
    await runAsTenant('handscape-prod', () =>
      service.createExample(userB, 'B'),
    );

    const listed = await runAsTenant('handscape-prod', () =>
      service.listExamples(userA),
    );

    expect(listed).toEqual([first]);
    expect(db.queryCalls.at(-1)).toEqual({
      keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      expressionAttributeValues: {
        ':pk': 'TENANT#handscape-prod',
        ':skPrefix': `USER#${first.userId}#EXAMPLE#`,
      },
    });
  });

  it('allows the owner to read, update, and delete their example', async () => {
    const owner = principal();
    const created = await runAsTenant('handscape-prod', () =>
      service.createExample(owner, 'Before'),
    );

    await expect(
      runAsTenant('handscape-prod', () => service.getExample(owner, created.id)),
    ).resolves.toEqual(created);

    const updated = await runAsTenant('handscape-prod', () =>
      service.updateExample(owner, created.id, 'After'),
    );

    expect(updated).toEqual({
      ...created,
      name: 'After',
      updatedAt: '2026-05-17T00:00:00.000Z',
    });

    await expect(
      runAsTenant('handscape-prod', () => service.deleteExample(owner, created.id)),
    ).resolves.toBe(true);
    await expect(
      runAsTenant('handscape-prod', () => service.getExample(owner, created.id)),
    ).resolves.toBeNull();
  });

  it('prevents another user in the same tenant from reading, updating, or deleting', async () => {
    const owner = principal({ subject: 'auth0|owner' });
    const other = principal({ subject: 'auth0|other' });
    const created = await runAsTenant('handscape-prod', () =>
      service.createExample(owner, 'Owner only'),
    );

    await expect(
      runAsTenant('handscape-prod', () => service.getExample(other, created.id)),
    ).resolves.toBeNull();
    await expect(
      runAsTenant('handscape-prod', () =>
        service.updateExample(other, created.id, 'Spoofed'),
      ),
    ).resolves.toBeNull();
    await expect(
      runAsTenant('handscape-prod', () => service.deleteExample(other, created.id)),
    ).resolves.toBe(false);

    await expect(
      runAsTenant('handscape-prod', () => service.getExample(owner, created.id)),
    ).resolves.toEqual(created);
  });

  it('isolates the same provider subject across different tenants', async () => {
    const auth0User = principal({ subject: 'auth0|same-user' });
    const tenantAExample = await runAsTenant('tenant-a', () =>
      service.createExample(auth0User, 'Tenant A'),
    );
    const tenantBExample = await runAsTenant('tenant-b', () =>
      service.createExample(auth0User, 'Tenant B'),
    );

    expect(tenantAExample.userId).not.toBe(tenantBExample.userId);
    await expect(
      runAsTenant('tenant-b', () => service.getExample(auth0User, tenantAExample.id)),
    ).resolves.toBeNull();
    await expect(
      runAsTenant('tenant-a', () => service.listExamples(auth0User)),
    ).resolves.toEqual([tenantAExample]);
    await expect(
      runAsTenant('tenant-b', () => service.listExamples(auth0User)),
    ).resolves.toEqual([tenantBExample]);
  });

  it('reuses the same local user for repeated operations and keeps providers distinct', async () => {
    const oidc = principal({
      provider: 'oidc',
      subject: 'shared-subject',
    });
    const magicLink = principal({
      provider: 'internal_magic_link',
      subject: 'shared-subject',
    });

    const first = await runAsTenant('handscape-prod', () =>
      service.createExample(oidc, 'First'),
    );
    const second = await runAsTenant('handscape-prod', () =>
      service.createExample(oidc, 'Second'),
    );
    const magic = await runAsTenant('handscape-prod', () =>
      service.createExample(magicLink, 'Magic'),
    );

    expect(second.userId).toBe(first.userId);
    expect(magic.userId).not.toBe(first.userId);
    const oidcExamples = await runAsTenant('handscape-prod', () =>
      service.listExamples(oidc),
    );
    expect(oidcExamples).toHaveLength(2);
    expect(oidcExamples).toEqual(expect.arrayContaining([first, second]));
    await expect(
      runAsTenant('handscape-prod', () => service.listExamples(magicLink)),
    ).resolves.toEqual([magic]);
  });

  it('uses the configured tenant when request context is unavailable', async () => {
    await service.listExamples(principal());

    expect(mockTenantResolver.resolveTenantId).toHaveBeenCalled();
    expect(db.queryCalls.at(-1)?.expressionAttributeValues[':pk']).toBe(
      'TENANT#handscape-prod',
    );
  });
});
