import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { prisma } from "@offergo/db";
import { auth } from "@offergo/auth/core";
import { requiredLegalConsentKinds } from "@offergo/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { DesktopAuthService } from "./desktop-auth.service";
import {
  LiveAiPromptService,
  WPF_LIVE_PROMPT_KEYS,
} from "./live-ai-prompt.service";

const browserStartSchema = z.object({
  deviceName: z.string().trim().min(1).max(160).default("Windows desktop app"),
});

const appLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().trim().min(1).max(160).default("Windows desktop app"),
});

const browserPollSchema = z.object({
  requestId: z.string().min(1),
  pollToken: z.string().min(1),
});

const browserApproveSchema = z.object({
  displayCode: z.string().min(4).max(16).optional(),
  code: z.string().min(4).max(16).optional(),
});

const extensionPollSchema = z.object({
  code: z.string().trim().min(4).max(16),
});

const promptSchema = z.object({
  prompt: z.string().max(10_000).optional(),
  answerProvider: z.enum(["yandex"]).optional(),
});

const requiredConsentKinds = requiredLegalConsentKinds;

function toEmployee(user: Pick<AuthenticatedAppUser, "id" | "email" | "name">) {
  return {
    employeeId: user.id,
    email: user.email,
    displayName: user.name || user.email,
  };
}

function getBearerToken(request: AuthenticatedRequest) {
  const header = request.headers.authorization;

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

async function assertUserHasAcceptedLegalDocuments(userId: string) {
  const documents = await prisma.legalDocumentVersion.findMany({
    where: {
      kind: {
        in: [...requiredConsentKinds],
      },
      active: true,
    },
    select: {
      id: true,
    },
  });

  if (documents.length !== requiredConsentKinds.length) {
    throw new ForbiddenException("Legal documents are not configured.");
  }

  const acceptedCount = await prisma.userConsentAcceptance.count({
    where: {
      userId,
      documentVersionId: {
        in: documents.map((document) => document.id),
      },
    },
  });

  if (acceptedCount !== documents.length) {
    throw new ForbiddenException(
      "Примите актуальные условия OfferGO в web-приложении.",
    );
  }
}

@Controller()
export class DesktopAuthController {
  constructor(
    @Inject(DesktopAuthService)
    private readonly desktopAuthService: DesktopAuthService,
    @Inject(LiveAiPromptService)
    private readonly liveAiPromptService: LiveAiPromptService,
  ) {}

  @Post("auth/app/login")
  async appLogin(@Body() body: unknown) {
    const parsed = appLoginSchema.parse(body);
    const result = await auth.api.signInEmail({
      body: {
        email: parsed.email,
        password: parsed.password,
        rememberMe: true,
      },
    });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);

    try {
      await assertUserHasAcceptedLegalDocuments(result.user.id);
    } catch (error) {
      await this.desktopAuthService.logout(result.token);
      throw error;
    }

    return {
      accessToken: result.token,
      expiresAt: expiresAt.toISOString(),
      employee: toEmployee(result.user),
    };
  }

  @Post("auth/app/browser/start")
  startBrowserLogin(@Body() body: unknown) {
    const parsed = browserStartSchema.parse(body);
    return this.desktopAuthService.startBrowserLogin(parsed.deviceName);
  }

  @Post("auth/app/browser/poll")
  pollBrowserLogin(@Body() body: unknown) {
    const parsed = browserPollSchema.parse(body);
    return this.desktopAuthService.pollBrowserLogin(
      parsed.requestId,
      parsed.pollToken,
    );
  }

  @Post("auth/app/browser/approve")
  @UseGuards(ApiAuthGuard)
  approveBrowserLogin(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = browserApproveSchema.parse(body);
    const displayCode = parsed.displayCode ?? parsed.code;

    if (!displayCode) {
      throw new BadRequestException("displayCode is required.");
    }

    return assertUserHasAcceptedLegalDocuments(user.id).then(() =>
      this.desktopAuthService.approveBrowserLogin(displayCode, user),
    );
  }

  @Post("auth/app/logout")
  @UseGuards(ApiAuthGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.desktopAuthService.logout(getBearerToken(request));
  }

  @Post("auth/extension/browser/start")
  @UseGuards(ApiAuthGuard)
  async startExtensionLogin(@CurrentUser() user: AuthenticatedAppUser) {
    await assertUserHasAcceptedLegalDocuments(user.id);
    return this.desktopAuthService.startExtensionLogin(user);
  }

  @Post("auth/extension/browser/poll")
  pollExtensionLogin(@Body() body: unknown) {
    const parsed = extensionPollSchema.parse(body);
    return this.desktopAuthService.pollExtensionLogin(parsed.code);
  }

  @Post("auth/extension/browser/approve")
  @UseGuards(ApiAuthGuard)
  async approveExtensionLogin(@CurrentUser() user: AuthenticatedAppUser) {
    await assertUserHasAcceptedLegalDocuments(user.id);
    return this.desktopAuthService.startExtensionLogin(user);
  }

  @Post("auth/extension/logout")
  @UseGuards(ApiAuthGuard)
  logoutExtension(
    @CurrentUser() user: AuthenticatedAppUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.desktopAuthService.logoutExtension(
      user.id,
      getBearerToken(request),
    );
  }

  @Get("me")
  @UseGuards(ApiAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedAppUser) {
    return toEmployee(user);
  }

  @Get("employees/me/prompt")
  @UseGuards(ApiAuthGuard)
  async getPrompt(@CurrentUser() user: AuthenticatedAppUser) {
    const settings = await prisma.liveAssistantSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    const prompt = await this.liveAiPromptService.getContent(
      WPF_LIVE_PROMPT_KEYS.answerEmployeeInstruction,
    );

    return {
      employeeId: user.id,
      prompt,
      answerProvider: settings.answerProvider,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  @Put("employees/me/prompt")
  @UseGuards(ApiAuthGuard)
  async updatePrompt(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = promptSchema.parse(body);
    const settings = await prisma.liveAssistantSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        answerProvider: parsed.answerProvider ?? "yandex",
      },
      update: {
        ...(parsed.answerProvider ? { answerProvider: parsed.answerProvider } : {}),
      },
    });
    const prompt = await this.liveAiPromptService.getContent(
      WPF_LIVE_PROMPT_KEYS.answerEmployeeInstruction,
    );

    return {
      employeeId: user.id,
      prompt,
      answerProvider: settings.answerProvider,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }
}
