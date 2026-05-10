CREATE TYPE "BillingFeature" AS ENUM (
  'wpf_audio_seconds',
  'wpf_screenshot',
  'wpf_text_request',
  'resume_slot',
  'resume_analysis',
  'individual_response'
);

CREATE TYPE "UsageEventKind" AS ENUM (
  'reserve',
  'consume',
  'release',
  'adjust'
);

ALTER TABLE "Plan"
  ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "checkoutEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PlanLimit" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "planId" TEXT NOT NULL,
  "feature" "BillingFeature" NOT NULL,
  "limit" INTEGER,
  "fairUseLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageCounter" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "feature" "BillingFeature" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "feature" "BillingFeature" NOT NULL,
  "kind" "UsageEventKind" NOT NULL,
  "delta" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanLimit_planId_feature_key" ON "PlanLimit"("planId", "feature");
CREATE INDEX "PlanLimit_feature_idx" ON "PlanLimit"("feature");
CREATE UNIQUE INDEX "UsageCounter_userId_feature_periodStart_periodEnd_key" ON "UsageCounter"("userId", "feature", "periodStart", "periodEnd");
CREATE INDEX "UsageCounter_userId_periodEnd_idx" ON "UsageCounter"("userId", "periodEnd");
CREATE INDEX "UsageEvent_userId_feature_createdAt_idx" ON "UsageEvent"("userId", "feature", "createdAt");
CREATE INDEX "UsageEvent_periodEnd_idx" ON "UsageEvent"("periodEnd");

ALTER TABLE "PlanLimit" ADD CONSTRAINT "PlanLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Plan"
SET
  code = 'basic-monthly',
  name = 'Базовый',
  description = 'Для регулярной работы с резюме, откликами и WPF-помощником.',
  "priceRub" = 599,
  "subscriptionType" = 'basic',
  "durationDays" = 30,
  "rank" = 10,
  "displayOrder" = 20,
  "checkoutEnabled" = true,
  "active" = true
WHERE code = 'starter-monthly';

UPDATE "Plan"
SET
  code = 'comfort-monthly',
  name = 'Комфортный',
  description = 'Больше лимитов для активного поиска работы и длительных live-сессий.',
  "priceRub" = 1199,
  "subscriptionType" = 'comfort',
  "durationDays" = 30,
  "rank" = 20,
  "displayOrder" = 30,
  "checkoutEnabled" = true,
  "active" = true
WHERE code = 'pro-monthly';

UPDATE "Plan"
SET
  code = 'unlimited-monthly',
  name = 'Безлимитный',
  description = 'Максимальные возможности с fair-use защитой от злоупотреблений.',
  "priceRub" = 2999,
  "subscriptionType" = 'unlimited',
  "durationDays" = 30,
  "rank" = 30,
  "displayOrder" = 40,
  "checkoutEnabled" = true,
  "active" = true
WHERE code = 'max-monthly';

INSERT INTO "Plan" (id, code, name, description, "priceRub", "subscriptionType", "durationDays", "rank", "displayOrder", "checkoutEnabled", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'free', 'Бесплатный', 'Стартовый доступ с базовыми лимитами.', 0, 'free', 30, 0, 10, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'basic-monthly', 'Базовый', 'Для регулярной работы с резюме, откликами и WPF-помощником.', 599, 'basic', 30, 10, 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'comfort-monthly', 'Комфортный', 'Больше лимитов для активного поиска работы и длительных live-сессий.', 1199, 'comfort', 30, 20, 30, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'unlimited-monthly', 'Безлимитный', 'Максимальные возможности с fair-use защитой от злоупотреблений.', 2999, 'unlimited', 30, 30, 40, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "priceRub" = EXCLUDED."priceRub",
  "subscriptionType" = EXCLUDED."subscriptionType",
  "durationDays" = EXCLUDED."durationDays",
  "rank" = EXCLUDED."rank",
  "displayOrder" = EXCLUDED."displayOrder",
  "checkoutEnabled" = EXCLUDED."checkoutEnabled",
  "active" = EXCLUDED."active",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH limits(code, feature, hard_limit, fair_use_limit) AS (
  VALUES
    ('free', 'wpf_audio_seconds'::"BillingFeature", 900, NULL),
    ('free', 'wpf_screenshot'::"BillingFeature", 3, NULL),
    ('free', 'wpf_text_request'::"BillingFeature", 25, NULL),
    ('free', 'resume_slot'::"BillingFeature", 1, NULL),
    ('free', 'resume_analysis'::"BillingFeature", 0, NULL),
    ('free', 'individual_response'::"BillingFeature", 3, NULL),
    ('basic-monthly', 'wpf_audio_seconds'::"BillingFeature", 10800, NULL),
    ('basic-monthly', 'wpf_screenshot'::"BillingFeature", 25, NULL),
    ('basic-monthly', 'wpf_text_request'::"BillingFeature", 500, NULL),
    ('basic-monthly', 'resume_slot'::"BillingFeature", 5, NULL),
    ('basic-monthly', 'resume_analysis'::"BillingFeature", 2, NULL),
    ('basic-monthly', 'individual_response'::"BillingFeature", 50, NULL),
    ('comfort-monthly', 'wpf_audio_seconds'::"BillingFeature", 36000, NULL),
    ('comfort-monthly', 'wpf_screenshot'::"BillingFeature", 150, NULL),
    ('comfort-monthly', 'wpf_text_request'::"BillingFeature", 2000, NULL),
    ('comfort-monthly', 'resume_slot'::"BillingFeature", 15, NULL),
    ('comfort-monthly', 'resume_analysis'::"BillingFeature", 7, NULL),
    ('comfort-monthly', 'individual_response'::"BillingFeature", 200, NULL),
    ('unlimited-monthly', 'wpf_audio_seconds'::"BillingFeature", NULL, 180000),
    ('unlimited-monthly', 'wpf_screenshot'::"BillingFeature", NULL, 1000),
    ('unlimited-monthly', 'wpf_text_request'::"BillingFeature", NULL, 10000),
    ('unlimited-monthly', 'resume_slot'::"BillingFeature", NULL, 100),
    ('unlimited-monthly', 'resume_analysis'::"BillingFeature", 20, NULL),
    ('unlimited-monthly', 'individual_response'::"BillingFeature", NULL, 2000)
)
INSERT INTO "PlanLimit" (id, "planId", feature, "limit", "fairUseLimit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p.id, limits.feature, limits.hard_limit, limits.fair_use_limit, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM limits
JOIN "Plan" p ON p.code = limits.code
ON CONFLICT ("planId", feature) DO UPDATE SET
  "limit" = EXCLUDED."limit",
  "fairUseLimit" = EXCLUDED."fairUseLimit",
  "updatedAt" = CURRENT_TIMESTAMP;
