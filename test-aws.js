require('dotenv').config();
const { RekognitionClient, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { DynamoDBClient, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");

async function testAWSConnections() {
  console.log("🚀 Starting Validated AWS Connection Test...");

  try {
    // 1. Test Rekognition (Mumbai) using an authorized action
    const rekog = new RekognitionClient({ 
        region: "ap-south-1",
        credentials: {
            accessKeyId: "AKIASC4HV222ZWG6F3LQ",
            secretAccessKey: "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"
        }
    });

    // We send an empty image just to check if the 403 Forbidden error is gone
    try {
        await rekog.send(new DetectLabelsCommand({ Image: { Bytes: Buffer.alloc(1) } }));
    } catch (e) {
        if (e.name === "InvalidImageFormatException" || e.name === "InvalidParameterException") {
            console.log("✅ Rekognition: Connected (Auth Valid)!");
        } else {
            throw e;
        }
    }

    // 2. Test S3 (Hyderabad)
    // S3 and DynamoDB will pick up the credentials from .env via dotenv
    const s3 = new S3Client({ region: "ap-south-2" });
    await s3.send(new ListObjectsV2Command({ Bucket: "secureguard-evidence-2026-hyd", MaxKeys: 1 }));
    console.log("✅ S3 Bucket: Accessible!");

    // 3. Test DynamoDB (Hyderabad)
    const ddb = new DynamoDBClient({ region: "ap-south-2" });
    await ddb.send(new DescribeTableCommand({ TableName: "ProctoringEvents" }));
    console.log("✅ DynamoDB: Table Found!");

  } catch (err) {
    console.error("❌ Connection Failed:", err.message);
  }
}

testAWSConnections();
