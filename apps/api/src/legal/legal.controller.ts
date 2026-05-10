import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "@offergo/db";
import { deleteResumeFileObject } from "../resumes/resume-storage";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiAuthGuard } from "../auth/auth.guard";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import {
  acceptUserConsents,
  getConsentStatusForUser,
  requiredConsentKinds,
  toDocumentResponse,
} from "./legal-consents";
import {
  AcceptConsentsRequestDto,
  AcceptConsentsResponseDto,
} from "../docs/swagger.models";

const acceptConsentsSchema = z.object({
  source: z.string().trim().min(1).max(64).default("web"),
  documentIds: z.array(z.string().trim().min(1)).optional(),
});

const privacyRequestSchema = z.object({
  kind: z.enum([
    "export_data",
    "delete_account",
    "correct_data",
    "restrict_processing",
  ]),
  message: z.string().trim().max(4000).default(""),
});

@ApiTags("legal")
@Controller()
export class LegalController {
  @Get("legal-documents")
  async listLegalDocuments() {
    const documents = await prisma.legalDocumentVersion.findMany({
      where: {
        active: true,
      },
      orderBy: {
        kind: "asc",
      },
    });

    return {
      items: documents.map(toDocumentResponse),
      requiredConsentKinds,
    };
  }

  @Get("legal-documents/:slug")
  async getLegalDocument(@Param("slug") slug: string) {
    const document = await prisma.legalDocumentVersion.findFirstOrThrow({
      where: {
        slug,
        active: true,
      },
    });

    return {
      document: toDocumentResponse(document),
    };
  }

  @Get("legal/consents/status")
  @UseGuards(ApiAuthGuard)
  async getConsentStatus(@CurrentUser() user: AuthenticatedAppUser) {
    return getConsentStatusForUser(user.id);
  }

  @Post("legal/consents/accept")
  @HttpCode(200)
  @UseGuards(ApiAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Accept active legal documents",
    description:
      "Records consent acceptance for the authenticated user. Mobile clients may pass exact documentIds that were displayed to the user.",
  })
  @ApiBody({ type: AcceptConsentsRequestDto })
  @ApiOkResponse({ type: AcceptConsentsResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication is required." })
  @ApiUnprocessableEntityResponse({
    description: "One or more active required legal documents were not accepted.",
  })
  async acceptConsents(
    @CurrentUser() user: AuthenticatedAppUser,
    @Req() request: Request,
    @Body() body: unknown,
  ) {
    const parsed = acceptConsentsSchema.parse(body ?? {});
    const now = await acceptUserConsents({
      userId: user.id,
      source: parsed.source,
      request,
      documentIds: parsed.documentIds,
    });

    return {
      ok: true,
      acceptedAt: now.toISOString(),
    };
  }

  @Get("legal/data-export")
  @UseGuards(ApiAuthGuard)
  async exportUserData(@CurrentUser() user: AuthenticatedAppUser) {
    const [
      profile,
      resumes,
      analyses,
      individualResponses,
      liveSessions,
      payments,
      entitlements,
      consents,
      privacyRequests,
    ] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
          accounts: {
            select: {
              providerId: true,
              accountId: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.resume.findMany({
        where: { userId: user.id },
        include: {
          versions: true,
          builderProfile: {
            include: {
              educationEntries: true,
              experienceEntries: true,
              skills: true,
            },
          },
        },
      }),
      prisma.resumeAnalysisArtifact.findMany({
        where: { userId: user.id },
      }),
      prisma.individualResponseArtifact.findMany({
        where: { userId: user.id },
      }),
      prisma.liveSession.findMany({
        where: { userId: user.id },
        include: {
          transcripts: true,
          answers: true,
          screenshots: true,
        },
      }),
      prisma.payment.findMany({
        where: { userId: user.id },
        include: { plan: true },
      }),
      prisma.entitlement.findMany({
        where: { userId: user.id },
        include: { plan: true },
      }),
      prisma.userConsentAcceptance.findMany({
        where: { userId: user.id },
        include: { documentVersion: true },
      }),
      prisma.userPrivacyRequest.findMany({
        where: { userId: user.id },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user: profile,
      resumes,
      analyses,
      individualResponses,
      liveSessions,
      payments,
      entitlements,
      consents,
      privacyRequests,
    };
  }

  @Post("legal/privacy-requests")
  @UseGuards(ApiAuthGuard)
  async createPrivacyRequest(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = privacyRequestSchema.parse(body ?? {});
    const request = await prisma.userPrivacyRequest.create({
      data: {
        userId: user.id,
        kind: parsed.kind,
        message: parsed.message,
      },
    });

    return {
      request,
    };
  }

  @Delete("legal/account")
  @HttpCode(200)
  @UseGuards(ApiAuthGuard)
  async deleteAccount(@CurrentUser() user: AuthenticatedAppUser) {
    const files = await prisma.fileAsset.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        objectKey: true,
      },
    });

    await prisma.user.delete({
      where: { id: user.id },
    });

    for (const file of files) {
      await deleteResumeFileObject(file.objectKey).catch(() => undefined);
    }

    await prisma.fileAsset.deleteMany({
      where: {
        id: {
          in: files.map((file) => file.id),
        },
      },
    });

    return {
      ok: true,
    };
  }
}
