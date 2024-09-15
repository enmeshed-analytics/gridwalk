import { DynamoDBClient, ScanCommand, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

interface Connection {
  id: string;
  name: string;
  connector: string;
}

interface DatabaseStrategy {
  listConnections(): Promise<Connection[]>;
}

class DynamoDBStrategy implements DatabaseStrategy {
  private client: DynamoDBClient;
  private tableName: string;

  constructor(client: DynamoDBClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async listConnections(): Promise<Connection[]> {
    const params: ScanCommandInput = {
      TableName: this.tableName,
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': { S: 'CON#' },
      },
    };

    try {
      const command = new ScanCommand(params);
      const result = await this.client.send(command);
      
      return (result.Items || []).map(item => {
        const unmarshalledItem = unmarshall(item);
        return {
          id: unmarshalledItem.PK.replace('CON#', ''),
          name: unmarshalledItem.name,
          connector: unmarshalledItem.connector,
        };
      });
    } catch (error) {
      console.error('Error scanning DynamoDB:', error);
      throw error;
    }
  }
}

class DatabaseContext {
  private strategy: DatabaseStrategy;

  constructor(strategy: DatabaseStrategy) {
    this.strategy = strategy;
  }

  async listConnections(): Promise<Connection[]> {
    return this.strategy.listConnections();
  }
}

// Utility function to get or create a DynamoDBClient
let dynamodbClient: DynamoDBClient;
function getDynamoDBClient(region: string): DynamoDBClient {
  if (!dynamodbClient) {
    console.log('creating dynamodb client');
    dynamodbClient = new DynamoDBClient({ region });
  }
  return dynamodbClient;
}

export type { Connection, DatabaseStrategy }
export { DynamoDBStrategy, DatabaseContext, getDynamoDBClient };
