CREATE TYPE "LegalDocumentKind" AS ENUM (
  'terms',
  'privacy_policy',
  'personal_data_consent',
  'offer',
  'refund_policy',
  'cookie_policy'
);

CREATE TYPE "PrivacyRequestKind" AS ENUM (
  'export_data',
  'delete_account',
  'correct_data',
  'restrict_processing'
);

CREATE TYPE "PrivacyRequestStatus" AS ENUM (
  'submitted',
  'processing',
  'completed',
  'rejected'
);

CREATE TABLE "LegalDocumentVersion" (
  "id" TEXT NOT NULL,
  "kind" "LegalDocumentKind" NOT NULL,
  "slug" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserConsentAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "kind" "LegalDocumentKind" NOT NULL,
  "version" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'web',
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserConsentAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPrivacyRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "PrivacyRequestKind" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'submitted',
  "message" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "UserPrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalDocumentVersion_kind_version_key" ON "LegalDocumentVersion"("kind", "version");
CREATE UNIQUE INDEX "LegalDocumentVersion_slug_version_key" ON "LegalDocumentVersion"("slug", "version");
CREATE INDEX "LegalDocumentVersion_kind_active_idx" ON "LegalDocumentVersion"("kind", "active");
CREATE INDEX "LegalDocumentVersion_slug_active_idx" ON "LegalDocumentVersion"("slug", "active");

CREATE UNIQUE INDEX "UserConsentAcceptance_userId_documentVersionId_key" ON "UserConsentAcceptance"("userId", "documentVersionId");
CREATE INDEX "UserConsentAcceptance_userId_kind_acceptedAt_idx" ON "UserConsentAcceptance"("userId", "kind", "acceptedAt");

CREATE INDEX "UserPrivacyRequest_userId_createdAt_idx" ON "UserPrivacyRequest"("userId", "createdAt");
CREATE INDEX "UserPrivacyRequest_status_createdAt_idx" ON "UserPrivacyRequest"("status", "createdAt");

ALTER TABLE "UserConsentAcceptance"
  ADD CONSTRAINT "UserConsentAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserConsentAcceptance"
  ADD CONSTRAINT "UserConsentAcceptance_documentVersionId_fkey"
  FOREIGN KEY ("documentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserPrivacyRequest"
  ADD CONSTRAINT "UserPrivacyRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
