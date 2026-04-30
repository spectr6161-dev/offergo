import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Sse,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { prisma } from "@offergo/db";
import { z } from "zod";

import { ApiAuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { WorkflowService } from "./workflow.service";

const startResumeAnalysisRunSchema = z.object({
  resumeId: z.string().trim().min(1).max(128),
});

const updateSavedAnalysisSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  folderId: z.string().trim().min(1).max(128).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

function serializeSavedAnalysis(
  item: Awaited<ReturnType<typeof findOwnedSavedAnalysis>>,
) {
  return {
    id: item.id,
    title: item.title,
    folderId: item.folderId,
    sourceResumeId: item.sourceResumeId,
    derivedResumeId: item.derivedResumeId,
    workflowRunId: item.workflowRunId,
    sortOrder: item.sortOrder,
    deletedAt: item.deletedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    finalResult: item.finalResult,
    studioData: item.studioData,
  };
}

async function findOwnedSavedAnalysis(userId: string, analysisId: string) {
  const item = await prisma.resumeAnalysisArtifact.findFirst({
    where: {
      id: analysisId,
      userId,
    },
  });

  if (!item) {
    throw new NotFoundException("Saved analysis not found.");
  }

  return item;
}

@ApiTags("resume-analysis")
@ApiBearerAuth("bearer")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Authentication required.",
})
@UseGuards(ApiAuthGuard)
@Controller("resume-analysis")
export class ResumeAnalysisController {
  constructor(private readonly workflows: WorkflowService) {}

  @Post("runs")
  async startRun(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = startResumeAnalysisRunSchema.parse(body);

    return this.workflows.startResumeAnalysisWorkflow(user.id, {
      resumeId: parsed.resumeId,
      persistResults: true,
    });
  }

  @Get("saved")
  async listSavedAnalyses(@CurrentUser() user: AuthenticatedAppUser) {
    const items = await prisma.resumeAnalysisArtifact.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });

    return {
      items: items.map(serializeSavedAnalysis),
    };
  }

  @Get("saved/:analysisId")
  async getSavedAnalysis(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("analysisId") analysisId: string,
  ) {
    const item = await findOwnedSavedAnalysis(user.id, analysisId);

    return {
      item: serializeSavedAnalysis(item),
    };
  }

  @Patch("saved/:analysisId")
  async updateSavedAnalysis(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("analysisId") analysisId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSavedAnalysisSchema.parse(body);
    await findOwnedSavedAnalysis(user.id, analysisId);

    if (parsed.folderId) {
      const folder = await prisma.resumeFolder.findFirst({
        where: {
          id: parsed.folderId,
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (!folder) {
        throw new NotFoundException("Folder not found.");
      }
    }

    const item = await prisma.resumeAnalysisArtifact.update({
      where: {
        id: analysisId,
      },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.folderId !== undefined ? { folderId: parsed.folderId } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
      },
    });

    return {
      item: serializeSavedAnalysis(item),
    };
  }

  @Delete("saved/:analysisId")
  async deleteSavedAnalysis(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("analysisId") analysisId: string,
  ) {
    await findOwnedSavedAnalysis(user.id, analysisId);

    const item = await prisma.resumeAnalysisArtifact.update({
      where: {
        id: analysisId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      item: serializeSavedAnalysis(item),
    };
  }

  @Post("saved/:analysisId/restore")
  @HttpCode(200)
  async restoreSavedAnalysis(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("analysisId") analysisId: string,
  ) {
    await findOwnedSavedAnalysis(user.id, analysisId);

    const item = await prisma.resumeAnalysisArtifact.update({
      where: {
        id: analysisId,
      },
      data: {
        deletedAt: null,
      },
    });

    return {
      item: serializeSavedAnalysis(item),
    };
  }

  @Get("runs/:runId")
  async getRun(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("runId") runId: string,
  ) {
    return this.workflows.getRunSnapshotForUser(user.id, runId);
  }

  @Sse("runs/:runId/events")
  streamRunEvents(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("runId") runId: string,
  ) {
    return this.workflows.streamRunEventsForUser(user.id, runId);
  }
}
