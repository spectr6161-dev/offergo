import {
  Prisma,
  prisma,
  type BillingFeature,
  type Plan,
  type PlanLimit,
  type UsageEventKind,
} from "@offergo/db";
import {
  createPaymentLinkResponseSchema,
  env,
  plategaCallbackSchema,
  plategaTransactionStatusSchema,
  type PaymentStatus,
} from "@offergo/shared";

const checkoutTimeoutMs = 15 * 60 * 1000;
const providerTimeoutMs = 10 * 1000;
const freePlanCode = "free";

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

function mapProviderStatus(
  status: "PENDING" | "CONFIRMED" | "CANCELED" | "CHARGEBACK" | "CHARGEBACKED",
): PaymentStatus {
  switch (status) {
    case "CONFIRMED":
      return "confirmed";
    case "CANCELED":
      return "canceled";
    case "CHARGEBACK":
    case "CHARGEBACKED":
      return "chargebacked";
    default:
      return "pending";
  }
}

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds);
}

function parseExpiresIn(expiresIn?: string) {
  if (!expiresIn) {
    return checkoutTimeoutMs;
  }

  const parts = expiresIn.split(":").map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return checkoutTimeoutMs;
  }

  const [hours, minutes, seconds] = parts;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function buildPaymentResultUrl(paymentId: string, status: "success" | "fail") {
  const url = new URL("/billing", env.APP_URL);
  url.searchParams.set("status", status);
  url.searchParams.set("paymentId", paymentId);
  return url.toString();
}

function getPaymentUrl(
  parsed: ReturnType<typeof createPaymentLinkResponseSchema.parse>,
) {
  const paymentUrl = parsed.url ?? parsed.redirect;

  if (!paymentUrl) {
    throw new Error("Platega response does not contain payment url");
  }

  return paymentUrl;
}

