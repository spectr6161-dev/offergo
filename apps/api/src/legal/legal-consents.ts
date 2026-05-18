import { UnprocessableEntityException } from "@nestjs/common";
import type { Request } from "express";
import { prisma } from "@offergo/db";
import {
  getLegalDocumentDefinitionBySlug,
  legalDocumentsPublicBasePath,
  requiredLegalConsentKinds,
} from "@offergo/shared";

export const requiredConsentKinds = requiredLegalConsentKinds;

export type LegalDocumentSummary = {
  id: string;
  kind: string;
  slug: string;
  version: string;
  title: string;
  summary: string | null;
  active: boolean;
  publishedAt: string;
};

function getDownloadUrls(slug: string) {
  const definition = getLegalDocumentDefinitionBySlug(slug);

  if (!definition) {
    return null;
  }

  return {
    docx: `${legalDocumentsPublicBasePath}/${definition.docxFile}`,
    txt: `${legalDocumentsPublicBasePath}/${definition.txtFile}`,
  };
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

function getUserAgent(request: Request) {
  const userAgent = request.headers["user-agent"];
  return typeof userAgent === "string" ? userAgent : null;
}

export async function getActiveRequiredDocuments() {
  const documents = await prisma.legalDocumentVersion.findMany({
    where: {
      kind: {
        in: [...requiredConsentKinds],
      },
      active: true,
    },
    orderBy: {
      kind: "asc",
    },
  });

  const byKind = new Map(documents.map((document) => [document.kind, document]));
  const missingKinds = requiredConsentKinds.filter((kind) => !byKind.has(kind));

  if (missingKinds.length > 0) {
    throw new Error(
      `Active legal documents are not configured: ${missingKinds.join(", ")}`,
    );
  }

  return documents;
}

export function toDocumentResponse(document: {
  id: string;
  kind: string;
  slug: string;
  version: string;
  title: string;
  summary: string | null;
  content: string;
  active: boolean;
  publishedAt: Date;
}) {
  return {
    id: document.id,
    kind: document.kind,
    slug: document.slug,
    version: document.version,
    title: document.title,
    summary: document.summary,
    content: document.content,
    active: document.active,
    publishedAt: document.publishedAt.toISOString(),
    downloads: getDownloadUrls(document.slug),
  };
}

export function toDocumentSummary(document: {
  id: string;
  kind: string;
  slug: string;
  version: string;
  title: string;
  summary: string | null;
  active: boolean;
  publishedAt: Date | string;
}): LegalDocumentSummary {
  return {
    id: document.id,
    kind: document.kind,
    slug: document.slug,
    version: document.version,
    title: document.title,
    summary: document.summary,
    active: document.active,
    publishedAt:
      document.publishedAt instanceof Date
        ? document.publishedAt.toISOString()
        : document.publishedAt,
  };
}

export async function getConsentStatusForUser(userId: string) {
  const documents = await getActiveRequiredDocuments();
  const accepted = await prisma.userConsentAcceptance.findMany({
    where: {
      userId,
      documentVersionId: {
        in: documents.map((document) => document.id),
      },
    },
    select: {
      documentVersionId: true,
      acceptedAt: true,
    },
  });
  const acceptedByDocumentId = new Map(
    accepted.map((entry) => [entry.documentVersionId, entry]),
  );
  const missingDocuments = documents.filter(
    (document) => !acceptedByDocumentId.has(document.id),
  );

  return {
    ok: missingDocuments.length === 0,
    requiredDocuments: documents.map((document) => ({
      ...toDocumentResponse(document),
      acceptedAt:
        acceptedByDocumentId.get(document.id)?.acceptedAt.toISOString() ??
        null,
    })),
    missingDocuments: missingDocuments.map(toDocumentResponse),
  };
}

export function assertAcceptedDocumentIds(
  documents: Awaited<ReturnType<typeof getActiveRequiredDocuments>>,
  acceptedDocumentIds: string[],
) {
  const acceptedSet = new Set(acceptedDocumentIds);
  const missingDocuments = documents.filter(
    (document) => !acceptedSet.has(document.id),
  );

  if (missingDocuments.length > 0) {
    throw new UnprocessableEntityException({
      code: "missing_legal_documents",
      message: "Accept all required legal documents.",
      details: missingDocuments.map(toDocumentSummary),
    });
  }
}

export async function acceptUserConsents(options: {
  userId: string;
  source: string;
  request: Request;
  documentIds?: string[];
}) {
  const documents = await getActiveRequiredDocuments();

  if (options.documentIds) {
    assertAcceptedDocumentIds(documents, options.documentIds);
  }

  const now = new Date();
  const ipAddress = getClientIp(options.request);
  const userAgent = getUserAgent(options.request);

  await prisma.$transaction(
    documents.map((document) =>
      prisma.userConsentAcceptance.upsert({
        where: {
          userId_documentVersionId: {
            userId: options.userId,
            documentVersionId: document.id,
          },
        },
        update: {},
        create: {
          userId: options.userId,
          documentVersionId: document.id,
          kind: document.kind,
          version: document.version,
          source: options.source,
          ipAddress,
          userAgent,
          acceptedAt: now,
        },
      }),
    ),
  );

  return now;
}
