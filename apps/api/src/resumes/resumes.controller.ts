import { createHash } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import type { Response } from "express";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { prisma, Prisma } from "@offergo/db";
import { z } from "zod";

import { ApiAuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  getResumeSourceFile,
  headResumeSourceFile,
  uploadResumeSourceFile,
} from "./resume-storage";
import {
  extractResumeText,
  inferResumeMimeType,
  normalizeUploadedFileName,
  supportedResumeMimeTypes,
} from "./resume-text-extraction";

const maxUploadSizeBytes = 10 * 1024 * 1024;

const listResumesQuerySchema = z.object({
  scope: z.enum(["active", "trash", "all"]).default("active"),
  folderId: z.string().trim().min(1).max(128).nullable().optional(),
  search: z.string().trim().max(160).optional(),
});

const createResumeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  plainText: z.string().trim().min(1).max(50_000),
  folderId: z.string().trim().min(1).max(128).nullable().optional(),
});

const updateResumeSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  folderId: z.string().trim().min(1).max(128).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
  markOpened: z.coerce.boolean().optional(),
});

const saveResumeContentSchema = z.object({
  plainText: z.string().max(200_000),
  content: z.array(z.unknown()).min(1),
});

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

const uploadResumeSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  folderId: z.string().trim().min(1).max(128).nullable().optional(),
});

type ResumeWithRelations = Prisma.ResumeGetPayload<{
  include: {
    originalFile: true;
    versions: {
      orderBy: {
        createdAt: "desc";
      };
      take: 1;
    };
  };
}>;

function getResumeFileExtension(mimeType: string) {
  if (mimeType === "application/pdf") {
    return ".pdf";
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return ".docx";
  }

  return ".txt";
}

