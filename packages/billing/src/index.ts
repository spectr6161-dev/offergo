import {
  Prisma,
  prisma,
  type BillingFeature,
  type Plan,
  type PlanLimit,
  type UsageEventKind,
} from "@offergo/db";
const freePlanCode = "free";
const checkoutUnavailableMessage = "Функция покупки подписки пока недоступна.";

export const billingCheckoutAvailable = false;

export const billingFeatures = [
  "wpf_audio_seconds",
  "wpf_screenshot",
  "wpf_text_request",
  "resume_slot",
  "resume_analysis",
  "individual_response",
] as const satisfies readonly BillingFeature[];

export const billingFeatureLabels: Record<BillingFeature, string> = {
  wpf_audio_seconds: "Аудиораспознавание на собеседовании",
  wpf_screenshot: "Анализ скриншотов",
  wpf_text_request: "Анализ текстовых запросов",
  resume_slot: "Резюме",
  resume_analysis: "ИИ-анализ резюме",
  individual_response: "Индивидуальные отклики",
};

export class QuotaExceededError extends Error {
  readonly code = "quota_exceeded";
  readonly statusCode = 402;
  readonly feature: BillingFeature;
  readonly used: number;
  readonly reserved: number;
  readonly limit: number | null;
  readonly fairUseLimit: number | null;
  readonly resetAt: Date;
  readonly upgradeUrl = "/billing";

  constructor(input: {
    feature: BillingFeature;
    used: number;
    reserved?: number;
    limit: number | null;
    fairUseLimit: number | null;
    resetAt: Date;
  }) {
    super(`Quota exceeded for ${input.feature}`);
    this.feature = input.feature;
    this.used = input.used;
    this.reserved = input.reserved ?? 0;
    this.limit = input.limit;
    this.fairUseLimit = input.fairUseLimit;
    this.resetAt = input.resetAt;
  }

  toResponse() {
    return {
      code: this.code,
      feature: this.feature,
      used: this.used,
      reserved: this.reserved,
      limit: this.limit,
      fairUseLimit: this.fairUseLimit,
      resetAt: this.resetAt.toISOString(),
      upgradeUrl: this.upgradeUrl,
      message: getQuotaExceededMessage(this.feature, this.resetAt),
    };
  }
}

export class CheckoutUnavailableError extends Error {
  readonly code = "checkout_unavailable";
  readonly statusCode = 503;

  constructor() {
    super(checkoutUnavailableMessage);
  }

  toResponse() {
    return {
      code: this.code,
      message: checkoutUnavailableMessage,
    };
  }
}

export type UsageReservation = {
  userId: string;
  feature: BillingFeature;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
};

type EffectivePlan = {
  plan: Plan & { limits: PlanLimit[] };
  entitlement: {
    id: string;
    startsAt: Date;
    endsAt: Date;
  } | null;
  periodStart: Date;
  periodEnd: Date;
};

type LockCapableClient = Pick<typeof prisma, "$executeRaw">;

async function acquireTransactionLock(tx: LockCapableClient, lockKey: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;
}

function buildEntitlementWindow(periodDays: number) {
  const startsAt = new Date();
  const endsAt = new Date(
    startsAt.getTime() + periodDays * 24 * 60 * 60 * 1000,
  );

  return {
    startsAt,
    endsAt,
  };
}

function getCalendarMonthWindow(now = new Date()) {
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );

  return {
    periodStart,
    periodEnd,
  };
}

function getQuotaExceededMessage(feature: BillingFeature, resetAt: Date) {
  const label = billingFeatureLabels[feature] ?? feature;
  return `Лимит "${label}" исчерпан. Лимит обновится ${resetAt.toLocaleDateString(
    "ru-RU",
  )}.`;
}

function getPlanLimit(plan: { limits: PlanLimit[] }, feature: BillingFeature) {
  const limit = plan.limits.find((item) => item.feature === feature);

  if (!limit) {
    throw new Error(`Billing limit is not configured for feature ${feature}.`);
  }

  return limit;
}

function getEnforcementLimit(limit: Pick<PlanLimit, "limit" | "fairUseLimit">) {
  return limit.fairUseLimit ?? limit.limit;
}

