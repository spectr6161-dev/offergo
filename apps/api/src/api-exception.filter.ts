import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@offergo/db";
import type { ServerLogger } from "@offergo/shared";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    statusCode: number;
    path: string;
    timestamp: string;
    details?: unknown;
    [key: string]: unknown;
  };
};

function getHttpExceptionPayload(exception: HttpException) {
  const response = exception.getResponse();

  if (!response || typeof response !== "object") {
    return {};
  }

  return response as Record<string, unknown>;
}

function getHttpExceptionMessage(exception: HttpException) {
  const response = exception.getResponse();

  if (typeof response === "string") {
    return response;
  }

  if (response && typeof response === "object" && "message" in response) {
    const message = (response as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return exception.message;
}

function isProviderError(exception: unknown): exception is Error {
  if (!(exception instanceof Error)) {
    return false;
  }

  return /gemini|telegram|provider|fetch failed|timeout|aborted/i.test(
    exception.message,
  );
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ServerLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "internal_error";
    let message = "Internal server error";
    let details: unknown;
    let extra: Record<string, unknown> = {};

    if (exception instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = "validation_error";
      message = "Invalid request payload";
      details = exception.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2025") {
        statusCode = HttpStatus.NOT_FOUND;
        code = "not_found";
        message = "Record not found";
      } else if (exception.code === "P2002") {
        statusCode = HttpStatus.CONFLICT;
        code = "unique_constraint";
        message = "Record already exists";
      } else {
        code = "database_error";
        message = "Database request failed";
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = getHttpExceptionPayload(exception);
      code =
        typeof payload.code === "string"
          ? payload.code
          : statusCode >= 500
            ? "http_error"
            : "request_error";
      message = getHttpExceptionMessage(exception);
      details = payload.details;
      const { code: _code, message: _message, details: _details, ...rest } =
        payload;
      extra = rest;
    } else if (isProviderError(exception)) {
      statusCode = HttpStatus.BAD_GATEWAY;
      code = "provider_error";
      message =
        exception instanceof Error ? exception.message : "Provider failed";
    }

    if (statusCode >= 500) {
      this.logger.error("[api] request failed", {
        path: request.url,
        method: request.method,
        code,
        exception,
      });
    } else {
      this.logger.warn("[api] request rejected", {
        path: request.url,
        method: request.method,
        code,
        statusCode,
      });
    }

    const body: ErrorResponse = {
      error: {
        code,
        message,
        statusCode,
        path: request.url,
        timestamp,
        ...extra,
        ...(details ? { details } : {}),
      },
    };

    response.status(statusCode).json(body);
  }
}
