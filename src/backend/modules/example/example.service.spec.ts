import { AnalyticsService } from '../../common/analytics/analytics.service';
import { requestContextStore } from '../../common/context/request-context.store';
import { TenantResolver } from '../../common/context/tenant.resolver';
import { DynamoDbService } from '../../common/dynamodb/dynamodb.service';
import { ExampleService } from './example.service';

describe('ExampleService tenant scoping', () => {
  let service: ExampleService;
  let mockDb: Record<string, jest.Mock>;
  let mockAnalytics: Record<string, jest.Mock>;
  let mockTenantResolver: Record<string, jest.Mock>;

  beforeEach(() => {
    mockDb = {
      putItem: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
    };
    mockAnalytics = {
      track: jest.fn().mockResolvedValue(undefined),
    };
    mockTenantResolver = {
      resolveTenantId: jest.fn(() => 'handscape-prod'),
    };

    service = new ExampleService(
      mockDb as unknown as DynamoDbService,
      mockAnalytics as unknown as AnalyticsService,
      mockTenantResolver as unknown as TenantResolver,
    );
  });

  it('scopes created examples to the configured tenant', async () => {
    await service.createExample('First example');

    expect(mockDb.putItem).toHaveBeenCalledWith(
      'test-table',
      expect.objectContaining({
        PK: 'TENANT#handscape-prod',
        SK: expect.stringMatching(/^EXAMPLE#/),
        entityType: 'EXAMPLE',
        name: 'First example',
      }),
    );
  });

  it('lists examples from the configured tenant partition', async () => {
    await service.listExamples();

    expect(mockDb.query).toHaveBeenCalledWith(
      'test-table',
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': 'TENANT#handscape-prod',
        ':skPrefix': 'EXAMPLE#',
      },
    );
  });

  it('changes resource scope when the resolved tenant changes', async () => {
    mockTenantResolver.resolveTenantId.mockReturnValueOnce('handscape-prod');
    await service.listExamples();

    mockTenantResolver.resolveTenantId.mockReturnValueOnce('handscape-test');
    await service.listExamples();

    expect(mockDb.query).toHaveBeenNthCalledWith(
      1,
      'test-table',
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': 'TENANT#handscape-prod',
        ':skPrefix': 'EXAMPLE#',
      },
    );
    expect(mockDb.query).toHaveBeenNthCalledWith(
      2,
      'test-table',
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': 'TENANT#handscape-test',
        ':skPrefix': 'EXAMPLE#',
      },
    );
  });

  it('uses the request-context tenant when middleware has resolved one', async () => {
    await requestContextStore.run(
      { requestId: 'req-1', tenantSlug: 'acme', user: null },
      () => service.listExamples(),
    );

    expect(mockTenantResolver.resolveTenantId).not.toHaveBeenCalled();
    expect(mockDb.query).toHaveBeenCalledWith(
      'test-table',
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': 'TENANT#acme',
        ':skPrefix': 'EXAMPLE#',
      },
    );
  });
});
