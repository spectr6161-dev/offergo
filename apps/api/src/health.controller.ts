import { Controller, Get, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { prisma } from "@offergo/db";
import { getQueueConnection } from "@offergo/queue";
import { env } from "@offergo/shared";
import { HealthResponseDto } from "./docs/swagger.models";

type DependencyCheck = {
  ok: boolean;
  error?: string;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(new Error(`Health check timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function checkDb(): Promise<DependencyCheck> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 5_000);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "DB check failed",
    };
  }
}

async function checkRedis(): Promise<DependencyCheck> {
  try {
    await withTimeout(getQueueConnection().ping(), 5_000);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Redis check failed",
    };
  }
}

@ApiTags("platform")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({
    summary: "Проверка доступности API",
  })
  @ApiOkResponse({
    description: "Health-check платформенного API.",
    type: HealthResponseDto,
  })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
    const checks = {
      db,
      redis,
      timestamp: new Date().toISOString(),
    };
    const ok = db.ok && redis.ok;

    if (!ok) {
      response.status(503);
    }

    return {
      ok,
      app: "offergo-api",
      authModes: ["session", "bearer", "jwt"],
      billingProvider: "platega",
      timestamp: checks.timestamp,
      apiUrl: env.API_URL,
      checks,
    };
  }
}
