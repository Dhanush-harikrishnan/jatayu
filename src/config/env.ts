import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    rekognitionRegion: process.env.AWS_REKOGNITION_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || '',
    dynamoDbTableName: process.env.DYNAMODB_TABLE_NAME || 'ProctoringEvents',
    sesSourceEmail: process.env.AWS_SES_SOURCE_EMAIL || ''
  },
  thresholds: {
    rekognitionConfidence: parseFloat(process.env.REKOGNITION_CONFIDENCE_THRESHOLD || '90.0'),
    isolationForest: parseFloat(process.env.ISOLATION_FOREST_THRESHOLD || '-0.5'),
    correlationWindowMs: parseInt(process.env.CORRELATION_WINDOW_MS || '5000', 10),
    facialOrientation: parseFloat(process.env.FACIAL_ORIENTATION_THRESHOLD || '25')
  }
};
