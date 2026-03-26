import { DynamoDBClient, CreateTableCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';

const dynamoClient = new DynamoDBClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

async function main() {
  const tableName = 'SecureGuardUsers';

  try {
    console.log(`Checking if table ${tableName} exists...`);
    // Create Table Command
    const createCmd = new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [
        { AttributeName: 'email', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'email', KeyType: 'HASH' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });

    try {
      await dynamoClient.send(createCmd);
      console.log(`Table ${tableName} creation initiated. Waiting 10 seconds for it to become ACTIVE...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (e: any) {
      if (e.name === 'ResourceInUseException') {
        console.log(`Table ${tableName} already exists.`);
      } else {
        throw e;
      }
    }

    console.log('Seeding users...');
    
    // Hash passwords
    const saltRounds = 10;
    const adminPasswordHash = await bcrypt.hash('Dhanush@1505', saltRounds);
    const studentPasswordHash = await bcrypt.hash('Barath@1505', saltRounds);

    const users = [
      {
        email: 'dhanushhari150504@gmail.com',
        passwordHash: adminPasswordHash,
        role: 'admin',
        name: 'Dhanush Hari'
      },
      {
        email: 'barathsyntax@gmail.com',
        passwordHash: studentPasswordHash,
        role: 'student',
        name: 'Barath'
      }
    ];

    for (const user of users) {
      const putCmd = new PutItemCommand({
        TableName: tableName,
        Item: {
          email: { S: user.email },
          passwordHash: { S: user.passwordHash },
          role: { S: user.role },
          name: { S: user.name }
        }
      });
      await dynamoClient.send(putCmd);
      console.log(`Seeded user: ${user.email} (${user.role})`);
    }

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main();
