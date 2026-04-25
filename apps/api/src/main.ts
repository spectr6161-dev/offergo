import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { LoggerService } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";
import { json, urlencoded } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@offergo/auth/core";
import { createServerLogger, env } from "@offergo/shared";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./api-exception.filter";
import { mountDataAdmin } from "./data-admin";
import { enhanceOpenApiDocument } from "./docs/openapi";

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

function isAllowedOrigin(origin?: string) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  return env.NODE_ENV !== "production" && localDevOriginPattern.test(origin);
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
      "Универсальный базовый API для web, mobile, bot и worker-клиентов.",
    )
    .setVersion("1.0.0")
    .addServer(env.API_URL)
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Bearer",
        description: "Bearer-токен Better Auth для non-web клиентов.",
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

  await app.listen(env.API_PORT, "0.0.0.0");
  serverLogger.info(`[api] ready on ${env.API_URL}`);
  serverLogger.info(`[api] data admin ready on ${env.API_URL}${dataAdminPath}`);
}

void bootstrap().catch((error) => {
  serverLogger.error("[api] fatal", error);
  process.exit(1);
});
