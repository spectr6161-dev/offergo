import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@offergo/shared";

const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadFile(options: {
  ownerId: string;
  purpose: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}) {
  const objectKey = `${options.ownerId}/${options.purpose}/${Date.now()}-${randomUUID()}-${sanitizeFileName(options.fileName)}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey,
      Body: options.body,
      ContentType: options.contentType,
    }),
  );

  return {
    bucket: env.S3_BUCKET,
    objectKey,
  };
}
