'use server'
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { headers } from 'next/headers';

// Initialize DynamoDB client
const client = new DynamoDB({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocument.from(client);

export async function saveEmail(email: string) {
  'use server'
  
  try {
    // Get headers
    const headersList = await headers();
    
    // Get IP from X-Forwarded-For header
    // ALB adds the client's IP as the last address in the XFF chain
    const forwardedFor = headersList.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    const params = {
      TableName: process.env.DYNAMODB_LANDING_TABLE!,
      Item: {
        PK: uuidv4(),
        email: email,
        ip_address: clientIp,
        created_at: new Date().toISOString()
      }
    };

    await docClient.put(params);
    return { success: true };
  } catch (error) {
    console.error('Error saving email:', error);
    return { success: false, error: 'Failed to save email' };
  }
}