function assertWithinLimit(input: {
  feature: BillingFeature;
  used: number;
  reserved?: number;
  amount: number;
  limit: PlanLimit;
  resetAt: Date;
}) {
  const enforcementLimit = getEnforcementLimit(input.limit);

  if (enforcementLimit === null) {
    return;
  }

  if (input.used + (input.reserved ?? 0) + input.amount > enforcementLimit) {
    throw new QuotaExceededError({
      feature: input.feature,
      used: input.used,
      reserved: input.reserved,
      limit: input.limit.limit,
      fairUseLimit: input.limit.fairUseLimit,
      resetAt: input.resetAt,
    });
  }
}

async function getActiveEntitlement(userId: string, now = new Date()) {
  return prisma.entitlement.findFirst({
    where: {
      userId,
      status: "active",
      startsAt: {
        lte: now,
      },
      endsAt: {
        gt: now,
      },
    },
    include: {
      plan: {
        include: {
          limits: true,
        },
      },
    },
    orderBy: [
      {
        plan: {
          rank: "desc",
        },
      },
      {
        endsAt: "desc",
      },
    ],
  });
}

export async function getEffectivePlan(
  userId: string,
  now = new Date(),
): Promise<EffectivePlan> {
  const activeEntitlement = await getActiveEntitlement(userId, now);

  if (activeEntitlement) {
    return {
      plan: activeEntitlement.plan,
      entitlement: {
        id: activeEntitlement.id,
        startsAt: activeEntitlement.startsAt,
        endsAt: activeEntitlement.endsAt,
      },
      periodStart: activeEntitlement.startsAt,
      periodEnd: activeEntitlement.endsAt,
    };
  }

  const plan = await prisma.plan.findUniqueOrThrow({
    where: {
      code: freePlanCode,
    },
    include: {
      limits: true,
    },
  });
  const { periodStart, periodEnd } = getCalendarMonthWindow(now);

  return {
    plan,
    entitlement: null,
    periodStart,
    periodEnd,
  };
}

async function getCounter(input: {
  userId: string;
  feature: BillingFeature;
  periodStart: Date;
  periodEnd: Date;
}) {
  return prisma.usageCounter.findUnique({
    where: {
      userId_feature_periodStart_periodEnd: input,
    },
  });
}

async function countActiveResumes(userId: string) {
  return prisma.resume.count({
    where: {
      userId,
      deletedAt: null,
    },
  });
}

async function getFeatureUsage(input: {
  userId: string;
  feature: BillingFeature;
  periodStart: Date;
  periodEnd: Date;
}) {
  if (input.feature === "resume_slot") {
    return {
      used: await countActiveResumes(input.userId),
      reserved: 0,
    };
  }

  const counter = await getCounter(input);

  return {
    used: counter?.used ?? 0,
    reserved: counter?.reserved ?? 0,
  };
}

export async function getUsageOverview(userId: string, now = new Date()) {
  const effective = await getEffectivePlan(userId, now);
  const items = await Promise.all(
    billingFeatures.map(async (feature) => {
      const limit = getPlanLimit(effective.plan, feature);
      const usage = await getFeatureUsage({
        userId,
        feature,
        periodStart: effective.periodStart,
        periodEnd: effective.periodEnd,
      });

      return {
        feature,
        label: billingFeatureLabels[feature],
        used: usage.used,
        reserved: usage.reserved,
        limit: limit.limit,
        fairUseLimit: limit.fairUseLimit,
        enforcementLimit: getEnforcementLimit(limit),
        unlimited: limit.limit === null,
        resetAt: effective.periodEnd,
      };
    }),
  );

  return {
    plan: effective.plan,
    entitlement: effective.entitlement,
    periodStart: effective.periodStart,
    periodEnd: effective.periodEnd,
    items,
  };
}

export async function assertQuota(
  userId: string,
  feature: BillingFeature,
  amount = 1,
) {
  const effective = await getEffectivePlan(userId);
  const limit = getPlanLimit(effective.plan, feature);
  const usage = await getFeatureUsage({
    userId,
    feature,
    periodStart: effective.periodStart,
    periodEnd: effective.periodEnd,
  });

  assertWithinLimit({
    feature,
    amount,
    limit,
    resetAt: effective.periodEnd,
    ...usage,
  });
}

