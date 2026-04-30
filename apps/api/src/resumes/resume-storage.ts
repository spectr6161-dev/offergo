import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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
let bucketReady: Promise<void> | null = null;

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = s3
      .send(
        new HeadBucketCommand({
          Bucket: env.S3_BUCKET,
        }),
      )
      .then(() => undefined)
      .catch(async () => {
        await s3.send(
          new CreateBucketCommand({
            Bucket: env.S3_BUCKET,
          }),
        );
      });
  }

  return bucketReady;
}

export async function uploadResumeSourceFile(options: {
  ownerId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}) {
  const safeFileName = sanitizeFileName(options.fileName) || "resume";
  const objectKey = `${options.ownerId}/resume_source/${Date.now()}-${randomUUID()}-${safeFileName}`;

  await ensureBucket();

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

export async function getResumeSourceFile(objectKey: string) {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey,
    }),
  );

  if (!result.Body) {
    throw new Error("Source file body is empty.");
  }

  return {
    body: result.Body as Readable,
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
}

export async function headResumeSourceFile(objectKey: string) {
  const result = await s3.send(
    new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey,
    }),
  );

  return {
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
}
