import { auth } from "@offergo/auth/core";
import {
  env,
  legalDocumentDefinitions,
  legalDocumentVersion,
} from "@offergo/shared";
import { prisma } from "../src/client";

async function ensureAdmin() {
  const adminEmail = env.SEED_ADMIN_EMAIL;
  const adminPassword = env.SEED_ADMIN_PASSWORD;

  if (!adminEmail && !adminPassword) {
    console.info("SEED_ADMIN_EMAIL/PASSWORD are not set. Admin seed skipped.");
    return;
  }

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided together.",
    );
  }

  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters.");
  }

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    const response = await auth.api.signUpEmail({
      body: {
        name: "Offergo Admin",
        email: adminEmail,
        password: adminPassword,
      },
    });

    if (!response?.user?.id) {
      throw new Error("Failed to create seeded admin user");
    }
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
  });

  await prisma.roleAssignment.upsert({
    where: {
      userId_role: {
        userId: user.id,
        role: "admin",
      },
    },
    update: {},
    create: {
      userId: user.id,
      role: "admin",
    },
  });
}

type SeedLimit = {
  feature:
    | "wpf_audio_seconds"
    | "wpf_screenshot"
    | "wpf_text_request"
    | "resume_slot"
    | "resume_analysis"
    | "individual_response";
  limit: number | null;
  fairUseLimit: number | null;
};

const planLimits: Record<string, SeedLimit[]> = {
  free: [
    { feature: "wpf_audio_seconds", limit: 900, fairUseLimit: null },
    { feature: "wpf_screenshot", limit: 3, fairUseLimit: null },
    { feature: "wpf_text_request", limit: 25, fairUseLimit: null },
    { feature: "resume_slot", limit: 1, fairUseLimit: null },
    { feature: "resume_analysis", limit: 0, fairUseLimit: null },
    { feature: "individual_response", limit: 3, fairUseLimit: null },
  ],
  "basic-monthly": [
    { feature: "wpf_audio_seconds", limit: 10_800, fairUseLimit: null },
    { feature: "wpf_screenshot", limit: 25, fairUseLimit: null },
    { feature: "wpf_text_request", limit: 500, fairUseLimit: null },
    { feature: "resume_slot", limit: 5, fairUseLimit: null },
    { feature: "resume_analysis", limit: 2, fairUseLimit: null },
    { feature: "individual_response", limit: 50, fairUseLimit: null },
  ],
  "comfort-monthly": [
    { feature: "wpf_audio_seconds", limit: 36_000, fairUseLimit: null },
    { feature: "wpf_screenshot", limit: 150, fairUseLimit: null },
    { feature: "wpf_text_request", limit: 2_000, fairUseLimit: null },
    { feature: "resume_slot", limit: 15, fairUseLimit: null },
    { feature: "resume_analysis", limit: 7, fairUseLimit: null },
    { feature: "individual_response", limit: 200, fairUseLimit: null },
  ],
  "unlimited-monthly": [
    { feature: "wpf_audio_seconds", limit: null, fairUseLimit: 180_000 },
    { feature: "wpf_screenshot", limit: null, fairUseLimit: 1_000 },
    { feature: "wpf_text_request", limit: null, fairUseLimit: 10_000 },
    { feature: "resume_slot", limit: null, fairUseLimit: 100 },
    { feature: "resume_analysis", limit: 20, fairUseLimit: null },
    { feature: "individual_response", limit: null, fairUseLimit: 2_000 },
  ],
};

function buildLegalDocuments() {
  return legalDocumentDefinitions;
}