async function changeCounter(input: {
  userId: string;
  feature: BillingFeature;
  amount: number;
  kind: UsageEventKind;
  metadata?: Prisma.InputJsonValue;
}) {
  if (input.amount <= 0) {
    throw new Error("Quota amount must be positive.");
  }

  return prisma.$transaction(
    async (tx) => {
      const effective = await getEffectivePlan(input.userId);
      const limit = getPlanLimit(effective.plan, input.feature);
      const existing = await tx.usageCounter.findUnique({
        where: {
          userId_feature_periodStart_periodEnd: {
            userId: input.userId,
            feature: input.feature,
            periodStart: effective.periodStart,
            periodEnd: effective.periodEnd,
          },
        },
      });
      const used = existing?.used ?? 0;
      const reserved = existing?.reserved ?? 0;

      if (input.kind === "consume" || input.kind === "reserve") {
        assertWithinLimit({
          feature: input.feature,
          amount: input.amount,
          limit,
          resetAt: effective.periodEnd,
          used,
          reserved,
        });
      }

      const usedDelta = input.kind === "consume" ? input.amount : 0;
      const reservedDelta =
        input.kind === "reserve"
          ? input.amount
          : input.kind === "release"
            ? -input.amount
            : 0;

      const counter = await tx.usageCounter.upsert({
        where: {
          userId_feature_periodStart_periodEnd: {
            userId: input.userId,
            feature: input.feature,
            periodStart: effective.periodStart,
            periodEnd: effective.periodEnd,
          },
        },
        update: {
          used: {
            increment: usedDelta,
          },
          reserved: {
            increment: reservedDelta,
          },
        },
        create: {
          userId: input.userId,
          feature: input.feature,
          periodStart: effective.periodStart,
          periodEnd: effective.periodEnd,
          used: usedDelta,
          reserved: Math.max(0, reservedDelta),
        },
      });

      if (counter.reserved < 0) {
        await tx.usageCounter.update({
          where: {
            id: counter.id,
          },
          data: {
            reserved: 0,
          },
        });
      }

      await tx.usageEvent.create({
        data: {
          userId: input.userId,
          feature: input.feature,
          kind: input.kind,
          delta: input.kind === "release" ? -input.amount : input.amount,
          periodStart: effective.periodStart,
          periodEnd: effective.periodEnd,
          metadata: input.metadata,
        },
      });

      return {
        counter,
        periodStart: effective.periodStart,
        periodEnd: effective.periodEnd,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function consumeQuota(
  userId: string,
  feature: BillingFeature,
  amount = 1,
  metadata?: Prisma.InputJsonValue,
) {
  if (feature === "resume_slot") {
    await assertQuota(userId, feature, amount);
    return;
  }

  await changeCounter({
    userId,
    feature,
    amount,
    kind: "consume",
    metadata,
  });
}

export async function reserveQuota(
  userId: string,
  feature: BillingFeature,
  amount = 1,
  metadata?: Prisma.InputJsonValue,
): Promise<UsageReservation> {
  if (feature === "resume_slot") {
    await assertQuota(userId, feature, amount);
    const effective = await getEffectivePlan(userId);
    return {
      userId,
      feature,
      amount,
      periodStart: effective.periodStart,
      periodEnd: effective.periodEnd,
    };
  }

  const result = await changeCounter({
    userId,
    feature,
    amount,
    kind: "reserve",
    metadata,
  });

  return {
    userId,
    feature,
    amount,
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
  };
}

export async function finalizeQuotaReservation(
  reservation: UsageReservation,
  metadata?: Prisma.InputJsonValue,
) {
  if (reservation.feature === "resume_slot") {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.usageCounter.update({
      where: {
        userId_feature_periodStart_periodEnd: {
          userId: reservation.userId,
          feature: reservation.feature,
          periodStart: reservation.periodStart,
          periodEnd: reservation.periodEnd,
        },
      },
      data: {
        used: {
          increment: reservation.amount,
        },
        reserved: {
          decrement: reservation.amount,
        },
      },
    });
    await tx.usageEvent.create({
      data: {
        userId: reservation.userId,
        feature: reservation.feature,
        kind: "consume",
        delta: reservation.amount,
        periodStart: reservation.periodStart,
        periodEnd: reservation.periodEnd,
        metadata,
      },
    });
  });
}

export async function releaseQuotaReservation(
  reservation: UsageReservation,
  metadata?: Prisma.InputJsonValue,
) {
  if (reservation.feature === "resume_slot") {
    return;
  }

  await changeCounter({
    userId: reservation.userId,
    feature: reservation.feature,
    amount: reservation.amount,
    kind: "release",
    metadata,
  });
}

export async function createPaymentLink(_userId: string, _planId: string) {
  throw new CheckoutUnavailableError();
}

export async function grantEntitlement(
  userId: string,
  planId: string,
  periodDays: number,
  sourcePaymentId?: string,
) {
  const { startsAt, endsAt } = buildEntitlementWindow(periodDays);

  return prisma.entitlement.create({
    data: {
      userId,
      planId,
      startsAt,
      endsAt,
      sourcePaymentId,
    },
  });
}

export async function handlePaymentConfirmed(transactionId: string) {
  return prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `billing:webhook:${transactionId}`);

    const payment = await tx.payment.findUniqueOrThrow({
      where: { providerTransactionId: transactionId },
      include: { plan: true },
    });

    if (payment.status === "chargebacked") {
      return payment;
    }

    const updated =
      payment.status === "confirmed"
        ? payment
        : await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "confirmed",
              confirmedAt: new Date(),
            },
          });

    const { startsAt, endsAt } = buildEntitlementWindow(
      payment.plan.durationDays,
    );

    await tx.entitlement.upsert({
      where: {
        sourcePaymentId: payment.id,
      },
      update: {},
      create: {
        userId: payment.userId,
        planId: payment.planId,
        startsAt,
        endsAt,
        sourcePaymentId: payment.id,
      },
    });

    return updated;
  });
}

