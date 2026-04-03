import { DynamoDBClient, ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { config } from './src/config/env';

const client = new DynamoDBClient({ 
  region: config.aws.region, 
  credentials: { 
    accessKeyId: config.aws.accessKeyId, 
    secretAccessKey: config.aws.secretAccessKey 
  } 
});

async function run() {
  const TableName = 'SecureGuardExams';
  const data = await client.send(new ScanCommand({ TableName }));
  
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  const endTimeIso = oneMonthFromNow.toISOString();
  
  for (const item of data.Items || []) {
    const unmarshalled = unmarshall(item);
    console.log(`Updating ${unmarshalled.examId}...`);
    unmarshalled.enabled = true;
    unmarshalled.enabledStatus = 'true';
    unmarshalled.endTime = endTimeIso;
    // to give multiple attempts, we might need to wipe their submissions, but first let's make it active.
    
    await client.send(new PutItemCommand({
        TableName,
        Item: marshall(unmarshalled, { removeUndefinedValues: true })
    }));
  }
  console.log('Update complete!');
}

run().catch(console.error);