async function ensureLegalDocuments() {
  const documents = buildLegalDocuments();
  const currentKinds = documents.map((document) => document.kind);

  await prisma.legalDocumentVersion.updateMany({
    where: {
      active: true,
      kind: {
        notIn: currentKinds,
      },
    },
    data: {
      active: false,
    },
  });

  for (const document of documents) {
    const { kind, slug, title, summary, content } = document;

    await prisma.legalDocumentVersion.updateMany({
      where: {
        kind,
        active: true,
        version: {
          not: legalDocumentVersion,
        },
      },
      data: {
        active: false,
      },
    });

    await prisma.legalDocumentVersion.upsert({
      where: {
        kind_version: {
          kind,
          version: legalDocumentVersion,
        },
      },
      update: {
        slug,
        title,
        summary,
        content,
        active: true,
      },
      create: {
        kind,
        slug,
        title,
        summary,
        content,
        version: legalDocumentVersion,
        active: true,
      },
    });
  }
}

async function ensurePlans() {
  const plans = [
    {
      code: "free",
      name: "Бесплатный",
      description: "Стартовый доступ с базовыми лимитами.",
      priceRub: 0,
      subscriptionType: "free",
      durationDays: 30,
      rank: 0,
      displayOrder: 10,
      checkoutEnabled: false,
    },
    {
      code: "basic-monthly",
      name: "Базовый",
      description: "Для регулярной работы с резюме, откликами и WPF-помощником.",
      priceRub: 599,
      subscriptionType: "basic",
      durationDays: 30,
      rank: 10,
      displayOrder: 20,
      checkoutEnabled: true,
    },
    {
      code: "comfort-monthly",
      name: "Комфортный",
      description:
        "Больше лимитов для активного поиска работы и длительных live-сессий.",
      priceRub: 1199,
      subscriptionType: "comfort",
      durationDays: 30,
      rank: 20,
      displayOrder: 30,
      checkoutEnabled: true,
    },
    {
      code: "unlimited-monthly",
      name: "Безлимитный",
      description: "Максимальные возможности с fair-use защитой от злоупотреблений.",
      priceRub: 2999,
      subscriptionType: "unlimited",
      durationDays: 30,
      rank: 30,
      displayOrder: 40,
      checkoutEnabled: true,
    },
  ];

  for (const plan of plans) {
    const savedPlan = await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });

    for (const limit of planLimits[plan.code] ?? []) {
      await prisma.planLimit.upsert({
        where: {
          planId_feature: {
            planId: savedPlan.id,
            feature: limit.feature,
          },
        },
        update: {
          limit: limit.limit,
          fairUseLimit: limit.fairUseLimit,
        },
        create: {
          planId: savedPlan.id,
          feature: limit.feature,
          limit: limit.limit,
          fairUseLimit: limit.fairUseLimit,
        },
      });
    }
  }
}

async function ensureQuestions() {
  const tags = [
    { slug: "javascript", name: "JavaScript" },
    { slug: "system-design", name: "System Design" },
    { slug: "behavioral", name: "Behavioral" },
  ];

  for (const tag of tags) {
    await prisma.questionTag.upsert({
      where: { slug: tag.slug },
      update: tag,
      create: tag,
    });
  }

  await prisma.question.upsert({
    where: { slug: "javascript-event-loop" },
    update: {},
    create: {
      slug: "javascript-event-loop",
      title: "Explain the JavaScript event loop and microtask queue.",
      difficulty: "mid",
      answer: {
        outline: [
          "Execution stack and task queue",
          "Microtasks before macrotasks",
          "Typical interview pitfalls",
        ],
      },
      tags: {
        connect: [{ slug: "javascript" }],
      },
    },
  });

  await prisma.question.upsert({
    where: { slug: "service-boundaries" },
    update: {},
    create: {
      slug: "service-boundaries",
      title: "How do you decide service boundaries in a growing product?",
      difficulty: "senior",
      answer: {
        outline: [
          "Team ownership and coupling",
          "Deployment and scaling constraints",
          "Data boundaries and failure modes",
        ],
      },
      tags: {
        connect: [{ slug: "system-design" }],
      },
    },
  });
}

async function main() {
  if (env.RUN_DEMO_SEED || env.NODE_ENV !== "production") {
    await ensureLegalDocuments();
    await ensurePlans();
    await ensureQuestions();
  } else {
    await ensureLegalDocuments();
    console.info("RUN_DEMO_SEED is not enabled. Demo seed skipped.");
  }

  await ensureAdmin();
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
