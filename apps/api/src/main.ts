import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { LoggerService } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { json, urlencoded } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@offergo/auth/core";
import { createServerLogger, env } from "@offergo/shared";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./api-exception.filter";
import { mountDataAdmin } from "./data-admin";
import { enhanceOpenApiDocument } from "./docs/openapi";
import { LiveWebSocketGateway } from "./live/live-websocket.gateway";

const serverLogger = createServerLogger({
  service: "api",
  resetFile: true,
  captureConsole: true,
});

const allowedOrigins = new Set([
  new URL(env.APP_URL).origin,
  new URL(env.API_URL).origin,
]);
const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowedExtensionOrigins = new Set(
  env.LEGAL_ALLOWED_EXTENSION_IDS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((id) => `chrome-extension://${id}`),
);
const browserExtensionOriginPattern = /^chrome-extension:\/\/[a-z]{32}$/;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function applySecurityHeaders(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(), payment=()",
  );
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; frame-ancestors 'self';",
  );

  if (env.APP_ENV === "production") {
    response.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  next();
}

function getRateLimitRule(path: string) {
  if (/^\/api\/auth\//.test(path) || /^\/api\/v1\/auth\//.test(path)) {
    return { windowMs: 60_000, max: 30, name: "auth" };
  }

  if (/^\/api\/v1\/billing\/checkout/.test(path)) {
    return { windowMs: 60_000, max: 10, name: "billing" };
  }

  if (/\/upload|\/photo|\/screenshot/.test(path)) {
    return { windowMs: 60_000, max: 60, name: "upload" };
  }

  if (/\/ai\/|\/generate|\/resume-analysis|\/individual-responses/.test(path)) {
    return { windowMs: 60_000, max: 40, name: "ai" };
  }

  return null;
}

function applyRateLimit(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const rule = getRateLimitRule(request.path);

  if (!rule) {
    next();
    return;
  }

  const now = Date.now();
  const ip = request.ip || request.socket.remoteAddress || "unknown";
  const key = `${rule.name}:${ip}`;
  const current = rateLimitBuckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + rule.windowMs };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
  response.setHeader("RateLimit-Limit", String(rule.max));
  response.setHeader("RateLimit-Remaining", String(Math.max(0, rule.max - bucket.count)));
  response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > rule.max) {
    response.status(429).json({
      error: {
        code: "rate_limited",
        message: "Слишком много запросов. Повторите попытку позже.",
        statusCode: 429,
      },
    });
    return;
  }

  next();
}

function isAllowedOrigin(origin?: string) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  if (allowedExtensionOrigins.has(origin)) {
    return true;
  }

  return (
    env.NODE_ENV !== "production" &&
    (localDevOriginPattern.test(origin) ||
      (allowedExtensionOrigins.size === 0 &&
        browserExtensionOriginPattern.test(origin)))
  );
}

const nestLogger: LoggerService = {
  log: (message: unknown, ...optionalParams: unknown[]) => {
    serverLogger.info(message, ...optionalParams);
  },
  error: (message: unknown, ...optionalParams: unknown[]) => {
    serverLogger.error(message, ...optionalParams);
  },
  warn: (message: unknown, ...optionalParams: unknown[]) => {
    serverLogger.warn(message, ...optionalParams);
  },
  debug: (message: unknown, ...optionalParams: unknown[]) => {
    serverLogger.debug(message, ...optionalParams);
  },
  verbose: (message: unknown, ...optionalParams: unknown[]) => {
    serverLogger.debug(message, ...optionalParams);
  },
  fatal: (message: unknown, ...optionalParams: unknown[]) => {
    serverLogger.error(message, ...optionalParams);
  },
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: nestLogger,
  });

  app.use(applySecurityHeaders);
  app.use(applyRateLimit);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    exposedHeaders: ["set-auth-token", "set-auth-jwt"],
  });

  const dataAdminPath = await mountDataAdmin(app);
  app.useGlobalFilters(new ApiExceptionFilter(serverLogger));
  app.use("/api/auth", toNodeHandler(auth));
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true }));
  app.setGlobalPrefix("api/v1");

  const openApiConfig = new DocumentBuilder()
    .setTitle("API платформы offerGO")
    .setDescription(
      "Универсальный API для web, native mobile, desktop, browser extension и worker-клиентов.",
    )
    .setVersion("1.0.0")
    .addServer(env.API_URL)
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Bearer",
        description: "Bearer-токен Better Auth для native mobile и non-web клиентов.",
      },
      "bearer",
    )
    .addCookieAuth(
      "offergo_session_token",
      {
        type: "apiKey",
        in: "cookie",
        name: "offergo_session_token",
        description: "Cookie браузерной сессии Better Auth.",
      },
      "session",
    )
    .build();

  const document: OpenAPIObject = SwaggerModule.createDocument(
    app,
    openApiConfig,
  );
  enhanceOpenApiDocument(document);

  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs-json",
    customSiteTitle: "API платформы offerGO",
    swaggerOptions: {
      displayRequestDuration: true,
      persistAuthorization: true,
      withCredentials: true,
      requestInterceptor: (request: Record<string, unknown>) => {
        request.credentials = "include";
        return request;
      },
    },
  });

  app.get(LiveWebSocketGateway).attach(app.getHttpServer());

  await app.listen(env.API_PORT, "0.0.0.0");
  serverLogger.info(`[api] ready on ${env.API_URL}`);
  serverLogger.info(`[api] data admin ready on ${env.API_URL}${dataAdminPath}`);
}

void bootstrap().catch((error) => {
  serverLogger.error("[api] fatal", error);
  process.exit(1);
});
