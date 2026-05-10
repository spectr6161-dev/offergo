import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { prisma } from "@offergo/db";
import { deleteResumeFileObject } from "../resumes/resume-storage";

const dayMs = 24 * 60 * 60 * 1000;
const retentionDays = 30;

type FileReference = {
  id: string;
  objectKey: string;
};

function getCutoffDate() {
  return new Date(Date.now() - retentionDays * dayMs);
}

async function deleteFilesBestEffort(files: FileReference[]) {
  const uniqueFiles = [...new Map(files.map((file) => [file.id, file])).values()];

  if (uniqueFiles.length === 0) {
    return;
  }

  await prisma.fileAsset.deleteMany({
    where: {
      id: {
        in: uniqueFiles.map((file) => file.id),
      },
    },
  });

  await Promise.allSettled(
    uniqueFiles.map((file) => deleteResumeFileObject(file.objectKey)),
  );
}

@Injectable()
export class LegalRetentionService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runRetention().catch(() => undefined);
    }, dayMs);

    void this.runRetention().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async purgeOldLiveSessions(cutoff: Date) {
    const sessions = await prisma.liveSession.findMany({
      where: {
        startedAt: {
          lt: cutoff,
        },
      },
      include: {
        screenshots: {
          include: {
            fileAsset: {
              select: {
                id: true,
                objectKey: true,
              },
            },
          },
        },
      },
      take: 500,
    });

    if (sessions.length === 0) {
      return;
    }

    const files = sessions.flatMap((session) =>
      session.screenshots.map((screenshot) => screenshot.fileAsset),
    );

    await prisma.liveSession.deleteMany({
      where: {
        id: {
          in: sessions.map((session) => session.id),
        },
      },
    });
    await deleteFilesBestEffort(files);
  }

  private async purgeDeletedResumes(cutoff: Date) {
    const resumes = await prisma.resume.findMany({
      where: {
        deletedAt: {
          lt: cutoff,
        },
      },
      include: {
        originalFile: {
          select: {
            id: true,
            objectKey: true,
          },
        },
        exportFile: {
          select: {
            id: true,
            objectKey: true,
          },
        },
        builderProfile: {
          include: {
            photoFile: {
              select: {
                id: true,
                objectKey: true,
              },
            },
          },
        },
      },
      take: 500,
    });

    if (resumes.length === 0) {
      return;
    }

    const files = resumes.flatMap((resume) =>
      [
        resume.originalFile,
        resume.exportFile,
        resume.builderProfile?.photoFile ?? null,
      ].filter((file): file is FileReference => Boolean(file)),
    );

    await prisma.resume.deleteMany({
      where: {
        id: {
          in: resumes.map((resume) => resume.id),
        },
      },
    });
    await deleteFilesBestEffort(files);
  }

  async runRetention() {
    const cutoff = getCutoffDate();

    await this.purgeOldLiveSessions(cutoff);
    await this.purgeDeletedResumes(cutoff);
  }
}
