const fs = require('fs');

let code = fs.readFileSync('src/scripts/seed.ts', 'utf8');
code = code.replace(
  "console.log('Seed completed successfully!');",
  `console.log('Seeding questions...');
  
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
          questionId: \`\${targetExamId}-Q\${q.id}\`,
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
      console.log(\`Seeded questions for \${targetExamId}\`);
    }

    console.log('Seed completed successfully!');`
);

fs.writeFileSync('src/scripts/seed.ts', code);