async function fetchWithTimeout(input: URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Platega request timeout after ${providerTimeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestPaymentLink(
  userId: string,
  planId: string,
  paymentId: string,
  plan: { name: string; priceRub: number; durationDays: number },
) {
  const response = await fetchWithTimeout(
    new URL("v2/transaction/process", env.PLATEGA_BASE_URL),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MerchantId": env.PLATEGA_MERCHANT_ID,
        "X-Secret": env.PLATEGA_SECRET,
      },
      body: JSON.stringify({
        paymentDetails: {
          amount: plan.priceRub,
          currency: "RUB",
        },
        description: `offerGO access: ${plan.name}`,
        return: buildPaymentResultUrl(paymentId, "success"),
        failedUrl: buildPaymentResultUrl(paymentId, "fail"),
        payload: JSON.stringify({ userId, planId, paymentId }),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Platega payment link creation failed with status ${response.status}`,
    );
  }

  return createPaymentLinkResponseSchema.parse(await response.json());
}

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

export async function createPaymentLink(userId: string, planId: string) {
  if (env.APP_ENV === "production" && !env.LEGAL_FISCALIZATION_CONFIRMED) {
    throw new Error(
      "Checkout is disabled until fiscalization is configured and confirmed.",
    );
  }

  const checkout = await prisma.$transaction(async (tx) => {
    const checkoutLockKey = `billing:checkout:${userId}:${planId}`;
    await acquireTransactionLock(tx, checkoutLockKey);
    const now = new Date();

    const plan = await tx.plan.findFirstOrThrow({
      where: {
        id: planId,
        active: true,
      },
    });

    if (!plan.checkoutEnabled || plan.priceRub <= 0 || plan.durationDays <= 0) {
      throw new Error("Invalid billing plan configuration");
    }

    const activeEntitlement = await tx.entitlement.findFirst({
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
        plan: true,
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

    const currentPlan = activeEntitlement?.plan;
    const hasPaidCurrentPlan =
      currentPlan !== undefined &&
      currentPlan.code !== freePlanCode &&
      currentPlan.priceRub > 0;

    if (currentPlan && hasPaidCurrentPlan && plan.rank <= currentPlan.rank) {
      throw new Error("Selected plan is not an upgrade");
    }

    const checkoutAmountRub =
      currentPlan &&
      hasPaidCurrentPlan &&
      plan.rank > currentPlan.rank &&
      plan.priceRub > currentPlan.priceRub
        ? plan.priceRub - currentPlan.priceRub
        : plan.priceRub;

    if (checkoutAmountRub <= 0) {
      throw new Error("Invalid checkout amount");
    }

    await tx.payment.updateMany({
      where: {
        provider: "platega",
        userId,
        planId,
        status: "pending",
        OR: [
          { expiresAt: null },
          { expiresAt: { lte: now } },
          { amountRub: { not: checkoutAmountRub } },
        ],
      },
      data: {
        status: "expired",
      },
    });

    const existingPendingPayment = await tx.payment.findFirst({
      where: {
        provider: "platega",
        userId,
        planId,
        status: "pending",
        amountRub: checkoutAmountRub,
        expiresAt: { gt: now },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingPendingPayment?.paymentUrl) {
      return {
        plan,
        payment: existingPendingPayment,
        paymentUrl: existingPendingPayment.paymentUrl,
        shouldRequestProviderLink: false,
      };
    }

    const payment = await tx.payment.create({
      data: {
        provider: "platega",
        userId,
        planId,
        amountRub: checkoutAmountRub,
        currency: "RUB",
        status: "pending",
        expiresAt: addMilliseconds(now, checkoutTimeoutMs),
      },
    });

    return {
      plan,
      payment,
      paymentUrl: null,
      shouldRequestProviderLink: true,
    };
  });

  if (!checkout.shouldRequestProviderLink && checkout.paymentUrl) {
    return {
      payment: checkout.payment,
      paymentUrl: checkout.paymentUrl,
    };
  }

  try {
    const parsed = await requestPaymentLink(
      userId,
      planId,
      checkout.payment.id,
      {
        ...checkout.plan,
        priceRub: checkout.payment.amountRub,
      },
    );
    const paymentUrl = getPaymentUrl(parsed);
    const expiresAt = addMilliseconds(
      new Date(),
      parseExpiresIn(parsed.expiresIn),
    );

    const paymentData = {
      providerTransactionId: parsed.transactionId,
      paymentUrl,
      providerPayload: parsed,
      expiresAt,
    };

    const payment = await prisma.payment.update({
      where: {
        id: checkout.payment.id,
      },
      data: paymentData,
    });

    return {
      payment,
      paymentUrl,
    };
  } catch (error) {
    await prisma.payment.update({
      where: {
        id: checkout.payment.id,
      },
      data: {
        status: "canceled",
        canceledAt: new Date(),
      },
    });

    throw error;
  }
}

export async function getTransactionStatus(transactionId: string) {
  const response = await fetchWithTimeout(
    new URL(`transaction/${transactionId}`, env.PLATEGA_BASE_URL),
    {
      headers: {
        "X-MerchantId": env.PLATEGA_MERCHANT_ID,
        "X-Secret": env.PLATEGA_SECRET,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Platega status request failed with status ${response.status}`,
    );
  }

  const payload = await response.json();
  return plategaTransactionStatusSchema.parse(payload);
}

export function verifyWebhook(headers: Headers, payload: unknown) {
  const merchantId = headers.get("x-merchantid");
  const secret = headers.get("x-secret");

  if (!merchantId || !secret) {
    throw new Error("Missing Platega headers");
  }

  if (merchantId !== env.PLATEGA_MERCHANT_ID || secret !== env.PLATEGA_SECRET) {
    throw new Error("Invalid Platega credentials");
  }

  return plategaCallbackSchema.parse(payload);
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

function verifyPaymentAmountAndCurrency(
  payment: { amountRub: number; currency: string },
  expected?: { amount: number; currency: string },
) {
  if (!expected) {
    return;
  }

  const expectedAmount = Math.round(expected.amount);

  if (
    payment.amountRub !== expectedAmount ||
    payment.currency.toUpperCase() !== expected.currency.toUpperCase()
  ) {
    throw new Error(
      `Platega webhook amount mismatch: expected ${payment.amountRub} ${payment.currency}, received ${expected.amount} ${expected.currency}`,
    );
  }
}

export async function handlePaymentConfirmedWithProviderPayload(
  transactionId: string,
  expected?: { amount: number; currency: string },
) {
  return prisma.$transaction(async (tx) => {
    await acquireTransactionLock(tx, `billing:webhook:${transactionId}`);

    const payment = await tx.payment.findUniqueOrThrow({
      where: { providerTransactionId: transactionId },
      include: { plan: true },
    });

    verifyPaymentAmountAndCurrency(payment, expected);

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

  if (!payment.providerTransactionId) {
    return {
      payment,
      providerSyncError,
    };
  }

  try {
    const providerStatus = await getTransactionStatus(
      payment.providerTransactionId,
    );
    const status = mapProviderStatus(providerStatus.status);

    if (status === "confirmed") {
      await handlePaymentConfirmed(payment.providerTransactionId);
    }

    if (status === "canceled") {
      await handlePaymentCanceled(payment.providerTransactionId);
    }

    if (status === "chargebacked") {
      await handleChargeback(payment.providerTransactionId);
    }

    if (status !== "pending") {
      payment = await prisma.payment.findFirstOrThrow({
        where: {
          id: paymentId,
          userId,
        },
        include: {
          plan: true,
        },
      });
    }
  } catch (error) {
    providerSyncError =
      error instanceof Error ? error.message : "Failed to sync provider status";

    return {
      payment,
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
  return prisma.plan.findMany({
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

export async function handleProviderWebhook(
  payload: unknown,
  headers: Headers,
) {
  const callback = verifyWebhook(headers, payload);

  switch (mapProviderStatus(callback.status)) {
    case "confirmed":
      await handlePaymentConfirmedWithProviderPayload(callback.id, {
        amount: callback.amount,
        currency: callback.currency,
      });
      break;
    case "canceled":
      await handlePaymentCanceled(callback.id);
      break;
    case "chargebacked":
      await handleChargeback(callback.id);
      break;
    default:
      break;
  }

  return callback;
}
