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
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
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
  LEGAL_OPERATOR_NAME: z.string().optional().default("ООО/ИП OfferGO"),
  LEGAL_OPERATOR_INN: z.string().optional().default("000000000000"),
  LEGAL_OPERATOR_OGRNIP_OR_OGRN: z.string().optional().default("0000000000000"),
  LEGAL_OPERATOR_ADDRESS: z.string().optional().default("Российская Федерация"),
  LEGAL_OPERATOR_EMAIL: z.string().email().optional().default("privacy@offergo.local"),
  LEGAL_RESPONSIBLE_PERSON: z.string().optional().default("Ответственный за обработку персональных данных"),
  LEGAL_DATA_LOCATION: z.string().optional().default("RU"),
  LEGAL_AI_PUBLIC_PROVIDER: z.enum(["yandex"]).default("yandex"),
  LEGAL_FISCALIZATION_CONFIRMED: z
    .string()
    .transform((value) => value === "true")
    .default(false),
  LEGAL_ALLOWED_EXTENSION_IDS: z.string().optional().default(""),
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
  GEMINI_MODEL_TEXT: z.string().default("gemini-3.1-flash-lite-preview"),
  GEMINI_LIVE_MODEL: z.string().default("gemini-3.1-flash-live-preview"),
  GEMINI_LIVE_THINKING_LEVEL: z
    .enum(["minimal", "low", "medium", "high"])
    .default("minimal"),
  GEMINI_GENERATE_FALLBACK_MODELS: z
    .string()
    .default("gemini-3.1-flash-lite-preview,gemini-2.5-flash,gemini-3.1-pro-preview"),
  LIVE_WEBSOCKET_PATH: z.string().default("/ws/live"),
  LIVE_SCREENSHOT_MAX_MB: z.coerce.number().default(6),
  DESKTOP_SESSION_TTL_DAYS: z.coerce.number().default(30),
  DESKTOP_AUTH_REQUEST_TTL_MINUTES: z.coerce.number().default(10),
  RESUME_ANALYSIS_MODEL_ID: z.string().optional().default(""),
  YANDEX_AI_STUDIO_API_KEY: z.string().optional().default(""),
  YANDEX_AI_STUDIO_IAM_TOKEN: z.string().optional().default(""),
  YANDEX_AI_STUDIO_FOLDER_ID: z.string().optional().default(""),
  YANDEX_AI_STUDIO_BASE_URL: z
    .string()
    .url()
    .default("https://ai.api.cloud.yandex.net/v1"),
  YANDEX_MODEL_TEXT: z.string().optional().default(""),
  YANDEX_CLOUD_FOLDER: z.string().optional().default(""),
  YANDEX_CLOUD_MODEL: z.string().optional().default(""),
  SEED_ADMIN_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().optional(),
  ),
  SEED_ADMIN_PASSWORD: z.string().optional().default(""),
  RUN_DEMO_SEED: z
    .string()
    .transform((value) => value === "true")
    .default(false),
  ENABLE_PLAYWRIGHT_AUTOMATION: z
    .string()
    .transform((value) => value === "true")
    .default(false),
});

const parsedEnv = envSchema.parse({
  APP_ENV: process.env.APP_ENV,
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
  LEGAL_OPERATOR_NAME: process.env.LEGAL_OPERATOR_NAME,
  LEGAL_OPERATOR_INN: process.env.LEGAL_OPERATOR_INN,
  LEGAL_OPERATOR_OGRNIP_OR_OGRN: process.env.LEGAL_OPERATOR_OGRNIP_OR_OGRN,
  LEGAL_OPERATOR_ADDRESS: process.env.LEGAL_OPERATOR_ADDRESS,
  LEGAL_OPERATOR_EMAIL: process.env.LEGAL_OPERATOR_EMAIL,
  LEGAL_RESPONSIBLE_PERSON: process.env.LEGAL_RESPONSIBLE_PERSON,
  LEGAL_DATA_LOCATION: process.env.LEGAL_DATA_LOCATION,
  LEGAL_AI_PUBLIC_PROVIDER: process.env.LEGAL_AI_PUBLIC_PROVIDER,
  LEGAL_FISCALIZATION_CONFIRMED:
    process.env.LEGAL_FISCALIZATION_CONFIRMED,
  LEGAL_ALLOWED_EXTENSION_IDS: process.env.LEGAL_ALLOWED_EXTENSION_IDS,
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
  GEMINI_LIVE_MODEL: process.env.GEMINI_LIVE_MODEL,
  GEMINI_LIVE_THINKING_LEVEL: process.env.GEMINI_LIVE_THINKING_LEVEL,
  GEMINI_GENERATE_FALLBACK_MODELS: process.env.GEMINI_GENERATE_FALLBACK_MODELS,
  LIVE_WEBSOCKET_PATH: process.env.LIVE_WEBSOCKET_PATH,
  LIVE_SCREENSHOT_MAX_MB: process.env.LIVE_SCREENSHOT_MAX_MB,
  DESKTOP_SESSION_TTL_DAYS: process.env.DESKTOP_SESSION_TTL_DAYS,
  DESKTOP_AUTH_REQUEST_TTL_MINUTES:
    process.env.DESKTOP_AUTH_REQUEST_TTL_MINUTES,
  RESUME_ANALYSIS_MODEL_ID: process.env.RESUME_ANALYSIS_MODEL_ID,
  YANDEX_AI_STUDIO_API_KEY: process.env.YANDEX_AI_STUDIO_API_KEY,
  YANDEX_AI_STUDIO_IAM_TOKEN: process.env.YANDEX_AI_STUDIO_IAM_TOKEN,
  YANDEX_AI_STUDIO_FOLDER_ID: process.env.YANDEX_AI_STUDIO_FOLDER_ID,
  YANDEX_AI_STUDIO_BASE_URL: process.env.YANDEX_AI_STUDIO_BASE_URL,
  YANDEX_MODEL_TEXT: process.env.YANDEX_MODEL_TEXT,
  YANDEX_CLOUD_FOLDER: process.env.YANDEX_CLOUD_FOLDER,
  YANDEX_CLOUD_MODEL: process.env.YANDEX_CLOUD_MODEL,
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
  RUN_DEMO_SEED: process.env.RUN_DEMO_SEED,
  ENABLE_PLAYWRIGHT_AUTOMATION: process.env.ENABLE_PLAYWRIGHT_AUTOMATION,
});

