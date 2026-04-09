import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  NativeAttributeValue,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DynamoDbService {
  private readonly logger = new Logger(DynamoDbService.name);
  private readonly docClient: DynamoDBDocumentClient;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');

    const clientConfig: DynamoDBClientConfig = { region };

    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.credentials = {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      };
    }

    this.docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient(clientConfig),
      {
        marshallOptions: {
          removeUndefinedValues: true,
          convertEmptyValues: true,
        },
      },
    );

    this.logger.log(`DynamoDB initialized (region: ${region})`);
  }

  async getItem<T = Record<string, NativeAttributeValue>>(
    tableName: string,
    key: Record<string, NativeAttributeValue>,
    consistentRead = false,
  ): Promise<T | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
        ConsistentRead: consistentRead,
      }),
    );
    return (result.Item as T) || null;
  }

  async putItem(
    tableName: string,
    item: Record<string, NativeAttributeValue>,
  ): Promise<void> {
    await this.docClient.send(
      new PutCommand({ TableName: tableName, Item: item }),
    );
  }

  async updateItem<T = Record<string, NativeAttributeValue>>(
    tableName: string,
    key: Record<string, NativeAttributeValue>,
    updateExpression: string,
    expressionAttributeValues: Record<string, NativeAttributeValue>,
    expressionAttributeNames?: Record<string, string>,
  ): Promise<T | null> {
    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW',
      }),
    );
    return (result.Attributes as T) || null;
  }

  async query<T = Record<string, NativeAttributeValue>>(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, NativeAttributeValue>,
    indexName?: string,
    limit?: number,
  ): Promise<T[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        IndexName: indexName,
        Limit: limit,
      }),
    );
    return (result.Items as T[]) || [];
  }
}
