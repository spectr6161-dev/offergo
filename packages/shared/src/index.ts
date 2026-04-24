import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../../../");
const envPath = path.join(workspaceRoot, ".env");
const envExamplePath = path.join(workspaceRoot, ".env.example");

loadEnv({
  path: existsSync(envPath) ? envPath : envExamplePath,
});

export const appRoles = ["user", "admin", "support"] as const;
export type AppRole = (typeof appRoles)[number];

export const paymentStatuses = [
  "pending",
  "confirmed",
  "canceled",
  "chargebacked",
  "expired",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const entitlementStatuses = ["active", "expired", "revoked"] as const;
export type EntitlementStatus = (typeof entitlementStatuses)[number];

export const trainerMessageRoles = ["system", "assistant", "user"] as const;
export type TrainerMessageRole = (typeof trainerMessageRoles)[number];

export const plategaStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELED",
  "CHARGEBACK",
  "CHARGEBACKED",
]);

export const plategaCallbackSchema = z.object({
  id: z.string().uuid(),
  amount: z.number(),
  currency: z.string().min(1),
  status: plategaStatusSchema,
  paymentMethod: z.number().or(z.string()),
});

export const plategaTransactionStatusSchema = z
  .object({
    id: z.string().uuid(),
    status: plategaStatusSchema,
  })
  .passthrough();

export const createPaymentLinkResponseSchema = z.object({
  transactionId: z.string().uuid(),
  status: z.string(),
  url: z.string().url().optional(),
  redirect: z.string().url().optional(),
  expiresIn: z.string().optional(),
  rate: z.number().optional(),
  usdtRate: z.number().optional(),
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  API_PORT: z.coerce.number().default(3001),
  WORKER_PORT: z.coerce.number().default(3002),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:3001"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default(
      "postgresql://offergo:offergo@localhost:5434/offergo_app?schema=public",
    ),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16)
    .default("offergo-dev-secret-please-change"),
  AUTH_COOKIE_DOMAIN: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().default(86400),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z
    .string()
    .transform((value) => value === "true")
    .default(false),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().email().default("offergo-dev@example.com"),
  PLATEGA_BASE_URL: z.string().url().default("https://app.platega.io/"),
  PLATEGA_MERCHANT_ID: z.string().optional().default(""),
  PLATEGA_SECRET: z.string().optional().default(""),
  PLATEGA_SUCCESS_URL: z
    .string()
    .url()
    .default("http://localhost:3000/billing?status=success"),
  PLATEGA_FAIL_URL: z
    .string()
    .url()
    .default("http://localhost:3000/billing?status=fail"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  S3_SECRET_KEY: z.string().min(1).default("minioadmin"),
  S3_BUCKET: z.string().min(1).default("offergo-dev"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((value) => value === "true")
    .default(true),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL_TEXT: z.string().default("gemini-2.5-flash"),
  ENABLE_PLAYWRIGHT_AUTOMATION: z
    .string()
    .transform((value) => value === "true")
    .default(false),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  API_PORT: process.env.API_PORT,
  WORKER_PORT: process.env.WORKER_PORT,
  APP_URL: process.env.APP_URL,
  API_URL: process.env.API_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_AUTH_MAX_AGE_SECONDS: process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  PLATEGA_BASE_URL: process.env.PLATEGA_BASE_URL,
  PLATEGA_MERCHANT_ID: process.env.PLATEGA_MERCHANT_ID,
  PLATEGA_SECRET: process.env.PLATEGA_SECRET,
  PLATEGA_SUCCESS_URL: process.env.PLATEGA_SUCCESS_URL,
  PLATEGA_FAIL_URL: process.env.PLATEGA_FAIL_URL,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL_TEXT: process.env.GEMINI_MODEL_TEXT,
  ENABLE_PLAYWRIGHT_AUTOMATION: process.env.ENABLE_PLAYWRIGHT_AUTOMATION,
});

export * from "./logger";
