import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  generateAiObject,
  YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL,
} from "@offergo/ai";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import {
  finalizeQuotaReservation,
  releaseQuotaReservation,
  reserveQuota,
  type UsageReservation,
} from "@offergo/billing";
import { Prisma, prisma } from "@offergo/db";
import { z } from "zod";

import { CurrentUser } from "../auth/current-user.decorator";
import { ApiAuthGuard } from "../auth/auth.guard";
import { throwIfQuotaExceeded } from "../billing/quota-http";

const vacancyTextMinLength = 100;
const vacancyTextMaxLength = 30_000;

const generateIndividualResponseSchema = z.object({
  resumeId: z.string().trim().min(1).max(128),
  vacancyText: z
    .string()
    .trim()
    .min(vacancyTextMinLength)
    .max(vacancyTextMaxLength),
  source: z.enum(["manual", "hh_browser_copilot"]).default("manual").optional(),
  vacancyUrl: z.string().trim().url().max(2_000).optional(),
  vacancyTitle: z.string().trim().max(300).optional(),
  employerName: z.string().trim().max(300).optional(),
});

const listIndividualResponsesQuerySchema = z.object({
  source: z.enum(["manual", "hh_browser_copilot"]).optional(),
});

const autoResponseSettingsSchema = z.object({
  defaultResumeId: z.string().trim().min(1).max(128).nullable().optional(),
});

const individualResponseAiSchema = z.object({
  decision: z.enum(["matched", "mismatch"]),
  matchScore: z.number().int().min(0).max(100),
  coverLetter: z.string().nullable(),
  strengths: z.array(z.string().trim().min(1)).max(12),
  weaknesses: z.array(z.string().trim().min(1)).max(12),
  recommendations: z.array(z.string().trim().min(1)).max(12),
  summary: z.string().trim().min(1).max(1_500),
});

const individualResponseModelId = YANDEX_AI_STUDIO_DEFAULT_TEXT_MODEL;

type IndividualResponseArtifact = Awaited<
  ReturnType<typeof findOwnedIndividualResponse>
>;

async function findOwnedIndividualResponse(userId: string, id: string) {
  const item = await prisma.individualResponseArtifact.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!item) {
    throw new NotFoundException("Отклик не найден.");
  }

  return item;
}

