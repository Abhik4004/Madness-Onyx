import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getNATS } from "../nats/client.js";

export const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

console.log("[s3] Initializing S3 Client:", {
  region: process.env.AWS_REGION || "us-east-1",
  bucket: BUCKET_NAME,
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
});

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function logEvent(type, metadata) {
  try {
    const { nc, sc } = getNATS();
    const payload = JSON.stringify({
      event: type,
      timestamp: new Date().toISOString(),
      ...metadata
    });
    await nc.publish("SYSTEM_LOGS", sc.encode(payload));
  } catch (err) {
    console.warn("[s3-logs] Failed to publish NATS log:", err.message);
  }
}

export async function uploadToS3(key, body, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  const res = await s3Client.send(command);
  await logEvent("FILE_UPLOAD", { s3_key: key, content_type: contentType });
  return res;
}

export async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: 'attachment',
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  await logEvent("FILE_DOWNLOAD_GENERATED", { s3_key: key });
  return url;
}
