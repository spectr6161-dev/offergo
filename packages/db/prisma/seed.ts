import { prisma } from "../src/client";
import { auth } from "@offergo/auth/core";
import { env } from "@offergo/shared";

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

async function ensurePlans() {
  const plans = [
    {
      code: "starter-monthly",
      name: "Старт",
      description: "Базовый доступ к AI-инструментам.",
      priceRub: 100,
      subscriptionType: "starter",
      durationDays: 30,
    },
    {
      code: "pro-monthly",
      name: "Про",
      description: "Оптимальный тариф для регулярной работы.",
      priceRub: 200,
      subscriptionType: "pro",
      durationDays: 30,
    },
    {
      code: "max-monthly",
      name: "Макс",
      description: "Максимальный лимит для активного использования.",
      priceRub: 300,
      subscriptionType: "max",
      durationDays: 30,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
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
    await ensurePlans();
    await ensureQuestions();
  } else {
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