function serializeJsonStringArray(value: Prisma.JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function serializeIndividualResponse(item: IndividualResponseArtifact) {
  return {
    id: item.id,
    resumeId: item.resumeId,
    resumeTitle: item.resumeTitle,
    vacancyText: item.vacancyText,
    source: item.source,
    vacancyUrl: item.vacancyUrl,
    vacancyTitle: item.vacancyTitle,
    employerName: item.employerName,
    matchScore: item.matchScore,
    decision: item.decision,
    coverLetter: item.coverLetter,
    summary: item.summary,
    strengths: serializeJsonStringArray(item.strengths),
    weaknesses: serializeJsonStringArray(item.weaknesses),
    recommendations: serializeJsonStringArray(item.recommendations),
    modelId: item.modelId,
    deletedAt: item.deletedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function findOwnedResumeWithText(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({
    where: {
      id: resumeId,
      userId,
      deletedAt: null,
    },
    include: {
      versions: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!resume) {
    throw new NotFoundException("Резюме не найдено.");
  }

  const plainText = resume.versions[0]?.plainText?.trim();

  if (!plainText) {
    throw new BadRequestException("У резюме нет текстовой версии.");
  }

  return {
    plainText,
    resume,
  };
}

function buildIndividualResponsePrompt(input: {
  resumeText: string;
  vacancyText: string;
}) {
  return [
    "Сравни резюме кандидата и текст вакансии. Нужно выполнить всю работу одним ответом.",
    "",
    "Правила:",
    "- Используй только факты из резюме. Не выдумывай опыт, навыки, компании, достижения или сроки.",
    "- Если профессия, стек или уровень вакансии сильно отличаются от резюме, верни decision=mismatch, coverLetter=null и объясни слабые места в weaknesses/recommendations.",
    "- Если совпадение есть, верни decision=matched и напиши сопроводительное письмо.",
    "- Письмо должно быть на русском, официальное, живое, без AI-клише, без длинного тире.",
    "- Письмо должно фокусироваться только на сильных подтвержденных сторонах кандидата относительно вакансии.",
    "- Не упоминай слабые стороны в самом письме.",
    "- Не делай письмо слишком длинным: 2-4 коротких абзаца.",
    "- matchScore оценивай от 0 до 100.",
    "- Все строки в ответе возвращай на русском языке.",
    "",
    "Резюме кандидата:",
    input.resumeText,
    "",
    "Текст вакансии:",
    input.vacancyText,
  ].join("\n");
}

function buildIndividualResponseSystemPrompt() {
  return [
    "Ты карьерный консультант и пишешь сопроводительные письма для откликов на вакансии.",
    "Возвращай только структурированный результат по схеме.",
    "Не добавляй пояснения вне структуры ответа.",
  ].join(" ");
}

function buildIndividualResponsePromptUtf8(input: {
  resumeText: string;
  vacancyText: string;
}) {
  return [
    "Сравни резюме кандидата и текст вакансии. Нужно выполнить всю работу одним ответом.",
    "",
    "Правила:",
    "- Используй только факты из резюме. Не выдумывай опыт, навыки, компании, достижения или сроки.",
    "- Если профессия, стек или уровень вакансии сильно отличаются от резюме, верни decision=mismatch, coverLetter=null и объясни слабые места в weaknesses/recommendations.",
    "- Если совпадение есть, верни decision=matched и напиши сопроводительное письмо.",
    "- Письмо должно быть на русском, официальное, живое, без AI-клише, без длинного тире.",
    "- Письмо должно фокусироваться только на сильных подтвержденных сторонах кандидата относительно вакансии.",
    "- Не упоминай слабые стороны в самом письме.",
    "- Не делай письмо слишком длинным: 2-4 коротких абзаца.",
    "- matchScore оценивай от 0 до 100.",
    "- Все строки в ответе возвращай на русском языке.",
    "",
    "Резюме кандидата:",
    input.resumeText,
    "",
    "Текст вакансии:",
    input.vacancyText,
  ].join("\n");
}

function buildIndividualResponseSystemPromptUtf8() {
  return [
    "Ты карьерный консультант и пишешь сопроводительные письма для откликов на вакансии.",
    "Возвращай только структурированный результат по схеме.",
    "Не добавляй пояснения вне структуры ответа.",
  ].join(" ");
}

@ApiTags("cover-materials")
@ApiBearerAuth("bearer")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Authentication required.",
})
@UseGuards(ApiAuthGuard)
@Controller("cover-materials/individual-responses")
export class CoverMaterialsController {
  @Get()
  async listIndividualResponses(
    @CurrentUser() user: AuthenticatedAppUser,
    @Query() query: unknown,
  ) {
    const parsed = listIndividualResponsesQuerySchema.parse(query);
    const items = await prisma.individualResponseArtifact.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        ...(parsed.source ? { source: parsed.source } : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
    });

    return {
      items: items.map(serializeIndividualResponse),
    };
  }

  @Post("generate")
  async generateIndividualResponse(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = generateIndividualResponseSchema.parse(body);
    let reservation: UsageReservation | null = null;

    try {
      reservation = await reserveQuota(user.id, "individual_response", 1, {
        resumeId: parsed.resumeId,
        source: parsed.source ?? "manual",
        vacancyUrl: parsed.vacancyUrl,
      });
      const { plainText, resume } = await findOwnedResumeWithText(
        user.id,
        parsed.resumeId,
      );
      const result = await generateAiObject({
        modelId: individualResponseModelId,
        schema: individualResponseAiSchema,
        prompt: buildIndividualResponsePromptUtf8({
          resumeText: plainText,
          vacancyText: parsed.vacancyText,
        }),
        system: buildIndividualResponseSystemPromptUtf8(),
        temperature: 0.55,
      }).catch((error) => {
        console.error("[individual-response] AI generation failed", error);
        throw new BadGatewayException(
          "Не удалось сформировать отклик. Повторите попытку позже.",
        );
      });
      const output = result.object;
      const coverLetter =
        output.decision === "matched"
          ? output.coverLetter?.trim() || null
          : null;
      const artifact = await prisma.individualResponseArtifact.create({
        data: {
          userId: user.id,
          resumeId: resume.id,
          resumeTitle: resume.title,
          vacancyText: parsed.vacancyText,
          source: parsed.source ?? "manual",
          vacancyUrl: parsed.vacancyUrl ?? null,
          vacancyTitle: parsed.vacancyTitle ?? null,
          employerName: parsed.employerName ?? null,
          matchScore: output.matchScore,
          decision: output.decision,
          coverLetter,
          summary: output.summary,
          strengths: output.strengths as Prisma.InputJsonValue,
          weaknesses: output.weaknesses as Prisma.InputJsonValue,
          recommendations: output.recommendations as Prisma.InputJsonValue,
          modelId: result.modelId,
          rawResult: output as Prisma.InputJsonValue,
        },
      });

      await finalizeQuotaReservation(reservation, {
        artifactId: artifact.id,
        resumeId: resume.id,
        source: parsed.source ?? "manual",
        vacancyUrl: parsed.vacancyUrl,
      });

      return {
        item: serializeIndividualResponse(artifact),
      };
    } catch (error) {
      if (reservation) {
        await releaseQuotaReservation(reservation, {
          resumeId: parsed.resumeId,
          reason: "individual_response_generation_failed",
          source: parsed.source ?? "manual",
        }).catch(() => undefined);
      }
      throwIfQuotaExceeded(error);
    }
  }

  @Delete(":id")
  @HttpCode(200)
  async deleteIndividualResponse(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("id") id: string,
  ) {
    await findOwnedIndividualResponse(user.id, id);

    const item = await prisma.individualResponseArtifact.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      item: serializeIndividualResponse(item),
    };
  }
}

@ApiTags("cover-materials")
@ApiBearerAuth("bearer")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Authentication required.",
})
@UseGuards(ApiAuthGuard)
@Controller("cover-materials/auto-responses")
export class AutoResponsesController {
  @Get("settings")
  async getAutoResponseSettings(@CurrentUser() user: AuthenticatedAppUser) {
    const settings = await prisma.autoResponseSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    return {
      defaultResumeId: settings.defaultResumeId,
      updatedAt: settings.updatedAt,
    };
  }

  @Put("settings")
  async updateAutoResponseSettings(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = autoResponseSettingsSchema.parse(body);

    if (parsed.defaultResumeId) {
      await findOwnedResumeWithText(user.id, parsed.defaultResumeId);
    }

    const settings = await prisma.autoResponseSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        defaultResumeId: parsed.defaultResumeId ?? null,
      },
      update: {
        defaultResumeId: parsed.defaultResumeId ?? null,
      },
    });

    return {
      defaultResumeId: settings.defaultResumeId,
      updatedAt: settings.updatedAt,
    };
  }
}
