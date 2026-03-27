import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env'), override: true });
console.log('Resolved .env path:', path.join(process.cwd(), '.env'));

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

async function checkTable() {
  const tableName = process.env.DYNAMODB_TABLE_NAME || 'ProctoringEvents';
  console.log(`Checking table: ${tableName} in region: ${process.env.AWS_REGION}`);
  try {
    const command = new DescribeTableCommand({ TableName: tableName });
    const response = await client.send(command);
    console.log('--- Table Schema ---');
    console.log(JSON.stringify(response.Table?.KeySchema, null, 2));
    console.log('--- Attribute Definitions ---');
    console.log(JSON.stringify(response.Table?.AttributeDefinitions, null, 2));
    console.log('--- Table Status ---');
    console.log(`Status: ${response.Table?.TableStatus}`);
    console.log(`Item Count: ${response.Table?.ItemCount}`);
  } catch (err) {
    console.error('Failed to describe table:', err);
  }
}

checkTable();
