CREATE TYPE "VacancyStatus" AS ENUM ('published', 'hidden');

CREATE TABLE "Vacancy" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'external_import',
  "title" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "categoryName" TEXT NOT NULL,
  "categorySlug" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "salaryText" TEXT,
  "salaryValue" INTEGER,
  "salaryCurrency" TEXT,
  "workFormat" TEXT,
  "location" TEXT,
  "datePosted" TIMESTAMP(3),
  "employmentType" TEXT,
  "directApply" BOOLEAN NOT NULL DEFAULT false,
  "applyButtonLabel" TEXT,
  "applyDirectKind" TEXT,
  "description" TEXT NOT NULL,
  "skillsText" TEXT,
  "qualificationsText" TEXT,
  "benefitsText" TEXT,
  "url" TEXT,
  "status" "VacancyStatus" NOT NULL DEFAULT 'published',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vacancy_source_externalId_key" ON "Vacancy"("source", "externalId");
CREATE INDEX "Vacancy_status_datePosted_idx" ON "Vacancy"("status", "datePosted");
CREATE INDEX "Vacancy_categorySlug_idx" ON "Vacancy"("categorySlug");
CREATE INDEX "Vacancy_level_idx" ON "Vacancy"("level");
CREATE INDEX "Vacancy_salaryValue_idx" ON "Vacancy"("salaryValue");
CREATE INDEX "Vacancy_location_idx" ON "Vacancy"("location");
CREATE INDEX "Vacancy_workFormat_idx" ON "Vacancy"("workFormat");
CREATE INDEX "Vacancy_companyName_idx" ON "Vacancy"("companyName");
