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
  const eventsTableName = config.aws.dynamoDbTableName || 'ProctoringEvents';
  const examsTableName = 'SecureGuardExams';

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

    // Proctoring events table (violations + evidence pointers)
    console.log(`Checking if table ${eventsTableName} exists...`);
    const createEventsCmd = new CreateTableCommand({
      TableName: eventsTableName,
      AttributeDefinitions: [
        { AttributeName: 'SessionId', AttributeType: 'S' },
        { AttributeName: 'EventTime#ViolationType', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'SessionId', KeyType: 'HASH' },
        { AttributeName: 'EventTime#ViolationType', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });

    try {
      await dynamoClient.send(createEventsCmd);
      console.log(`Table ${eventsTableName} creation initiated. Waiting 10 seconds for it to become ACTIVE...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (e: any) {
      if (e.name === 'ResourceInUseException') {
        console.log(`Table ${eventsTableName} already exists.`);
      } else {
        throw e;
      }
    }

    console.log(`Checking if table ${examsTableName} exists...`);
    const createExamsCmd = new CreateTableCommand({
      TableName: examsTableName,
      AttributeDefinitions: [
        { AttributeName: 'examId', AttributeType: 'S' },
        { AttributeName: 'enabledStatus', AttributeType: 'S' }, // "true" or "false" stringified for GSI
        { AttributeName: 'startTime', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'examId', KeyType: 'HASH' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'EnabledStartTimeIndex',
          KeySchema: [
            { AttributeName: 'enabledStatus', KeyType: 'HASH' },
            { AttributeName: 'startTime', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });

    try {
      await dynamoClient.send(createExamsCmd);
      console.log(`Table ${examsTableName} creation initiated. Waiting 10 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (e: any) {
      if (e.name === 'ResourceInUseException') {
        console.log(`Table ${examsTableName} already exists.`);
      } else {
        throw e;
      }
    }

    const questionsTableName = 'SecureGuardQuestions';
    console.log(`Checking if table ${questionsTableName} exists...`);
    const createQuestionsCmd = new CreateTableCommand({
      TableName: questionsTableName,
      AttributeDefinitions: [
        { AttributeName: 'questionId', AttributeType: 'S' },
        { AttributeName: 'examId', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'questionId', KeyType: 'HASH' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'ExamIdIndex',
          KeySchema: [
            { AttributeName: 'examId', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });

    try {
      await dynamoClient.send(createQuestionsCmd);
      console.log(`Table ${questionsTableName} creation initiated. Waiting 10 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (e: any) {
      if (e.name === 'ResourceInUseException') {
        console.log(`Table ${questionsTableName} already exists.`);
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

    const { marshall } = require('@aws-sdk/util-dynamodb');
    console.log('Seeding exams...');

    const exams = [
      {
        examId: 'EXAM-101',
        title: 'Introduction to Computer Science',
        description: 'Covers basic algorithms, data structures, and software engineering principles.',
        duration: 120,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        enabled: true,
        requireFullscreen: true,
        enabledStatus: 'true',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        examId: 'EXAM-102',
        title: 'Advanced Mathematics',
        description: 'Calculus, linear algebra, and discrete mathematics.',
        duration: 180,
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 9).toISOString(),
        enabled: false,
        requireFullscreen: true,
        enabledStatus: 'false',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        examId: 'PRACTICE-001',
        title: 'Practice: Networking Basics',
        description: 'Test your knowledge of fundamental networking concepts, protocols, and architecture.',
        duration: 15,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
        enabled: true,
        requireFullscreen: false,
        enabledStatus: 'true',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const exam of exams) {
      const putExamCmd = new PutItemCommand({
        TableName: examsTableName,
        Item: marshall(exam, { removeUndefinedValues: true })
      });
      await dynamoClient.send(putExamCmd);
      console.log(`Seeded exam: ${exam.examId}`);
    }

    console.log('Seeding questions...');
  
    const QUESTION_BANK = {
      default: [
        { id: 1, text: "What is the primary function of a reverse proxy?", options: ["Load balancing & security", "Database indexing", "Compiling backend code", "Direct network routing"], correct: 0 },
        { id: 2, text: "Which HTTP method is idempotent according to REST principles?", options: ["POST", "PATCH", "PUT", "CONNECT"], correct: 2 },
        { id: 3, text: "What is the worst-case time complexity of binary search?", options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"], correct: 2 },
        { id: 4, text: "Which AWS service is optimized for NoSQL key-value high-throughput storage?", options: ["Amazon RDS", "Amazon DynamoDB", "Amazon S3", "Amazon Redshift"], correct: 1 },
        { id: 5, text: "What does CORS stand for in web security context?", options: ["Cross-Origin Resource Sharing", "Centralized Object Routing System", "Computer Operated Relay Server", "Core Operations Regression Suite"], correct: 0 }
      ],
      "PRACTICE-001": [
        { id: 1, text: "Which layer of the OSI model handles IP addressing?", options: ["Data Link", "Network", "Transport", "Session"], correct: 1 },
        { id: 2, text: "What is the default port for HTTPS?", options: ["80", "21", "443", "8080"], correct: 2 },
        { id: 3, text: "Which protocol converts a domain name to an IP address?", options: ["DHCP", "DNS", "ARP", "FTP"], correct: 1 },
        { id: 4, text: "What does TCP stand for?", options: ["Transfer Control Protocol", "Transmission Control Protocol", "Tunneling Communication Protocol", "Terminal Control Protocol"], correct: 1 },
        { id: 5, text: "Which device operates at Layer 3 of the OSI model?", options: ["Switch", "Hub", "Router", "Repeater"], correct: 2 },
      ]
    };

    for (const [examKey, questions] of Object.entries(QUESTION_BANK)) {
      const targetExamId = examKey === 'default' ? 'EXAM-101' : examKey;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qItem = {
          questionId: `${targetExamId}-Q${q.id}`,
          examId: targetExamId,
          sectionType: 'MCQ',
          order: i,
          text: q.text,
          options: q.options,
          correctAnswer: q.correct,
          difficulty: 'medium',
          points: 1
        };
        await dynamoClient.send(new PutItemCommand({
          TableName: questionsTableName,
          Item: marshall(qItem, { removeUndefinedValues: true })
        }));
      }
      console.log(`Seeded questions for ${targetExamId}`);
    }

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main();