function setResumeSourceFileHeaders(
  response: Response,
  options: {
    title: string;
    mimeType: string;
    contentType?: string;
    contentLength?: number;
  },
) {
  const fileName = `${options.title}${getResumeFileExtension(options.mimeType)}`;

  response.setHeader("content-type", options.contentType ?? options.mimeType);
  response.setHeader(
    "content-disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );

  if (options.contentLength) {
    response.setHeader("content-length", String(options.contentLength));
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Не удалось обработать резюме.";
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Новое резюме";
}

function serializeResume(resume: ResumeWithRelations) {
  const currentVersion = resume.versions[0] ?? null;

  return {
    id: resume.id,
    title: resume.title,
    status: resume.status,
    folderId: resume.folderId,
    originalFileId: resume.originalFileId,
    currentVersionId: resume.currentVersionId,
    sortOrder: resume.sortOrder,
    lastOpenedAt: resume.lastOpenedAt,
    processingError: resume.processingError,
    deletedAt: resume.deletedAt,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
    originalFile: resume.originalFile
      ? {
          id: resume.originalFile.id,
          mimeType: resume.originalFile.mimeType,
          size: resume.originalFile.size,
          createdAt: resume.originalFile.createdAt,
        }
      : null,
    currentVersion: currentVersion
      ? {
          id: currentVersion.id,
          source: currentVersion.source,
          plainText: currentVersion.plainText,
          content: currentVersion.content,
          summary: currentVersion.summary,
          createdAt: currentVersion.createdAt,
        }
      : null,
  };
}

async function assertFolderOwner(userId: string, folderId?: string | null) {
  if (!folderId) {
    return;
  }

  const folder = await prisma.resumeFolder.findFirst({
    where: {
      id: folderId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!folder) {
    throw new NotFoundException("Папка не найдена.");
  }
}

async function findOwnedResume(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({
    where: {
      id: resumeId,
      userId,
    },
    include: {
      originalFile: true,
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

  return resume;
}

async function createResumeVersion(options: {
  userId: string;
  title: string;
  folderId?: string | null;
  plainText: string;
  originalFileId?: string | null;
  status?: "uploaded" | "draft";
}) {
  await assertFolderOwner(options.userId, options.folderId);

  return prisma.$transaction(async (tx) => {
    const resume = await tx.resume.create({
      data: {
        userId: options.userId,
        title: options.title,
        folderId: options.folderId ?? null,
        originalFileId: options.originalFileId ?? null,
        status: options.status ?? "uploaded",
      },
    });
    const version = await tx.resumeVersion.create({
      data: {
        resumeId: resume.id,
        source: "uploaded",
        plainText: options.plainText,
        summary: options.plainText.slice(0, 600),
      },
    });
    const updated = await tx.resume.update({
      where: {
        id: resume.id,
      },
      data: {
        currentVersionId: version.id,
      },
      include: {
        originalFile: true,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return updated;
  });
}

@ApiTags("resumes")
@ApiBearerAuth("bearer")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Authentication required.",
})
@UseGuards(ApiAuthGuard)
@Controller()
export class ResumesController {
  @Get("resumes")
  async listResumes(
    @CurrentUser() user: AuthenticatedAppUser,
    @Query() query: unknown,
  ) {
    const parsed = listResumesQuerySchema.parse(query);
    const where: Prisma.ResumeWhereInput = {
      userId: user.id,
    };

    if (parsed.scope === "active") {
      where.deletedAt = null;
    }

    if (parsed.scope === "trash") {
      where.deletedAt = {
        not: null,
      };
    }

    if (parsed.folderId === "none") {
      where.folderId = null;
    } else if (parsed.folderId) {
      where.folderId = parsed.folderId;
    }

    if (parsed.search) {
      where.OR = [
        {
          title: {
            contains: parsed.search,
            mode: "insensitive",
          },
        },
        {
          versions: {
            some: {
              plainText: {
                contains: parsed.search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    const resumes = await prisma.resume.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: {
        originalFile: true,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return {
      items: resumes.map(serializeResume),
    };
  }

  @Post("resumes")
  async createResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = createResumeSchema.parse(body);
    const resume = await createResumeVersion({
      userId: user.id,
      title: parsed.title,
      folderId: parsed.folderId,
      plainText: parsed.plainText,
      status: "draft",
    });

    return {
      item: serializeResume(resume),
    };
  }

  @Post("resumes/upload")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        title: { type: "string" },
        folderId: { type: "string", nullable: true },
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: maxUploadSizeBytes,
      },
    }),
  )
  async uploadResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    if (!file) {
      throw new BadRequestException("Файл резюме обязателен.");
    }

    const parsed = uploadResumeSchema.parse(body);
    await assertFolderOwner(user.id, parsed.folderId);

    const mimeType = inferResumeMimeType(file);
    const originalFileName = normalizeUploadedFileName(file.originalname);

    if (!supportedResumeMimeTypes.has(mimeType)) {
      throw new BadRequestException("Поддерживаются только PDF, DOCX и TXT.");
    }

    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const source = await uploadResumeSourceFile({
      ownerId: user.id,
      fileName: originalFileName,
      contentType: mimeType,
      body: file.buffer,
    });

    let plainText: string | null = null;
    let processingError: string | null = null;

    try {
      plainText = await extractResumeText({
        buffer: file.buffer,
        mimeType,
      });

      if (!plainText) {
        processingError = "Не удалось извлечь текст из файла.";
      }
    } catch (error) {
      processingError = getErrorMessage(error);
    }

    const title = parsed.title ?? titleFromFileName(originalFileName);
    const resume = await prisma.$transaction(async (tx) => {
      const fileAsset = await tx.fileAsset.create({
        data: {
          ownerId: user.id,
          bucket: source.bucket,
          objectKey: source.objectKey,
          mimeType,
          size: file.size,
          purpose: "resume_source",
          checksum,
        },
      });
      const createdResume = await tx.resume.create({
        data: {
          userId: user.id,
          folderId: parsed.folderId ?? null,
          title,
          status: plainText && !processingError ? "uploaded" : "failed",
          originalFileId: fileAsset.id,
          processingError,
        },
      });

      if (!plainText || processingError) {
        return tx.resume.findUniqueOrThrow({
          where: {
            id: createdResume.id,
          },
          include: {
            originalFile: true,
            versions: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        });
      }

      const version = await tx.resumeVersion.create({
        data: {
          resumeId: createdResume.id,
          source: "uploaded",
          plainText,
          summary: plainText.slice(0, 600),
          content: {
            originalFileName,
            mimeType,
          },
        },
      });

      return tx.resume.update({
        where: {
          id: createdResume.id,
        },
        data: {
          currentVersionId: version.id,
        },
        include: {
          originalFile: true,
          versions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });
    });

    return {
      item: serializeResume(resume),
    };
  }

  @Get("resumes/:resumeId")
  async getResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
  ) {
    const resume = await findOwnedResume(user.id, resumeId);

    await prisma.resume.update({
      where: {
        id: resume.id,
      },
      data: {
        lastOpenedAt: new Date(),
      },
    });

    return {
      item: serializeResume({
        ...resume,
        lastOpenedAt: new Date(),
      }),
    };
  }

  @Patch("resumes/:resumeId")
  async updateResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateResumeSchema.parse(body);

    await findOwnedResume(user.id, resumeId);
    await assertFolderOwner(user.id, parsed.folderId);

    const resume = await prisma.resume.update({
      where: {
        id: resumeId,
      },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.folderId !== undefined ? { folderId: parsed.folderId } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.markOpened ? { lastOpenedAt: new Date() } : {}),
      },
      include: {
        originalFile: true,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return {
      item: serializeResume(resume),
    };
  }

  @Put("resumes/:resumeId/content")
  async saveResumeContent(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Body() body: unknown,
  ) {
    const parsed = saveResumeContentSchema.parse(body);
    const resume = await findOwnedResume(user.id, resumeId);
    const currentVersion = resume.versions[0] ?? null;
    const versionContent = parsed.content as Prisma.InputJsonValue;
    const summary = parsed.plainText.slice(0, 600);

    const updated = await prisma.$transaction(async (tx) => {
      if (currentVersion?.source === "manual") {
        await tx.resumeVersion.update({
          where: {
            id: currentVersion.id,
          },
          data: {
            plainText: parsed.plainText,
            content: versionContent,
            summary,
          },
        });

        return tx.resume.update({
          where: {
            id: resume.id,
          },
          data: {
            currentVersionId: currentVersion.id,
            ...(resume.status === "failed"
              ? { status: "draft", processingError: null }
              : {}),
          },
          include: {
            originalFile: true,
            versions: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        });
      }

      const version = await tx.resumeVersion.create({
        data: {
          resumeId: resume.id,
          source: "manual",
          plainText: parsed.plainText,
          content: versionContent,
          summary,
        },
      });

      return tx.resume.update({
        where: {
          id: resume.id,
        },
        data: {
          currentVersionId: version.id,
          ...(resume.status === "failed"
            ? { status: "draft", processingError: null }
            : {}),
        },
        include: {
          originalFile: true,
          versions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });
    });

    return {
      item: serializeResume(updated),
    };
  }

  @Delete("resumes/:resumeId")
  async deleteResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
  ) {
    await findOwnedResume(user.id, resumeId);
    const resume = await prisma.resume.update({
      where: {
        id: resumeId,
      },
      data: {
        deletedAt: new Date(),
      },
      include: {
        originalFile: true,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return {
      item: serializeResume(resume),
    };
  }

  @Post("resumes/:resumeId/restore")
  @HttpCode(200)
  async restoreResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
  ) {
    await findOwnedResume(user.id, resumeId);
    const resume = await prisma.resume.update({
      where: {
        id: resumeId,
      },
      data: {
        deletedAt: null,
      },
      include: {
        originalFile: true,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return {
      item: serializeResume(resume),
    };
  }

  @Post("resumes/:resumeId/duplicate")
  @HttpCode(200)
  async duplicateResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
  ) {
    const source = await findOwnedResume(user.id, resumeId);
    const currentVersion = source.versions[0];

    if (!currentVersion?.plainText) {
      throw new BadRequestException("У резюме нет текстовой версии для копирования.");
    }

    const duplicated = await createResumeVersion({
      userId: user.id,
      title: `${source.title} — копия`,
      folderId: source.folderId,
      plainText: currentVersion.plainText,
      originalFileId: source.originalFileId,
      status: source.status === "failed" ? "draft" : "uploaded",
    });

    return {
      item: serializeResume(duplicated),
    };
  }

  @Head("resumes/:resumeId/source-file")
  async headSourceFile(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resume = await findOwnedResume(user.id, resumeId);

    if (!resume.originalFile) {
      throw new NotFoundException("Исходный файл не найден.");
    }

    try {
      const sourceFile = await headResumeSourceFile(
        resume.originalFile.objectKey,
      );

      setResumeSourceFileHeaders(response, {
        title: resume.title,
        mimeType: resume.originalFile.mimeType,
        contentType: sourceFile.contentType,
        contentLength: sourceFile.contentLength,
      });
    } catch {
      throw new NotFoundException("Исходный файл не найден.");
    }
  }

  @Get("resumes/:resumeId/source-file")
  async getSourceFile(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resume = await findOwnedResume(user.id, resumeId);

    if (!resume.originalFile) {
      throw new NotFoundException("Исходный файл не найден.");
    }

    try {
      const sourceFile = await getResumeSourceFile(
        resume.originalFile.objectKey,
      );

      setResumeSourceFileHeaders(response, {
        title: resume.title,
        mimeType: resume.originalFile.mimeType,
        contentType: sourceFile.contentType,
        contentLength: sourceFile.contentLength,
      });

      return new StreamableFile(sourceFile.body);
    } catch {
      throw new NotFoundException("Исходный файл не найден.");
    }
  }

  @Get("resume-folders")
  async listFolders(@CurrentUser() user: AuthenticatedAppUser) {
    const folders = await prisma.resumeFolder.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: {
            resumes: {
              where: {
                deletedAt: null,
              },
            },
            analyses: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    return {
      items: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        sortOrder: folder.sortOrder,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        resumeCount: folder._count.resumes + folder._count.analyses,
      })),
    };
  }

  @Post("resume-folders")
  async createFolder(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = createFolderSchema.parse(body);
    const folder = await prisma.resumeFolder.create({
      data: {
        userId: user.id,
        name: parsed.name,
      },
    });

    return {
      item: folder,
    };
  }

  @Patch("resume-folders/:folderId")
  async updateFolder(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("folderId") folderId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateFolderSchema.parse(body);
    await assertFolderOwner(user.id, folderId);

    const folder = await prisma.resumeFolder.update({
      where: {
        id: folderId,
      },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
      },
    });

    return {
      item: folder,
    };
  }

  @Delete("resume-folders/:folderId")
  async deleteFolder(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("folderId") folderId: string,
  ) {
    await assertFolderOwner(user.id, folderId);

    await prisma.$transaction([
      prisma.resume.updateMany({
        where: {
          userId: user.id,
          folderId,
        },
        data: {
          folderId: null,
        },
      }),
      prisma.resumeAnalysisArtifact.updateMany({
        where: {
          userId: user.id,
          folderId,
        },
        data: {
          folderId: null,
        },
      }),
      prisma.resumeFolder.delete({
        where: {
          id: folderId,
        },
      }),
    ]);

    return {
      ok: true,
    };
  }
}
