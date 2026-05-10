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
import { assertQuota } from "@offergo/billing";
import { prisma, Prisma } from "@offergo/db";
import {
  createEmptyResumeBuilderContent,
  getResumeBuilderTitle,
  resumeBuilderContentSchema,
  resumeBuilderContentToPlainText,
  resumeBuilderSteps,
  type ResumeBuilderContent,
} from "@offergo/shared";
import { z } from "zod";

import { ApiAuthGuard } from "../auth/auth.guard";
import { throwIfQuotaExceeded } from "../billing/quota-http";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  deleteResumeFileObject,
  getResumePhotoFile,
  getResumeSourceFile,
  headResumePhotoFile,
  headResumeSourceFile,
  uploadResumePhotoFile,
  uploadResumeSourceFile,
} from "./resume-storage";
import {
  extractResumeText,
  inferResumeMimeType,
  normalizeUploadedFileName,
  supportedResumeMimeTypes,
} from "./resume-text-extraction";
import {
  generateResumeBuilderDocx,
  generateResumeBuilderPdf,
  generateResumeBuilderTxt,
  getResumeBuilderExportMeta,
  resumeBuilderExportFormats,
  type ResumeBuilderExportFormat,
  type ResumeBuilderExportPhoto,
} from "./resume-builder-export";

const maxUploadSizeBytes = 10 * 1024 * 1024;
const maxResumePhotoSizeBytes = 5 * 1024 * 1024;
const supportedResumePhotoMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

const sourceFileQuerySchema = z.object({
  disposition: z.enum(["attachment", "inline"]).default("attachment"),
});

const builderExportQuerySchema = z.object({
  format: z.enum(resumeBuilderExportFormats).default("pdf"),
});

const saveResumeContentSchema = z.object({
  plainText: z.string().max(200_000),
  content: z.array(z.unknown()).min(1),
});

const saveResumeBuilderSchema = z.object({
  content: resumeBuilderContentSchema,
});

const finalizeResumeBuilderSchema = z
  .object({
    content: resumeBuilderContentSchema.optional(),
  })
  .optional();

