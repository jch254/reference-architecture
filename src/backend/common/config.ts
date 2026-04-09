export const config = {
  port: process.env.PORT || 3000,
  dynamoDbTable: process.env.DYNAMODB_TABLE || '',
};
