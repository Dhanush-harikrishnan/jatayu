import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { config } from '../config/env';

const client = new DynamoDBClient({ 
  region: config.aws.region, 
  credentials: { 
    accessKeyId: config.aws.accessKeyId, 
    secretAccessKey: config.aws.secretAccessKey 
  } 
});

async function seed() {
  const eventsTable = config.aws.dynamoDbTableName || 'ProctoringEvents';
  const usersTable = 'SecureGuardUsers';
  // Use a fixed start time slightly in the past
  const start = Date.now() - 30 * 60000;
  
  for(let i = 1; i <= 10; i++) {
    const email = `student${i}@demo.com`;
    const name = `Demo Student ${i}`;
    const sessionId = `EXAM-101-${email}-${start}`;
    
    // Create user
    await client.send(new PutItemCommand({
      TableName: usersTable,
      Item: {
        email: { S: email },
        name: { S: name },
        role: { S: 'student' },
        passwordHash: { S: 'demo' }
      }
    }));
    
    // Add some random violations to simulate score drops
    const types = ['TAB_SWITCH', 'PHONE_DETECTED', 'LOOKING_AWAY', 'VOICE_DETECTED'];
    let score = 100;
    
    // Create 0 to 4 violations
    const numViolations = Math.floor(Math.random() * 5);
    for(let v = 0; v < numViolations; v++) {
      const vtype = types[Math.floor(Math.random() * types.length)];
      const ts = start + (Math.random() * 20 * 60000);
      score -= vtype === 'TAB_SWITCH' ? 2 : vtype === 'PHONE_DETECTED' ? 15 : 5;
      const uniqueId = `${sessionId}_${ts}_${Math.random().toString(36).substring(2, 7)}`;
      
      await client.send(new PutItemCommand({
        TableName: eventsTable,
        Item: {
          id: { S: uniqueId },
          SessionId: { S: sessionId },
          'EventTime#ViolationType': { S: `${new Date(ts).toISOString()}#${vtype}` },
          EventTime: { S: new Date(ts).toISOString() },
          ViolationType: { S: vtype },
          email: { S: email },
          StudentName: { S: name },
          ExamId: { S: 'EXAM-101' },
          Metadata: { S: JSON.stringify({ aiGenerated: true }) }
        }
      }));
    }
    
    // Emitting TRUST_SCORE_UPDATE
    const finalId = `${sessionId}_${start}_final`;
    await client.send(new PutItemCommand({
      TableName: eventsTable,
      Item: {
        id: { S: finalId },
        SessionId: { S: sessionId },
        'EventTime#ViolationType': { S: `${new Date(Date.now()).toISOString()}#TRUST_SCORE_UPDATE` },
        EventTime: { S: new Date(Date.now()).toISOString() },
        ViolationType: { S: 'TRUST_SCORE_UPDATE' },
        email: { S: email },
        StudentName: { S: name },
        ExamId: { S: 'EXAM-101' },
        Metadata: { S: JSON.stringify({ score: Math.max(0, score) }) }
      }
    }));
    
    console.log(`Seeded demo student ${i} with score ${Math.max(0, score)}`);
  }
}

seed().catch(console.error);