const updateResumeBuilderPhotoSettingsSchema = z.object({
  positionX: z.coerce.number().min(0).max(100),
  positionY: z.coerce.number().min(0).max(100),
  scale: z.coerce.number().min(1).max(3),
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

const builderProfileInclude = {
  include: {
    photoFile: true,
    educationEntries: {
      orderBy: {
        sortOrder: "asc",
      },
    },
    experienceEntries: {
      orderBy: {
        sortOrder: "asc",
      },
    },
    skills: {
      orderBy: {
        sortOrder: "asc",
      },
    },
  },
} satisfies Prisma.ResumeBuilderProfileDefaultArgs;

type ResumeBuilderProfileWithRelations = Prisma.ResumeBuilderProfileGetPayload<
  typeof builderProfileInclude
>;

type ResumeBuilderPhotoSettings = {
  positionX: number;
  positionY: number;
  scale: number;
};

type ResumeWithRelations = Prisma.ResumeGetPayload<{
  include: {
    originalFile: true;
    exportFile: true;
    versions: {
      orderBy: {
        createdAt: "desc";
      };
      take: 1;
    };
  };
}> & {
  builderProfile?: ResumeBuilderProfileWithRelations | null;
};

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
    disposition?: "attachment" | "inline";
  },
) {
  const fileName = `${options.title}${getResumeFileExtension(options.mimeType)}`;
  const disposition = options.disposition ?? "attachment";

  response.setHeader("content-type", options.contentType ?? options.mimeType);
  response.setHeader(
    "content-disposition",
    `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );

  if (options.contentLength) {
    response.setHeader("content-length", String(options.contentLength));
  }
}

function setResumePhotoHeaders(
  response: Response,
  options: {
    mimeType: string;
    contentType?: string;
    contentLength?: number;
  },
) {
  response.setHeader("content-type", options.contentType ?? options.mimeType);
  response.setHeader("content-disposition", "inline");
  response.setHeader("cache-control", "private, max-age=60");

  if (options.contentLength) {
    response.setHeader("content-length", String(options.contentLength));
  }
}

function setResumeBuilderExportHeaders(
  response: Response,
  options: {
    contentLength: number;
    format: ResumeBuilderExportFormat;
    title: string;
  },
) {
  const meta = getResumeBuilderExportMeta(options.format);
  const fileName = `${options.title}${meta.extension}`;

  response.setHeader("content-type", meta.mimeType);
  response.setHeader(
    "content-disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  response.setHeader("content-length", String(options.contentLength));
}

function parseSourceFileQuery(query: unknown) {
  const parsed = sourceFileQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new BadRequestException("Некорректные параметры файла резюме.");
  }

  return parsed.data;
}

function parseBuilderExportQuery(query: unknown) {
  const parsed = builderExportQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new BadRequestException("Некорректный формат экспорта резюме.");
  }

  return parsed.data;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Не удалось обработать резюме.";
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Новое резюме";
}

function serializeFileAsset(
  file:
    | {
        id: string;
        mimeType: string;
        size: number;
        createdAt: Date;
      }
    | null
    | undefined,
) {
  return file
    ? {
        id: file.id,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt,
      }
    : null;
}

function serializeResume(resume: ResumeWithRelations) {
  const currentVersion = resume.versions[0] ?? null;

  return {
    id: resume.id,
    title: resume.title,
    status: resume.status,
    folderId: resume.folderId,
    originalFileId: resume.originalFileId,
    exportFileId: resume.exportFileId,
    currentVersionId: resume.currentVersionId,
    sortOrder: resume.sortOrder,
    lastOpenedAt: resume.lastOpenedAt,
    processingError: resume.processingError,
    deletedAt: resume.deletedAt,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
    originalFile: serializeFileAsset(resume.originalFile),
    exportFile: serializeFileAsset(resume.exportFile),
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
      exportFile: true,
      builderProfile: builderProfileInclude,
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
        exportFile: true,
        builderProfile: builderProfileInclude,
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

function normalizeBuilderStep(
  step: string,
): ResumeBuilderContent["wizard"]["currentStep"] {
  return (resumeBuilderSteps as readonly string[]).includes(step)
    ? (step as ResumeBuilderContent["wizard"]["currentStep"])
    : "intent";
}

function getBuilderContentFromProfile(
  profile: ResumeBuilderProfileWithRelations,
): ResumeBuilderContent {
  const baseContent = createEmptyResumeBuilderContent();
  const emptyPlateValue = baseContent.wizard.about;
  const mainEducation = profile.educationEntries.filter(
    (entry) => entry.kind === "main",
  );
  const additionalEducation = profile.educationEntries.filter(
    (entry) => entry.kind === "additional",
  );

  return resumeBuilderContentSchema.parse({
    ...baseContent,
    wizard: {
      ...baseContent.wizard,
      currentStep: normalizeBuilderStep(profile.currentStep),
      profession: profile.profession,
      basic: {
        ...baseContent.wizard.basic,
        lastName: profile.lastName,
        firstName: profile.firstName,
        middleName: profile.middleName,
        gender: profile.gender,
        city: profile.city,
        phone: "",
        birthDay: profile.birthDay,
        birthMonth: profile.birthMonth,
        birthYear: profile.birthYear,
        citizenship: profile.citizenship,
        workPermit: profile.workPermit,
      },
      contacts: {
        phone: profile.contactPhone,
        email: profile.contactEmail,
        telegram: profile.contactTelegram,
        max: profile.contactMax,
        vk: profile.contactVk,
        whatsapp: profile.contactWhatsapp,
        comment: profile.contactComment,
      },
      salary: {
        amount: profile.salaryAmount ? String(profile.salaryAmount) : "",
        currency: profile.salaryCurrency,
      },
      workConditions: {
        employmentTypes: profile.employmentTypes,
        workFormats: profile.workFormats,
        contractTypes: profile.contractTypes,
      },
      education: mainEducation.map((entry) => ({
        id: entry.id,
        level: entry.level,
        institution: entry.institution,
        faculty: entry.faculty,
        specialization: entry.specialization,
        graduationYear: entry.graduationYear,
        activities: Array.isArray(entry.activities)
          ? entry.activities
          : emptyPlateValue,
      })),
      additionalEducation: additionalEducation.map((entry) => ({
        id: entry.id,
        level: entry.level,
        institution: entry.institution,
        faculty: entry.faculty,
        specialization: entry.specialization,
        graduationYear: entry.graduationYear,
        activities: Array.isArray(entry.activities)
          ? entry.activities
          : emptyPlateValue,
      })),
      skills: profile.skills.map((skill) => skill.value),
      experience: profile.experienceEntries.map((entry) => ({
        id: entry.id,
        company: entry.company,
        position: entry.position,
        startMonth: entry.startMonth,
        startYear: entry.startYear,
        endMonth: entry.endMonth,
        endYear: entry.endYear,
        current: entry.current,
        description: Array.isArray(entry.description)
          ? entry.description
          : emptyPlateValue,
      })),
      about: Array.isArray(profile.about) ? profile.about : emptyPlateValue,
    },
  });
}

function getBuilderContentFromResume(resume: ResumeWithRelations) {
  if (!resume.builderProfile) {
    throw new NotFoundException("Builder resume not found.");
  }

  return getBuilderContentFromProfile(resume.builderProfile);
}

function getBuilderPhotoSettings(
  profile: ResumeBuilderProfileWithRelations | null | undefined,
): ResumeBuilderPhotoSettings {
  return {
    positionX: profile?.photoPositionX ?? 50,
    positionY: profile?.photoPositionY ?? 50,
    scale: profile?.photoScale ?? 1,
  };
}

async function upsertBuilderProfile(
  tx: Prisma.TransactionClient,
  options: {
    resumeId: string;
    content: ResumeBuilderContent;
    defaultEmail?: string | null;
  },
) {
  const { basic, contacts, profession, salary, workConditions } =
    options.content.wizard;
  const salaryAmount = salary.amount ? Number(salary.amount) : null;
  const profile = await tx.resumeBuilderProfile.upsert({
    where: {
      resumeId: options.resumeId,
    },
    create: {
      resumeId: options.resumeId,
      currentStep: options.content.wizard.currentStep,
      profession,
      lastName: basic.lastName,
      firstName: basic.firstName,
      middleName: basic.middleName,
      gender: basic.gender,
      city: basic.city,
      birthDay: basic.birthDay,
      birthMonth: basic.birthMonth,
      birthYear: basic.birthYear,
      citizenship: basic.citizenship,
      workPermit: basic.workPermit,
      contactPhone: contacts.phone,
      contactEmail: contacts.email || options.defaultEmail || "",
      contactTelegram: contacts.telegram,
      contactMax: contacts.max,
      contactVk: contacts.vk,
      contactWhatsapp: contacts.whatsapp,
      contactComment: contacts.comment,
      salaryAmount,
      salaryCurrency: salary.currency,
      employmentTypes: workConditions.employmentTypes,
      workFormats: workConditions.workFormats,
      contractTypes: workConditions.contractTypes,
      about: options.content.wizard.about as unknown as Prisma.InputJsonValue,
    },
    update: {
      currentStep: options.content.wizard.currentStep,
      profession,
      lastName: basic.lastName,
      firstName: basic.firstName,
      middleName: basic.middleName,
      gender: basic.gender,
      city: basic.city,
      birthDay: basic.birthDay,
      birthMonth: basic.birthMonth,
      birthYear: basic.birthYear,
      citizenship: basic.citizenship,
      workPermit: basic.workPermit,
      contactPhone: contacts.phone,
      contactEmail: contacts.email,
      contactTelegram: contacts.telegram,
      contactMax: contacts.max,
      contactVk: contacts.vk,
      contactWhatsapp: contacts.whatsapp,
      contactComment: contacts.comment,
      salaryAmount,
      salaryCurrency: salary.currency,
      employmentTypes: workConditions.employmentTypes,
      workFormats: workConditions.workFormats,
      contractTypes: workConditions.contractTypes,
      about: options.content.wizard.about as unknown as Prisma.InputJsonValue,
    },
    select: {
      id: true,
    },
  });

  await tx.resumeBuilderEducationEntry.deleteMany({
    where: {
      profileId: profile.id,
    },
  });
  await tx.resumeBuilderExperienceEntry.deleteMany({
    where: {
      profileId: profile.id,
    },
  });
  await tx.resumeBuilderSkill.deleteMany({
    where: {
      profileId: profile.id,
    },
  });

  const educationEntries = [
    ...options.content.wizard.education.map((item, sortOrder) => ({
      profileId: profile.id,
      kind: "main" as const,
      sortOrder,
      level: item.level,
      institution: item.institution,
      faculty: item.faculty,
      specialization: item.specialization,
      graduationYear: item.graduationYear,
      activities: item.activities as unknown as Prisma.InputJsonValue,
    })),
    ...options.content.wizard.additionalEducation.map((item, sortOrder) => ({
      profileId: profile.id,
      kind: "additional" as const,
      sortOrder,
      level: item.level,
      institution: item.institution,
      faculty: item.faculty,
      specialization: item.specialization,
      graduationYear: item.graduationYear,
      activities: item.activities as unknown as Prisma.InputJsonValue,
    })),
  ];

  if (educationEntries.length) {
    await tx.resumeBuilderEducationEntry.createMany({
      data: educationEntries,
    });
  }

  if (options.content.wizard.experience.length) {
    await tx.resumeBuilderExperienceEntry.createMany({
      data: options.content.wizard.experience.map((item, sortOrder) => ({
        profileId: profile.id,
        sortOrder,
        company: item.company,
        position: item.position,
        startMonth: item.startMonth,
        startYear: item.startYear,
        endMonth: item.endMonth,
        endYear: item.endYear,
        current: item.current,
        description: item.description as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  if (options.content.wizard.skills.length) {
    await tx.resumeBuilderSkill.createMany({
      data: options.content.wizard.skills.map((value, sortOrder) => ({
        profileId: profile.id,
        value,
        sortOrder,
      })),
    });
  }
}

async function findOwnedBuilderResume(
  userId: string,
  resumeId: string,
) {
  const resume = await findOwnedResume(userId, resumeId);

  getBuilderContentFromResume(resume);

  return resume;
}

function getBuilderPhotoFile(resume: ResumeWithRelations) {
  const photoFile = resume.builderProfile?.photoFile;

  if (!photoFile) {
    throw new NotFoundException("Фотография резюме не найдена.");
  }

  return photoFile;
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function getBuilderExportPhoto(
  resume: ResumeWithRelations,
): Promise<ResumeBuilderExportPhoto> {
  const photoFile = resume.builderProfile?.photoFile;

  if (!photoFile) {
    return null;
  }

  try {
    const sourceFile = await getResumePhotoFile(photoFile.objectKey);

    return {
      buffer: await streamToBuffer(sourceFile.body),
      mimeType: photoFile.mimeType,
      positionX: resume.builderProfile?.photoPositionX ?? 50,
      positionY: resume.builderProfile?.photoPositionY ?? 50,
      scale: resume.builderProfile?.photoScale ?? 1,
    };
  } catch {
    return null;
  }
}

async function deleteResumeFileObjectBestEffort(objectKey: string | null | undefined) {
  if (!objectKey) {
    return;
  }

  try {
    await deleteResumeFileObject(objectKey);
  } catch {
    // The DB state is the source of truth; object cleanup should not break UX.
  }
}

async function createBuilderDraft(user: AuthenticatedAppUser) {
  const content = createEmptyResumeBuilderContent();
  const contentWithEmail: ResumeBuilderContent = {
    ...content,
    wizard: {
      ...content.wizard,
      contacts: {
        ...content.wizard.contacts,
        email: user.email,
      },
    },
  };
  const plainText = resumeBuilderContentToPlainText(contentWithEmail);
  const title = getResumeBuilderTitle(contentWithEmail);

  return prisma.$transaction(async (tx) => {
    const resume = await tx.resume.create({
      data: {
        userId: user.id,
        title,
        status: "draft",
      },
    });
    const version = await tx.resumeVersion.create({
      data: {
        resumeId: resume.id,
        source: "builder",
        plainText,
        summary: plainText.slice(0, 600),
        content: Prisma.DbNull,
      },
    });
    await upsertBuilderProfile(tx, {
      resumeId: resume.id,
      content: contentWithEmail,
      defaultEmail: user.email,
    });

    return tx.resume.update({
      where: {
        id: resume.id,
      },
      data: {
        currentVersionId: version.id,
      },
      include: {
        originalFile: true,
        exportFile: true,
        builderProfile: builderProfileInclude,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });
  });
}

async function saveBuilderContentToResume(
  resume: ResumeWithRelations,
  content: ResumeBuilderContent,
  defaultEmail?: string | null,
) {
  const currentVersion = resume.versions[0] ?? null;
  const plainText = resumeBuilderContentToPlainText(content);
  const summary = plainText.slice(0, 600);
  const title = getResumeBuilderTitle(content);

  return prisma.$transaction(async (tx) => {
    await upsertBuilderProfile(tx, {
      resumeId: resume.id,
      content,
      defaultEmail,
    });

    const version =
      currentVersion?.source === "builder"
        ? await tx.resumeVersion.update({
            where: {
              id: currentVersion.id,
            },
            data: {
              plainText,
              summary,
              content: Prisma.DbNull,
            },
          })
        : await tx.resumeVersion.create({
            data: {
              resumeId: resume.id,
              source: "builder",
              plainText,
              summary,
              content: Prisma.DbNull,
            },
          });

    return tx.resume.update({
      where: {
        id: resume.id,
      },
      data: {
        title,
        status: "draft",
        exportFileId: null,
        currentVersionId: version.id,
        processingError: null,
      },
      include: {
        originalFile: true,
        exportFile: true,
        builderProfile: builderProfileInclude,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });
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
        exportFile: true,
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

  @Post("resumes/builder-drafts")
  @HttpCode(200)
  async ensureBuilderDraft(@CurrentUser() user: AuthenticatedAppUser) {
    const existing = await prisma.resume.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        status: "draft",
        exportFileId: null,
        builderProfile: {
          isNot: null,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        originalFile: true,
        exportFile: true,
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        builderProfile: builderProfileInclude,
      },
    });
    if (!existing) {
      try {
        await assertQuota(user.id, "resume_slot");
      } catch (error) {
        throwIfQuotaExceeded(error);
      }
    }

    const resume = existing ?? (await createBuilderDraft(user));

    return {
      item: serializeResume(resume),
      content: getBuilderContentFromResume(resume),
      photoFile: serializeFileAsset(resume.builderProfile?.photoFile),
      photoSettings: getBuilderPhotoSettings(resume.builderProfile),
    };
  }

  @Post("resumes")
  async createResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Body() body: unknown,
  ) {
    const parsed = createResumeSchema.parse(body);
    try {
      await assertQuota(user.id, "resume_slot");
    } catch (error) {
      throwIfQuotaExceeded(error);
    }
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
    try {
      await assertQuota(user.id, "resume_slot");
    } catch (error) {
      throwIfQuotaExceeded(error);
    }

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
            exportFile: true,
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
          exportFile: true,
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

  @Get("resumes/:resumeId/builder")
  async getBuilderResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
  ) {
    const resume = await findOwnedBuilderResume(user.id, resumeId);

    return {
      item: serializeResume(resume),
      content: getBuilderContentFromResume(resume),
      photoFile: serializeFileAsset(resume.builderProfile?.photoFile),
      photoSettings: getBuilderPhotoSettings(resume.builderProfile),
    };
  }

  @Get("resumes/:resumeId/builder/export")
  async exportBuilderResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { format } = parseBuilderExportQuery(query);
    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const content = getBuilderContentFromResume(resume);
    const photo = format === "txt" ? null : await getBuilderExportPhoto(resume);
    const buffer =
      format === "pdf"
        ? await generateResumeBuilderPdf({ content, photo })
        : format === "docx"
          ? await generateResumeBuilderDocx({ content, photo })
          : generateResumeBuilderTxt(content);

    setResumeBuilderExportHeaders(response, {
      contentLength: buffer.length,
      format,
      title: resume.title || getResumeBuilderTitle(content),
    });

    return new StreamableFile(buffer);
  }

  @Put("resumes/:resumeId/builder")
  async saveBuilderResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Body() body: unknown,
  ) {
    const parsed = saveResumeBuilderSchema.parse(body);
    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const updated = await saveBuilderContentToResume(
      resume,
      parsed.content,
      user.email,
    );

    return {
      item: serializeResume(updated),
      content: getBuilderContentFromResume(updated),
      photoFile: serializeFileAsset(updated.builderProfile?.photoFile),
      photoSettings: getBuilderPhotoSettings(updated.builderProfile),
    };
  }

  @Post("resumes/:resumeId/builder/finalize")
  @HttpCode(200)
  async finalizeBuilderResume(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Body() body: unknown,
  ) {
    const parsed = finalizeResumeBuilderSchema.parse(body);
    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const content = parsed?.content ?? getBuilderContentFromResume(resume);
    const savedResume = parsed?.content
      ? await saveBuilderContentToResume(resume, parsed.content, user.email)
      : resume;
    const title = getResumeBuilderTitle(content);
    const plainText = resumeBuilderContentToPlainText(content);

    const updated = await prisma.$transaction(async (tx) => {
      await upsertBuilderProfile(tx, {
        resumeId: savedResume.id,
        content,
        defaultEmail: user.email,
      });
      const currentVersion = savedResume.versions[0] ?? null;
      const version =
        currentVersion?.source === "builder"
          ? await tx.resumeVersion.update({
              where: {
              id: currentVersion.id,
            },
            data: {
              plainText,
              summary: plainText.slice(0, 600),
              content: Prisma.DbNull,
            },
          })
          : await tx.resumeVersion.create({
              data: {
                resumeId: savedResume.id,
                source: "builder",
                plainText,
                summary: plainText.slice(0, 600),
                content: Prisma.DbNull,
              },
            });

      return tx.resume.update({
        where: {
          id: savedResume.id,
        },
        data: {
          title,
          status: "uploaded",
          exportFileId: null,
          currentVersionId: version.id,
          processingError: null,
        },
        include: {
          originalFile: true,
          exportFile: true,
          builderProfile: builderProfileInclude,
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
      content: getBuilderContentFromResume(updated),
      photoFile: serializeFileAsset(updated.builderProfile?.photoFile),
      photoSettings: getBuilderPhotoSettings(updated.builderProfile),
    };
  }

  @Head("resumes/:resumeId/builder/photo")
  async headBuilderPhoto(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const photoFile = getBuilderPhotoFile(resume);

    try {
      const sourceFile = await headResumePhotoFile(photoFile.objectKey);

      setResumePhotoHeaders(response, {
        mimeType: photoFile.mimeType,
        contentType: sourceFile.contentType,
        contentLength: sourceFile.contentLength,
      });
    } catch {
      throw new NotFoundException("Фотография резюме не найдена.");
    }
  }

  @Get("resumes/:resumeId/builder/photo")
  async getBuilderPhoto(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const photoFile = getBuilderPhotoFile(resume);

    try {
      const sourceFile = await getResumePhotoFile(photoFile.objectKey);

      setResumePhotoHeaders(response, {
        mimeType: photoFile.mimeType,
        contentType: sourceFile.contentType,
        contentLength: sourceFile.contentLength,
      });

      return new StreamableFile(sourceFile.body);
    } catch {
      throw new NotFoundException("Фотография резюме не найдена.");
    }
  }

  @Post("resumes/:resumeId/builder/photo")
  @HttpCode(200)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
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
        fileSize: maxResumePhotoSizeBytes,
      },
    }),
  )
  async uploadBuilderPhoto(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("Файл фотографии обязателен.");
    }

    if (!supportedResumePhotoMimeTypes.has(file.mimetype)) {
      throw new BadRequestException("Поддерживаются только JPEG, PNG и WebP.");
    }

    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const previousPhotoFile = resume.builderProfile?.photoFile ?? null;
    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const uploaded = await uploadResumePhotoFile({
      ownerId: user.id,
      fileName: normalizeUploadedFileName(file.originalname || "photo"),
      contentType: file.mimetype,
      body: file.buffer,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const fileAsset = await tx.fileAsset.create({
        data: {
          ownerId: user.id,
          bucket: uploaded.bucket,
          objectKey: uploaded.objectKey,
          mimeType: file.mimetype,
          size: file.size,
          purpose: "resume_photo",
          checksum,
        },
      });

      await tx.resumeBuilderProfile.update({
        where: {
          id: resume.builderProfile!.id,
        },
        data: {
          photoFileId: fileAsset.id,
          photoPositionX: 50,
          photoPositionY: 50,
          photoScale: 1,
        },
      });

      if (previousPhotoFile) {
        await tx.fileAsset.delete({
          where: {
            id: previousPhotoFile.id,
          },
        });
      }

      return tx.resume.findUniqueOrThrow({
        where: {
          id: resume.id,
        },
        include: {
          originalFile: true,
          exportFile: true,
          builderProfile: builderProfileInclude,
          versions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });
    });

    await deleteResumeFileObjectBestEffort(previousPhotoFile?.objectKey);

    return {
      photoFile: serializeFileAsset(updated.builderProfile?.photoFile),
      photoSettings: getBuilderPhotoSettings(updated.builderProfile),
    };
  }

  @Patch("resumes/:resumeId/builder/photo")
  async updateBuilderPhotoSettings(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateResumeBuilderPhotoSettingsSchema.parse(body);
    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const previousPhotoFile = resume.builderProfile?.photoFile ?? null;

    if (!previousPhotoFile) {
      throw new NotFoundException("Фотография резюме не найдена.");
    }

    const updated = await prisma.resumeBuilderProfile.update({
      where: {
        id: resume.builderProfile!.id,
      },
      data: {
        photoPositionX: Math.round(parsed.positionX),
        photoPositionY: Math.round(parsed.positionY),
        photoScale: parsed.scale,
      },
      include: {
        photoFile: true,
        educationEntries: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        experienceEntries: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        skills: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return {
      photoFile: serializeFileAsset(updated.photoFile),
      photoSettings: getBuilderPhotoSettings(updated),
    };
  }

  @Delete("resumes/:resumeId/builder/photo")
  async deleteBuilderPhoto(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
  ) {
    const resume = await findOwnedBuilderResume(user.id, resumeId);
    const previousPhotoFile = resume.builderProfile?.photoFile ?? null;

    if (!previousPhotoFile) {
      return {
        photoFile: null,
        photoSettings: getBuilderPhotoSettings(resume.builderProfile),
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.resumeBuilderProfile.update({
        where: {
          id: resume.builderProfile!.id,
        },
        data: {
          photoFileId: null,
          photoPositionX: 50,
          photoPositionY: 50,
          photoScale: 1,
        },
      });
      await tx.fileAsset.delete({
        where: {
          id: previousPhotoFile.id,
        },
      });
    });

    await deleteResumeFileObjectBestEffort(previousPhotoFile.objectKey);

    return {
      photoFile: null,
      photoSettings: {
        positionX: 50,
        positionY: 50,
        scale: 1,
      },
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
        exportFile: true,
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
            exportFile: true,
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
          exportFile: true,
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
        exportFile: true,
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
        exportFile: true,
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
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsedQuery = parseSourceFileQuery(query);
    const resume = await findOwnedResume(user.id, resumeId);
    const servedFile = resume.exportFile ?? resume.originalFile;

    if (!servedFile) {
      throw new NotFoundException("Исходный файл не найден.");
    }

    try {
      const sourceFile = await headResumeSourceFile(
        servedFile.objectKey,
      );

      setResumeSourceFileHeaders(response, {
        title: resume.title,
        mimeType: servedFile.mimeType,
        contentType: sourceFile.contentType,
        contentLength: sourceFile.contentLength,
        disposition: parsedQuery.disposition,
      });
    } catch {
      throw new NotFoundException("Исходный файл не найден.");
    }
  }

  @Get("resumes/:resumeId/source-file")
  async getSourceFile(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("resumeId") resumeId: string,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsedQuery = parseSourceFileQuery(query);
    const resume = await findOwnedResume(user.id, resumeId);
    const servedFile = resume.exportFile ?? resume.originalFile;

    if (!servedFile) {
      throw new NotFoundException("Исходный файл не найден.");
    }

    try {
      const sourceFile = await getResumeSourceFile(
        servedFile.objectKey,
      );

      setResumeSourceFileHeaders(response, {
        title: resume.title,
        mimeType: servedFile.mimeType,
        contentType: sourceFile.contentType,
        contentLength: sourceFile.contentLength,
        disposition: parsedQuery.disposition,
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
