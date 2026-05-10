CREATE TABLE "AutoResponseSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "defaultResumeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoResponseSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutoResponseSettings_userId_key"
ON "AutoResponseSettings"("userId");

ALTER TABLE "AutoResponseSettings"
ADD CONSTRAINT "AutoResponseSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutoResponseSettings"
ADD CONSTRAINT "AutoResponseSettings_defaultResumeId_fkey"
FOREIGN KEY ("defaultResumeId") REFERENCES "Resume"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
