ALTER TABLE "IndividualResponseArtifact"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "vacancyUrl" TEXT,
ADD COLUMN "vacancyTitle" TEXT,
ADD COLUMN "employerName" TEXT;

CREATE INDEX "IndividualResponseArtifact_source_createdAt_idx"
ON "IndividualResponseArtifact"("source", "createdAt");
