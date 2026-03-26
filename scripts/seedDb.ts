import { DynamoDBClient, CreateTableCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

async function run() {
  try {
    // 1. Create Users Table
    console.log('Creating Users table...');
    try {
      await dynamoClient.send(new CreateTableCommand({
        TableName: 'Users',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      }));
      console.log('Users table created. Waiting for it to become active...');
      await new Promise(r => setTimeout(r, 10000)); // Wait 10s for table to be active
    } catch (e: any) {
      if (e.name !== 'ResourceInUseException') throw e;
      console.log('Users table already exists.');
    }

    // 2. Create ProctoringEvents Table (if it doesn't exist)
    console.log('Creating ProctoringEvents table...');
    try {
      await dynamoClient.send(new CreateTableCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'ProctoringEvents',
        KeySchema: [
          { AttributeName: 'SessionId', KeyType: 'HASH' },
          { AttributeName: 'EventTime_ViolationType', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'SessionId', AttributeType: 'S' },
          { AttributeName: 'EventTime_ViolationType', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }));
      console.log('ProctoringEvents table created. Waiting...');
      await new Promise(r => setTimeout(r, 10000));
    } catch (e: any) {
      if (e.name !== 'ResourceInUseException') throw e;
      console.log('ProctoringEvents table already exists.');
    }

    // 3. Seed Users
    const adminPassword = await bcrypt.hash('admin123', 10);
    const studentPassword = await bcrypt.hash('student123', 10);

    console.log('Inserting admin user...');
    await dynamoClient.send(new PutItemCommand({
      TableName: 'Users',
      Item: {
        email: { S: 'dhanushhari150504@gmail.com' },
        password: { S: adminPassword },
        role: { S: 'admin' },
        name: { S: 'Admin Dhanush' }
      }
    }));

    console.log('Inserting student user...');
    await dynamoClient.send(new PutItemCommand({
      TableName: 'Users',
      Item: {
        email: { S: 'barathsyntax@gmail.com' },
        password: { S: studentPassword },
        role: { S: 'student' },
        name: { S: 'Student Barath' }
      }
    }));

    console.log('Database seeding complete!');
  } catch (error) {
    console.error('Error seeding DB:', error);
  }
}

run();
