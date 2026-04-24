import { prisma } from "../src/client";
import { auth } from "@offergo/auth/core";

async function ensureAdmin() {
  const adminEmail = "admin@offergo.local";
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    const response = await auth.api.signUpEmail({
      body: {
        name: "Offergo Admin",
        email: adminEmail,
        password: "Admin12345!",
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
      name: "Starter Monthly",
      description:
        "Resume analysis and interview practice for solo candidates.",
      priceRub: 1490,
      durationDays: 30,
    },
    {
      code: "pro-monthly",
      name: "Pro Monthly",
      description:
        "Everything in Starter plus AI trainer and advanced workflows.",
      priceRub: 2990,
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
  await ensurePlans();
  await ensureQuestions();
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
