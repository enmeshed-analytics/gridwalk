import { NextResponse } from 'next/server';
import { DynamoDBStrategy, DatabaseContext, getDynamoDBClient } from '@/utils/data';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const region: string = process.env.AWS_REGION || '';
  const tableName = process.env.DYNAMODB_TABLE || '';
  const client = getDynamoDBClient(region);
  const strategy = new DynamoDBStrategy(client, tableName);
  const database = new DatabaseContext(strategy);

  try {
    // Fetch data sources from DynamoDB
    const connections = await database.listConnections();

    // Convert dataSources to a JSON string
    const jsonResponse = JSON.stringify(connections);

    // Create a new NextResponse with the JSON data
    return new NextResponse(jsonResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
