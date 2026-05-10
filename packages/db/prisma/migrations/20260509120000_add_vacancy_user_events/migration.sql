CREATE TYPE "VacancyUserEventType" AS ENUM (
  'view_detail',
  'open_source',
  'cover_letter_start',
  'application_confirmed'
);

CREATE TABLE "VacancyUserEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vacancyId" TEXT NOT NULL,
  "type" "VacancyUserEventType" NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'web',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VacancyUserEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VacancyUserEvent"
  ADD CONSTRAINT "VacancyUserEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VacancyUserEvent"
  ADD CONSTRAINT "VacancyUserEvent_vacancyId_fkey"
  FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "VacancyUserEvent_userId_type_createdAt_idx"
  ON "VacancyUserEvent"("userId", "type", "createdAt");

CREATE INDEX "VacancyUserEvent_vacancyId_type_createdAt_idx"
  ON "VacancyUserEvent"("vacancyId", "type", "createdAt");

CREATE INDEX "VacancyUserEvent_userId_vacancyId_type_createdAt_idx"
  ON "VacancyUserEvent"("userId", "vacancyId", "type", "createdAt");