const developmentAuthSecrets = new Set([
  "offergo-dev-secret-please-change",
  "replace-with-a-long-random-string",
]);

function isDefaultDatabaseUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.username === "offergo" &&
      url.password === "offergo" &&
      url.pathname.includes("offergo_app")
    );
  } catch {
    return false;
  }
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function validateProductionEnv(config: typeof parsedEnv) {
  if (
    config.APP_ENV !== "production" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  ) {
    return;
  }

  const errors: string[] = [];
  const defaultLegalValues = new Set([
    "ООО/ИП OfferGO",
    "000000000000",
    "0000000000000",
    "Российская Федерация",
    "privacy@offergo.local",
    "Ответственный за обработку персональных данных",
  ]);
  const legalValues = [
    config.LEGAL_OPERATOR_NAME,
    config.LEGAL_OPERATOR_INN,
    config.LEGAL_OPERATOR_OGRNIP_OR_OGRN,
    config.LEGAL_OPERATOR_ADDRESS,
    config.LEGAL_OPERATOR_EMAIL,
    config.LEGAL_RESPONSIBLE_PERSON,
  ];

  if (
    developmentAuthSecrets.has(config.BETTER_AUTH_SECRET) ||
    config.BETTER_AUTH_SECRET.length < 32
  ) {
    errors.push(
      "BETTER_AUTH_SECRET must be a non-default production secret with at least 32 characters.",
    );
  }

  if (isDefaultDatabaseUrl(config.DATABASE_URL)) {
    errors.push(
      "DATABASE_URL must not use the default offergo/offergo development credentials in production.",
    );
  }

  if (
    !hasValue(config.PLATEGA_MERCHANT_ID) ||
    !hasValue(config.PLATEGA_SECRET)
  ) {
    errors.push(
      "PLATEGA_MERCHANT_ID and PLATEGA_SECRET are required in production.",
    );
  }

  if (new URL(config.APP_URL).protocol !== "https:") {
    errors.push("APP_URL must use HTTPS in production.");
  }

  if (new URL(config.API_URL).protocol !== "https:") {
    errors.push("API_URL must use HTTPS in production.");
  }

  if (config.LEGAL_DATA_LOCATION !== "RU") {
    errors.push("LEGAL_DATA_LOCATION must be RU in production.");
  }

  if (
    legalValues.some(
      (value) => !hasValue(value) || defaultLegalValues.has(value.trim()),
    )
  ) {
    errors.push(
      "LEGAL_* operator details must be real non-placeholder values in production.",
    );
  }

  if (!config.LEGAL_FISCALIZATION_CONFIRMED) {
    errors.push(
      "LEGAL_FISCALIZATION_CONFIRMED=true is required before production checkout.",
    );
  }

  if (
    hasValue(config.GOOGLE_CLIENT_ID) !== hasValue(config.GOOGLE_CLIENT_SECRET)
  ) {
    errors.push(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.",
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid production environment configuration:\n- ${errors.join("\n- ")}`,
    );
  }
}

validateProductionEnv(parsedEnv);

export const env = parsedEnv;

export * from "./logger";
export * from "./resume-builder";
