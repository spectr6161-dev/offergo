ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'resume_photo';

ALTER TABLE "ResumeBuilderProfile"
ADD COLUMN "photoFileId" TEXT;

CREATE UNIQUE INDEX "ResumeBuilderProfile_photoFileId_key"
ON "ResumeBuilderProfile"("photoFileId");

ALTER TABLE "ResumeBuilderProfile"
ADD CONSTRAINT "ResumeBuilderProfile_photoFileId_fkey"
FOREIGN KEY ("photoFileId") REFERENCES "FileAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
