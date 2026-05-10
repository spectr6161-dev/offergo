CREATE TYPE "IndividualResponseDecision" AS ENUM ('matched', 'mismatch');

CREATE TABLE "IndividualResponseArtifact" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "resumeTitle" TEXT NOT NULL,
  "vacancyText" TEXT NOT NULL,
  "matchScore" INTEGER NOT NULL,
  "decision" "IndividualResponseDecision" NOT NULL,
  "coverLetter" TEXT,
  "summary" TEXT NOT NULL DEFAULT '',
  "strengths" JSONB NOT NULL,
  "weaknesses" JSONB NOT NULL,
  "recommendations" JSONB NOT NULL,
  "modelId" TEXT,
  "rawResult" JSONB NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IndividualResponseArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IndividualResponseArtifact_userId_deletedAt_updatedAt_idx"
ON "IndividualResponseArtifact"("userId", "deletedAt", "updatedAt");

CREATE INDEX "IndividualResponseArtifact_resumeId_idx"
ON "IndividualResponseArtifact"("resumeId");

ALTER TABLE "IndividualResponseArtifact"
ADD CONSTRAINT "IndividualResponseArtifact_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IndividualResponseArtifact"
ADD CONSTRAINT "IndividualResponseArtifact_resumeId_fkey"
FOREIGN KEY ("resumeId") REFERENCES "Resume"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
