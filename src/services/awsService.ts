import { RekognitionClient, DetectFacesCommand, DetectLabelsCommand, CreateFaceLivenessSessionCommand, GetFaceLivenessSessionResultsCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, PutItemCommand, ListTablesCommand, GetItemCommand, UpdateItemCommand, QueryCommand, BatchWriteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../config/env';
import { logger } from '../logger';

const awsConfig = {
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
};

const awsConfigRekognition = {
  region: config.aws.rekognitionRegion,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
};

export const rekognitionClient = new RekognitionClient(awsConfigRekognition);
export const s3Client = new S3Client(awsConfig);
export const dynamoClient = new DynamoDBClient(awsConfig);
export const sesClient = new SESClient(awsConfig);

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export const awsService = {
  checkDatabaseConnection: async (): Promise<boolean> => {
    try {
      // List tables to check if the connection to DynamoDB is successful
      const command = new ListTablesCommand({ Limit: 1 });
      await dynamoClient.send(command);
      return true;
    } catch (err) {
      logger.error('Database connection check failed:', err);
      return false;
    }
  },

  getUserByEmail: async (email: string) => {
    try {
      const command = new GetItemCommand({
        TableName: 'SecureGuardUsers',
        Key: { email: { S: email } }
      });
      const result = await dynamoClient.send(command);
      if (!result.Item) return null;
      return unmarshall(result.Item) as any;
    } catch (err) {
      logger.error('Failed to get user:', err);
      return null;
    }
  },

  // ============================================
  // EXAM CRUD OPERATIONS
  // ============================================

  createExam: async (examData: any) => {
    try {
      if (!examData.examId) {
        throw new Error('examId is required for creating an exam');
      }
      
      const timestamp = new Date().toISOString();
      const enabledStatus = String(examData.enabled !== undefined ? examData.enabled : true);
      const item = {
        ...examData,
        enabledStatus,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const command = new PutItemCommand({
        TableName: 'SecureGuardExams',
        Item: marshall(item, { removeUndefinedValues: true })
      });
      await dynamoClient.send(command);
      return item;
    } catch (error) {
      logger.error('Error creating exam in DynamoDB', error);
      throw error;
    }
  },

  getExam: async (examId: string) => {
    try {
      const command = new GetItemCommand({
        TableName: 'SecureGuardExams',
        Key: marshall({ examId })
      });
      const result = await dynamoClient.send(command);
      if (!result.Item) return null;
      return unmarshall(result.Item);
    } catch (error) {
      logger.error(`Error fetching exam ${examId}`, error);
      throw error;
    }
  },

  updateExam: async (examId: string, updates: any) => {
    try {
      // First fetch the existing exam to merge
      const existingExam = await awsService.getExam(examId);
      if (!existingExam) throw new Error('Exam not found');

      const enabledStatus = updates.enabled !== undefined ? String(updates.enabled) : existingExam.enabledStatus;
      
      const updatedItem = {
        ...existingExam,
        ...updates,
        enabledStatus,
        updatedAt: new Date().toISOString()
      };

      const command = new PutItemCommand({
        TableName: 'SecureGuardExams',
        Item: marshall(updatedItem, { removeUndefinedValues: true })
      });
      await dynamoClient.send(command);
      return updatedItem;
    } catch (error) {
      logger.error(`Error updating exam ${examId}`, error);
      throw error;
    }
  },

  deleteExam: async (examId: string) => {
    try {
      const { DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
      const command = new DeleteItemCommand({
        TableName: 'SecureGuardExams',
        Key: marshall({ examId })
      });
      await dynamoClient.send(command);
      return true;
    } catch (error) {
      logger.error(`Error deleting exam ${examId}`, error);
      throw error;
    }
  },

  listExams: async () => {
    try {
      const command = new ScanCommand({
        TableName: 'SecureGuardExams'
      });
      const result = await dynamoClient.send(command);
      return (result.Items || []).map((item) => unmarshall(item));
    } catch (error) {
      logger.error('Error listing all exams', error);
      throw error;
    }
  },

  listActiveExams: async () => {
    try {
      const command = new QueryCommand({
        TableName: 'SecureGuardExams',
        IndexName: 'EnabledStartTimeIndex',
        KeyConditionExpression: 'enabledStatus = :enabled',
        ExpressionAttributeValues: marshall({
          ':enabled': 'true'
        })
      });
      
      const result = await dynamoClient.send(command);
      const exams = (result.Items || []).map((item) => unmarshall(item));
      const now = new Date();

      // Filter by now constraints
      return exams.filter(e => {
        const start = new Date(e.startTime);
        const end = new Date(e.endTime);
        return now >= start && now <= end;
      });
    } catch (error) {
      logger.error('Error querying active exams', error);
      throw error;
    }
  },

  // ============================================
  // QUESTION CRUD OPERATIONS
  // ============================================

  createQuestion: async (questionData: any) => {
    try {
      const command = new PutItemCommand({
        TableName: 'SecureGuardQuestions',
        Item: marshall(questionData, { removeUndefinedValues: true })
      });
      await dynamoClient.send(command);
      return questionData;
    } catch (error) {
      logger.error('Error creating question in DynamoDB', error);
      throw error;
    }
  },

  batchCreateQuestions: async (questions: any[]) => {
    try {
      // DynamoDB batch write has a limit of 25 items per request.
      const BATCH_SIZE = 25;
      for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        const putRequests = batch.map(q => ({
          PutRequest: {
            Item: marshall(q, { removeUndefinedValues: true })
          }
        }));

        const command = new BatchWriteItemCommand({
          RequestItems: {
            'SecureGuardQuestions': putRequests
          }
        });
        await dynamoClient.send(command);
      }
      return questions;
    } catch (error) {
      logger.error('Error batch creating questions in DynamoDB', error);
      throw error;
    }
  },

  getQuestionsByExamId: async (examId: string) => {
    try {
      const command = new QueryCommand({
        TableName: 'SecureGuardQuestions',
        IndexName: 'ExamIdIndex',
        KeyConditionExpression: 'examId = :examId',
        ExpressionAttributeValues: marshall({
          ':examId': examId
        })
      });
      
      const result = await dynamoClient.send(command);
      return (result.Items || []).map((item) => unmarshall(item)).sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      logger.error(`Error querying questions for exam ${examId}`, error);
      throw error;
    }
  },

  updateQuestion: async (questionId: string, updates: any) => {
    try {
      const command = new GetItemCommand({
        TableName: 'SecureGuardQuestions',
        Key: marshall({ questionId })
      });
      const result = await dynamoClient.send(command);
      if (!result.Item) throw new Error('Question not found');
      
      const existingQuestion = unmarshall(result.Item);
      const updatedItem = {
        ...existingQuestion,
        ...updates
      };

      const putCommand = new PutItemCommand({
        TableName: 'SecureGuardQuestions',
        Item: marshall(updatedItem, { removeUndefinedValues: true })
      });
      await dynamoClient.send(putCommand);
      return updatedItem;
    } catch (error) {
      logger.error(`Error updating question ${questionId}`, error);
      throw error;
    }
  },

  deleteQuestion: async (questionId: string) => {
    try {
      const { DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
      const command = new DeleteItemCommand({
        TableName: 'SecureGuardQuestions',
        Key: marshall({ questionId })
      });
      await dynamoClient.send(command);
      return true;
    } catch (error) {
      logger.error(`Error deleting question ${questionId}`, error);
      throw error;
    }
  },

  // ============================================
  // SUBMISSION CRUD OPERATIONS
  // ============================================

  createSubmission: async (submissionData: any) => {
    try {
      const command = new PutItemCommand({
        TableName: 'SecureGuardSubmissions',
        Item: marshall(submissionData, { removeUndefinedValues: true })
      });
      await dynamoClient.send(command);
      return submissionData;
    } catch (error) {
      logger.error('Error creating submission in DynamoDB', error);
      throw error;
    }
  },

  detectFaces: async (imageBytes: Uint8Array) => {
    const command = new DetectFacesCommand({
      Image: { Bytes: imageBytes },
    });
    return rekognitionClient.send(command);
  },

  detectLabels: async (imageBytes: Uint8Array) => {
    const command = new DetectLabelsCommand({
      Image: { Bytes: imageBytes },
      MinConfidence: 50, // Temporarily lower to 50 internally to see more data in logs
    });
    const res = await rekognitionClient.send(command);
    if (res.Labels && res.Labels.length > 0) {
      logger.info(`[Rekognition] Detected labels: ${res.Labels.map(l => `${l.Name}(${l.Confidence?.toFixed(1)}%)`).join(', ')}`);
    }
    // Still filter by the configured threshold for the actual result
    const threshold = config.thresholds.rekognitionConfidence || 80;
    return {
        ...res,
        Labels: res.Labels?.filter(l => (l.Confidence ?? 0) >= threshold)
    };
  },

  uploadEvidenceToS3: async (key: string, base64Data: string) => {
    const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const command = new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
    });
    await s3Client.send(command);
    return `s3://${config.aws.s3Bucket}/${key}`;
  },

  generatePresignedUrl: async (s3Key: string): Promise<string> => {
    const command = new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: s3Key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  },

  // Used by the admin dashboard to render "live proofs" from S3 without making the bucket public.
  generateGetPresignedUrl: async (s3Key: string, expiresInSeconds: number = 3600): Promise<string> => {
    const command = new GetObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: s3Key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  },

  getEvidenceObjectBytes: async (s3Key: string): Promise<Buffer> => {
    const command = new GetObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: s3Key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
      throw new Error(`No S3 object body for key: ${s3Key}`);
    }

    const body = response.Body as any;
    if (typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    }

    // Fallback for stream-like bodies.
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  },

  detectLabelsFromS3: async (s3Key: string) => {
    const command = new DetectLabelsCommand({
      Image: {
        S3Object: {
          Bucket: config.aws.s3Bucket,
          Name: s3Key,
        },
      },
      MaxLabels: 10,
      MinConfidence: config.thresholds.rekognitionConfidence,
    });
    return await rekognitionClient.send(command);
  },

  detectFacesFromS3: async (s3Key: string) => {
    const command = new DetectFacesCommand({
      Image: {
        S3Object: {
          Bucket: config.aws.s3Bucket,
          Name: s3Key,
        },
      },
      Attributes: ['ALL'],
    });
    return await rekognitionClient.send(command);
  },

  createFaceLivenessSession: async (): Promise<string> => {
    try {
      const command = new CreateFaceLivenessSessionCommand({});
      const response = await rekognitionClient.send(command);
      return response.SessionId!;
    } catch (err) {
      logger.error('Failed to create face liveness session', err);
      throw err;
    }
  },

  sendPdfReportEmail: async (toAddress: string, pdfBuffer: Buffer, subject: string, bodyText: string): Promise<void> => {
    try {
      const boundary = "NextPart_" + Date.now().toString(16);
      let rawMessage =
        `From: ${config.aws.sesSourceEmail}\n` +
        `To: ${toAddress}\n` +
        `Subject: ${subject}\n` +
        `MIME-Version: 1.0\n` +
        `Content-Type: multipart/mixed; boundary="${boundary}"\n\n` +
        `--${boundary}\n` +
        `Content-Type: text/plain; charset=UTF-8\n\n` +
        `${bodyText}\n\n` +
        `--${boundary}\n` +
        `Content-Type: application/pdf; name="report.pdf"\n` +
        `Content-Description: report.pdf\n` +
        `Content-Disposition: attachment; filename="report.pdf"\n` +
        `Content-Transfer-Encoding: base64\n\n` +
        `${pdfBuffer.toString('base64')}\n\n` +
        `--${boundary}--`;

      const command = new SendRawEmailCommand({
        RawMessage: { Data: Buffer.from(rawMessage) }
      });
      await sesClient.send(command);
    } catch (err) {
      logger.error('Failed to send PDF report email:', err);
      throw err;
    }
  },

  getFaceLivenessSessionResult: async (sessionId: string): Promise<number | undefined> => {
    try {
      const command = new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId });
      const response = await rekognitionClient.send(command);
      return response.Confidence;
    } catch (err) {
      logger.error('Failed to get face liveness session result', err);
      throw err;
    }
  },

  logViolationEvent: async (
    sessionId: string,
    timestamp: string,
    violationType: string,
    s3Key: string,
    metadata?: any,
    context?: { userId?: string; studentName?: string; examId?: string }
  ) => {
    const uniqueId = `${sessionId}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    const item: any = {
      id: { S: uniqueId }, // The actual Partition Key found in DynamoDB
      SessionId: { S: sessionId },
      EventTime: { S: timestamp },
      ViolationType: { S: violationType },
      EvidenceKey: { S: s3Key },
    };
    if (metadata) {
      item.Metadata = { S: JSON.stringify(metadata) };
    }
    if (context?.userId) item.UserId = { S: context.userId };
    if (context?.studentName) item.StudentName = { S: context.studentName };
    if (context?.examId) item.ExamId = { S: context.examId };

    const command = new PutItemCommand({
      TableName: config.aws.dynamoDbTableName,
      Item: item,
    });
    return dynamoClient.send(command);
  },

  getViolationsBySessionId: async (sessionId: string, limit: number = 200) => {
    const command = new QueryCommand({
      TableName: config.aws.dynamoDbTableName,
      KeyConditionExpression: '#sid = :sid',
      ExpressionAttributeNames: { '#sid': 'SessionId' },
      ExpressionAttributeValues: { ':sid': { S: sessionId } },
      ScanIndexForward: false,
      Limit: limit,
    });

    const result = await dynamoClient.send(command);
    return (result.Items || []).map((item: any) => {
      let parsedMetadata: any = undefined;
      try {
        parsedMetadata = item.Metadata?.S ? JSON.parse(item.Metadata.S) : undefined;
      } catch {
        parsedMetadata = undefined;
      }

      return {
        sessionId: item.SessionId?.S,
        timestamp: item.EventTime?.S,
        violationType: item.ViolationType?.S,
        evidenceKey: item.EvidenceKey?.S,
        metadata: parsedMetadata,
      };
    });
  },

  sendMagicLinkEmail: async (toEmail: string, link: string) => {
    const command = new SendEmailCommand({
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Body: {
          Text: { Data: `Your SecureGuard Pro mobile pairing link: ${link}` },
          Html: { Data: `Click <a href="${link}">here</a> to pair your secondary camera.` },
        },
        Subject: { Data: 'SecureGuard Pro - Mobile Pairing Link' },
      },
      Source: config.aws.sesSourceEmail,
    });
    
    try {
        await sesClient.send(command);
        logger.info(`Magic link email sent successfully to ${toEmail}`);
    } catch (err) {
        logger.error(`Failed to send magic link email:`, err);
        throw err;
    }
  },

  sendAdminNotificationEmail: async (toEmail: string, body: string) => {
    const command = new SendEmailCommand({
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Body: {
          Text: { Data: body },
          Html: { Data: `<pre style="font-family:Arial,sans-serif; white-space:pre-wrap">${body}</pre>` },
        },
        Subject: { Data: 'SecureGuard Pro - Exam Notification' },
      },
      Source: config.aws.sesSourceEmail,
    });

    try {
      await sesClient.send(command);
      logger.info(`Admin notification email sent to ${toEmail}`);
    } catch (err) {
      logger.error('Failed to send admin notification email:', err);
      throw err;
    }
  },

  saveUserOTP: async (email: string, otp: string, expiry: string) => {
    const command = new UpdateItemCommand({
      TableName: 'SecureGuardUsers',
      Key: { email: { S: email } },
      UpdateExpression: 'SET otp = :otp, otpExpiry = :expiry',
      ExpressionAttributeValues: {
        ':otp': { S: otp },
        ':expiry': { S: expiry }
      }
    });
    return dynamoClient.send(command);
  },

  clearUserOTP: async (email: string) => {
    const command = new UpdateItemCommand({
      TableName: 'SecureGuardUsers',
      Key: { email: { S: email } },
      UpdateExpression: 'REMOVE otp, otpExpiry',
    });
    return dynamoClient.send(command);
  },

  sendOTPEmail: async (toEmail: string, otp: string) => {
    const command = new SendEmailCommand({
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Body: {
          Text: { Data: `Your SecureGuard Pro admin login verification code is: ${otp}` },
          Html: { Data: `<h1>Admin Login Verification</h1><p>Your verification code is: <strong>${otp}</strong></p><p>This code will expire in 5 minutes.</p>` },
        },
        Subject: { Data: 'SecureGuard Pro - Admin Login Code' },
      },
      Source: config.aws.sesSourceEmail,
    });
    
    try {
        await sesClient.send(command);
        logger.info(`OTP email sent successfully to ${toEmail}`);
    } catch (err) {
        logger.error(`Failed to send OTP email:`, err);
        throw err;
    }
  },

deleteSessionEvidence: async (sessionId: string, examId?: string): Promise<number> => {        
    let totalDeleted = 0;
    
    // We wipe out TWO potential prefixes:
    // 1) The standard evidence directory
    // 2) The legacy / old exam route directory just to be absolutely sure
    const prefixes = [
      `evidence/${sessionId}/`,
      examId ? `exams/${examId}/${sessionId}/` : undefined
    ].filter(Boolean) as string[];

    for (const prefix of prefixes) {
      let continuationToken: string | undefined;

      do {
        const listCmd = new ListObjectsV2Command({
          Bucket: config.aws.s3Bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const listRes = await s3Client.send(listCmd);
        const objects = listRes.Contents || [];

        if (objects.length > 0) {
          const deleteCmd = new DeleteObjectsCommand({
            Bucket: config.aws.s3Bucket,
            Delete: {
              Objects: objects.map(obj => ({ Key: obj.Key! })),
              Quiet: true,
            },
          });
          await s3Client.send(deleteCmd);
          totalDeleted += objects.length;
        }

        continuationToken = listRes.NextContinuationToken;
      } while (continuationToken);
    }

    logger.info(`[deleteSessionEvidence] Deleted ${totalDeleted} S3 objects for session ${sessionId}`);
    return totalDeleted;
  },

  deleteSessionViolations: async (sessionId: string): Promise<number> => {
    // The table's partition key is 'id' (a unique random string per event),
    // NOT 'SessionId'. We must Scan with a filter to find matching items,
    // then delete each by its actual primary key ('id').
    let totalDeleted = 0;
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const scanCmd: any = {
        TableName: config.aws.dynamoDbTableName,
        FilterExpression: 'SessionId = :sid',
        ExpressionAttributeValues: { ':sid': { S: sessionId } },
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoClient.send(new ScanCommand(scanCmd));
      const items = result.Items || [];
      lastEvaluatedKey = result.LastEvaluatedKey;

      if (items.length === 0) continue;

      // BatchWriteItem can handle max 25 items per batch
      for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        const deleteRequests = batch.map((item: any) => ({
          DeleteRequest: {
            Key: {
              id: item.id, // The actual partition key
            },
          },
        }));

        const batchCmd = new BatchWriteItemCommand({
          RequestItems: {
            [config.aws.dynamoDbTableName]: deleteRequests,
          },
        });

        try {
          await dynamoClient.send(batchCmd);
          totalDeleted += batch.length;
        } catch (batchErr: any) {
          logger.error(`[deleteSessionViolations] Batch delete failed:`, batchErr?.message);
        }
      }
    } while (lastEvaluatedKey);

    logger.info(`[deleteSessionViolations] Deleted ${totalDeleted} DynamoDB items for session ${sessionId}`);
    return totalDeleted;
  },
};
