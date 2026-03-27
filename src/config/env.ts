import dotenv from 'dotenv';
dotenv.config({ override: true });

const parseCsv = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) return fallback;
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
};

const defaultCorsOrigins = [
  'https://jatayu-lake.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
  cors: {
    allowedOrigins: parseCsv(process.env.CORS_ALLOWED_ORIGINS, defaultCorsOrigins),
  },
  aws: {
    region: process.env.AWS_REGION || 'ap-south-2', // S3 and DynamoDB in Hyderabad
    rekognitionRegion: process.env.AWS_REKOGNITION_REGION || 'ap-south-1', // Rekognition in Mumbai
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || '',
    dynamoDbTableName: process.env.DYNAMODB_TABLE_NAME || 'ProctoringEvents',
    sesSourceEmail: process.env.AWS_SES_SOURCE_EMAIL || ''
  },
  thresholds: {
    rekognitionConfidence: parseFloat(process.env.REKOGNITION_CONFIDENCE_THRESHOLD || '70.0'),
    isolationForest: parseFloat(process.env.ISOLATION_FOREST_THRESHOLD || '-0.5'),
    correlationWindowMs: parseInt(process.env.CORRELATION_WINDOW_MS || '5000', 10),
    facialOrientation: parseFloat(process.env.FACIAL_ORIENTATION_THRESHOLD || '20'),
    // Telemetry websocket frames can be frequent; rate-limit evidence uploads to keep costs bounded.
    evidenceUploadIntervalMs: parseInt(process.env.EVIDENCE_UPLOAD_INTERVAL_MS || '5000', 10),
  }
};
