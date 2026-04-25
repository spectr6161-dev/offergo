import { prisma } from "@offergo/db";
import {
  createPaymentLinkResponseSchema,
  env,
  plategaCallbackSchema,
  plategaTransactionStatusSchema,
  type PaymentStatus,
} from "@offergo/shared";

const checkoutTimeoutMs = 15 * 60 * 1000;
const providerTimeoutMs = 10 * 1000;

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

export async function createPaymentLink(userId: string, planId: string) {
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

    if (plan.priceRub <= 0 || plan.durationDays <= 0) {
      throw new Error("Invalid billing plan configuration");
    }

    await tx.payment.updateMany({
      where: {
        provider: "platega",
        userId,
        planId,
        status: "pending",
        OR: [{ expiresAt: null }, { expiresAt: { lte: now } }],
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
        amountRub: plan.priceRub,
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
      checkout.plan,
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
    },
    orderBy: [
      {
        priceRub: "asc",
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
