import { prisma } from "@offergo/db";
import { createPaymentLinkResponseSchema, env, plategaCallbackSchema, type PaymentStatus } from "@offergo/shared";

function mapProviderStatus(status: "PENDING" | "CONFIRMED" | "CANCELED" | "CHARGEBACKED"): PaymentStatus {
  switch (status) {
    case "CONFIRMED":
      return "confirmed";
    case "CANCELED":
      return "canceled";
    case "CHARGEBACKED":
      return "chargebacked";
    default:
      return "pending";
  }
}

export async function createPaymentLink(userId: string, planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: planId },
  });

  const response = await fetch(new URL("v2/transaction/process", env.PLATEGA_BASE_URL), {
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
      return: env.PLATEGA_SUCCESS_URL,
      failedUrl: env.PLATEGA_FAIL_URL,
      payload: JSON.stringify({ userId, planId }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Platega payment link creation failed with status ${response.status}`);
  }

  const parsed = createPaymentLinkResponseSchema.parse(await response.json());

  const payment = await prisma.payment.create({
    data: {
      provider: "platega",
      providerTransactionId: parsed.transactionId,
      userId,
      planId,
      amountRub: plan.priceRub,
      currency: "RUB",
      paymentUrl: parsed.url,
      providerPayload: parsed,
    },
  });

  return {
    payment,
    paymentUrl: parsed.url,
  };
}

export async function getTransactionStatus(transactionId: string) {
  const response = await fetch(new URL(`transaction/${transactionId}`, env.PLATEGA_BASE_URL), {
    headers: {
      "X-MerchantId": env.PLATEGA_MERCHANT_ID,
      "X-Secret": env.PLATEGA_SECRET,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Platega status request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload;
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

export async function grantEntitlement(userId: string, planId: string, periodDays: number, sourcePaymentId?: string) {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + periodDays * 24 * 60 * 60 * 1000);

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
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { providerTransactionId: transactionId },
    include: { plan: true },
  });

  if (payment.status === "confirmed") {
    return payment;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "confirmed",
      confirmedAt: new Date(),
    },
  });

  const existingEntitlement = await prisma.entitlement.findFirst({
    where: { sourcePaymentId: payment.id },
  });

  if (!existingEntitlement) {
    await grantEntitlement(payment.userId, payment.planId, payment.plan.durationDays, payment.id);
  }

  return updated;
}

export async function handlePaymentCanceled(transactionId: string) {
  return prisma.payment.update({
    where: { providerTransactionId: transactionId },
    data: {
      status: "canceled",
      canceledAt: new Date(),
    },
  });
}

export async function handleChargeback(transactionId: string) {
  const payment = await prisma.payment.update({
    where: { providerTransactionId: transactionId },
    data: {
      status: "chargebacked",
      chargebackedAt: new Date(),
    },
  });

  await prisma.entitlement.updateMany({
    where: {
      sourcePaymentId: payment.id,
      status: "active",
    },
    data: {
      status: "revoked",
    },
  });

  return payment;
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

export async function startCheckout(userId: string, planId: string) {
  return createPaymentLink(userId, planId);
}

export async function handleProviderWebhook(payload: unknown, headers: Headers) {
  const callback = verifyWebhook(headers, payload);

  switch (mapProviderStatus(callback.status)) {
    case "confirmed":
      await handlePaymentConfirmed(callback.id);
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