export async function handlePaymentCanceled(transactionId: string) {
  return prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `billing:webhook:${transactionId}`);

    const payment = await tx.payment.findUniqueOrThrow({
      where: { providerTransactionId: transactionId },
    });

    if (payment.status !== "pending") {
      return payment;
    }

    return tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "canceled",
        canceledAt: new Date(),
      },
    });
  });
}

export async function handleChargeback(transactionId: string) {
  return prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `billing:webhook:${transactionId}`);

    const payment = await tx.payment.update({
      where: { providerTransactionId: transactionId },
      data: {
        status: "chargebacked",
        chargebackedAt: new Date(),
      },
    });

    await tx.entitlement.updateMany({
      where: {
        sourcePaymentId: payment.id,
        status: "active",
      },
      data: {
        status: "revoked",
      },
    });

    return payment;
  });
}

export async function expirePayment(paymentId: string) {
  return prisma.payment.update({
    where: {
      id: paymentId,
    },
    data: {
      status: "expired",
    },
    include: {
      plan: true,
    },
  });
}

export async function getUserPaymentStatus(userId: string, paymentId: string) {
  let providerSyncError: string | undefined;
  let payment = await prisma.payment.findFirstOrThrow({
    where: {
      id: paymentId,
      userId,
    },
    include: {
      plan: true,
    },
  });

  if (payment.status !== "pending") {
    return {
      payment,
      providerSyncError,
    };
  }

  if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) {
    return {
      payment: await expirePayment(payment.id),
      providerSyncError,
    };
  }

  if (payment.status === "pending" && payment.expiresAt) {
    if (payment.expiresAt.getTime() <= Date.now()) {
      return {
        payment: await expirePayment(payment.id),
        providerSyncError,
      };
    }
  }

  return {
    payment,
    providerSyncError,
  };
}

export async function expireEntitlements() {
  const result = await prisma.entitlement.updateMany({
    where: {
      status: "active",
      endsAt: {
        lt: new Date(),
      },
    },
    data: {
      status: "expired",
    },
  });

  return result.count;
}

export async function listActivePlans() {
  const plans = await prisma.plan.findMany({
    where: {
      active: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      priceRub: true,
      subscriptionType: true,
      durationDays: true,
      rank: true,
      displayOrder: true,
      checkoutEnabled: true,
      limits: true,
    },
    orderBy: [
      {
        displayOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  return plans.map((plan) => ({
    ...plan,
    checkoutEnabled: billingCheckoutAvailable && plan.checkoutEnabled,
  }));
}

export async function listUserEntitlements(userId: string) {
  return prisma.entitlement.findMany({
    where: {
      userId,
    },
    include: {
      plan: true,
      payment: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function listUserPayments(userId: string) {
  return prisma.payment.findMany({
    where: {
      userId,
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function startCheckout(userId: string, planId: string) {
  return createPaymentLink(userId, planId);
}
