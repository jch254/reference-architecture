import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';

import { AuthPrincipal } from '../../common/context/identity.types';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';
import { UsersService } from './users.service';

type StoredItem = Record<string, unknown> & { PK: string; SK: string };

class InMemoryDynamoDb {
  private readonly items = new Map<string, StoredItem>();

  async getItem<T>(
    _tableName: string,
    key: { PK: string; SK: string },
  ): Promise<T | null> {
    return (this.items.get(this.itemKey(key)) as T | undefined) ?? null;
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
    email: 'same@example.com',
    name: 'Example User',
    picture: 'https://example.com/avatar.png',
    ...overrides,
  };
}

describe('UsersService', () => {
  let db: InMemoryDynamoDb;
  let service: UsersService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-17T00:00:00.000Z'));
    db = new InMemoryDynamoDb();
    service = new UsersService(db as unknown as DynamoDbService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a tenant-scoped user on first principal', async () => {
    const user = await service.findOrCreateFromPrincipal('tenant-a', principal());

    expect(user).toEqual({
      userId: expect.any(String),
      tenantId: 'tenant-a',
      provider: 'oidc',
      providerSubject: 'auth0|user-123',
      email: 'same@example.com',
      name: 'Example User',
      picture: 'https://example.com/avatar.png',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
      lastSeenAt: '2026-05-17T00:00:00.000Z',
    });
    expect(db.allItems()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          PK: 'TENANT#tenant-a',
          SK: `USER#${user.userId}`,
          entityType: 'USER',
        }),
        expect.objectContaining({
          PK: 'TENANT#tenant-a',
          SK: expect.stringMatching(/^USER_IDENTITY#oidc#[a-f0-9]{64}$/),
          entityType: 'USER_IDENTITY',
          userId: user.userId,
          providerSubject: 'auth0|user-123',
        }),
      ]),
    );
  });

  it('returns the same user and updates lastSeenAt on repeated calls', async () => {
    const first = await service.findOrCreateFromPrincipal('tenant-a', principal());

    jest.setSystemTime(new Date('2026-05-17T00:05:00.000Z'));
    const second = await service.findOrCreateFromPrincipal('tenant-a', principal());

    expect(second.userId).toBe(first.userId);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBe(first.updatedAt);
    expect(second.lastSeenAt).toBe('2026-05-17T00:05:00.000Z');
  });

  it('updates safe profile fields while preserving stable identity fields', async () => {
    const first = await service.findOrCreateFromPrincipal('tenant-a', principal());

    jest.setSystemTime(new Date('2026-05-17T00:10:00.000Z'));
    const second = await service.findOrCreateFromPrincipal(
      'tenant-a',
      principal({
        email: 'new@example.com',
        name: 'New Name',
        picture: 'https://example.com/new.png',
      }),
    );

    expect(second).toEqual({
      ...first,
      email: 'new@example.com',
      name: 'New Name',
      picture: 'https://example.com/new.png',
      updatedAt: '2026-05-17T00:10:00.000Z',
      lastSeenAt: '2026-05-17T00:10:00.000Z',
    });
  });

  it('creates different users for the same provider subject in different tenants', async () => {
    const tenantA = await service.findOrCreateFromPrincipal('tenant-a', principal());
    const tenantB = await service.findOrCreateFromPrincipal('tenant-b', principal());

    expect(tenantA.userId).not.toBe(tenantB.userId);
    expect(tenantA.tenantId).toBe('tenant-a');
    expect(tenantB.tenantId).toBe('tenant-b');
  });

  it('creates different users for different providers with the same subject and email', async () => {
    const oidcUser = await service.findOrCreateFromPrincipal('tenant-a', principal());
    const magicLinkUser = await service.findOrCreateFromPrincipal(
      'tenant-a',
      principal({ provider: 'internal_magic_link' }),
    );

    expect(oidcUser.userId).not.toBe(magicLinkUser.userId);
    expect(magicLinkUser.provider).toBe('internal_magic_link');
    expect(magicLinkUser.providerSubject).toBe('auth0|user-123');
    expect(magicLinkUser.email).toBe('same@example.com');
  });

  it('does not key identity by email', async () => {
    const first = await service.findOrCreateFromPrincipal('tenant-a', principal());
    const second = await service.findOrCreateFromPrincipal(
      'tenant-a',
      principal({
        subject: 'auth0|other-user',
        email: first.email,
      }),
    );

    expect(second.userId).not.toBe(first.userId);
    expect(second.email).toBe(first.email);
  });
});
