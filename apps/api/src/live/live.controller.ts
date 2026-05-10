import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@offergo/db";
import { YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL } from "@offergo/ai";
import { consumeQuota } from "@offergo/billing";
import { env } from "@offergo/shared";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiAuthGuard } from "../auth/auth.guard";
import { throwIfQuotaExceeded } from "../billing/quota-http";
import { normalizeUploadedFileName } from "../resumes/resume-text-extraction";
import { uploadScreenshotFile } from "../resumes/resume-storage";
import { LiveSessionCoordinator } from "./live-session-coordinator.service";
import { LiveSessionService } from "./live-session.service";

const createSessionSchema = z.object({
  deviceId: z.string().min(1).default("windows-overlay-client"),
  sourceProcessId: z.coerce.number().int().default(0),
  micDeviceId: z.string().default("default"),
  subjectTag: z.string().default("general"),
  audioCaptureMode: z
    .enum(["device", "process", "micOnly"])
    .optional()
    .default("device"),
  answerLength: z.enum(["short", "detailed"]).optional().default("short"),
  assistanceMode: z
    .enum(["default", "liveCoding"])
    .optional()
    .default("default"),
  answerProvider: z.enum(["yandex", "gemini"]).optional().default("yandex"),
});

const screenshotBodySchema = z.object({
  answerLength: z.enum(["short", "detailed"]).optional(),
  assistanceMode: z.enum(["default", "liveCoding"]).optional(),
  answerProvider: z.enum(["yandex", "gemini"]).optional(),
});

const supportedScreenshotMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

@Controller()
export class LiveController {
  constructor(
    @Inject(LiveSessionService)
    private readonly liveSessionService: LiveSessionService,
    @Inject(LiveSessionCoordinator)
    private readonly liveSessionCoordinator: LiveSessionCoordinator,
  ) {}

  @Get("settings/bootstrap")
  getBootstrap() {
    return {
      websocketPath: env.LIVE_WEBSOCKET_PATH,
      retentionDays: 30,
      screenshotMaxMb: env.LIVE_SCREENSHOT_MAX_MB,
      models: {
        live: env.GEMINI_LIVE_MODEL,
        generate: env.GEMINI_MODEL_TEXT,
        geminiText: env.GEMINI_MODEL_TEXT,
        yandexText: env.YANDEX_MODEL_TEXT || YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL,
      },
      answerProviders: [
        {
          id: "yandex",
          label: "Yandex GPT",
          note: "Текстовые и live-подсказки. Скриншоты в этой версии анализирует Gemini.",
        },
        {
          id: "gemini",
          label: "Gemini",
          note: "Текстовые, live-подсказки и анализ скриншотов через Gemini.",
        },
      ],
    };
  }

  @Post("sessions")
  @UseGuards(ApiAuthGuard)
  async createSession(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = createSessionSchema.parse(body);
    const session = await this.liveSessionService.create(user.id, parsed);

    return {
      id: session.id,
      employeeId: user.id,
      deviceId: session.deviceId,
      sourceProcessId: session.sourceProcessId,
      micDeviceId: session.micDeviceId,
      subjectTag: session.subjectTag,
      audioCaptureMode: session.audioCaptureMode,
      answerLength: session.answerLength,
      answerProvider: session.answerProvider,
    };
  }

  @Post("sessions/:sessionId/screenshot")
  @UseGuards(ApiAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: env.LIVE_SCREENSHOT_MAX_MB * 1024 * 1024,
      },
    }),
  )
  async uploadScreenshot(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("Screenshot file is required.");
    }

    if (!supportedScreenshotMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        "Only PNG, JPEG and WebP screenshots are supported.",
      );
    }

    await this.liveSessionService.getOwnedSession(user.id, sessionId);
    const parsed = screenshotBodySchema.parse(body);
    try {
      await consumeQuota(user.id, "wpf_screenshot", 1, {
        sessionId,
      });
    } catch (error) {
      throwIfQuotaExceeded(error);
    }

    const uploaded = await uploadScreenshotFile({
      ownerId: user.id,
      fileName: normalizeUploadedFileName(file.originalname || "screenshot.png"),
      contentType: file.mimetype,
      body: file.buffer,
    });
    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const fileAsset = await prisma.fileAsset.create({
      data: {
        ownerId: user.id,
        bucket: uploaded.bucket,
        objectKey: uploaded.objectKey,
        mimeType: file.mimetype,
        size: file.size,
        purpose: "screenshot",
        checksum,
      },
    });
    const screenshot = await prisma.liveScreenshotArtifact.create({
      data: {
        sessionId,
        fileAssetId: fileAsset.id,
      },
    });
    const answer = await this.liveSessionCoordinator.answerFromScreenshot({
      sessionId,
      user,
      screenshot: {
        bytes: file.buffer,
        mimeType: file.mimetype,
      },
      answerLength: parsed.answerLength,
      assistanceMode: parsed.assistanceMode,
      answerProvider: parsed.answerProvider,
    });

    return {
      screenshotId: screenshot.id,
      answer: {
        id: answer.id,
        shortAnswer: answer.shortAnswer,
        details: answer.details,
        confidence: answer.confidence,
        sourceTurns: Array.isArray(answer.sourceTurns)
          ? answer.sourceTurns
          : [],
      },
    };
  }
}
