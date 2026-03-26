import { RekognitionClient, DetectFacesCommand, DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
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

  detectFaces: async (imageBytes: Uint8Array) => {
    const command = new DetectFacesCommand({
      Image: { Bytes: imageBytes },
    });
    return rekognitionClient.send(command);
  },

  detectLabels: async (imageBytes: Uint8Array) => {
    const command = new DetectLabelsCommand({
      Image: { Bytes: imageBytes },
      MinConfidence: config.thresholds.rekognitionConfidence,
    });
    return rekognitionClient.send(command);
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

  logViolationEvent: async (sessionId: string, timestamp: string, violationType: string, s3Key: string) => {
    const command = new PutItemCommand({
      TableName: config.aws.dynamoDbTableName,
      Item: {
        SessionId: { S: sessionId },
        'EventTime#ViolationType': { S: `${timestamp}#${violationType}` },
        EventTime: { S: timestamp },
        ViolationType: { S: violationType },
        EvidenceKey: { S: s3Key },
      },
    });
    return dynamoClient.send(command);
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
};
