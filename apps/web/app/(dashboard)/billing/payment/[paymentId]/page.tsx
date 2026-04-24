import { PaymentStatusClient } from "./payment-status-client";
import type { PaymentStatusPayload } from "./payment-status-client";
import { apiFetch } from "@/lib/api";

async function getPaymentStatus(paymentId: string) {
  try {
    return await apiFetch<PaymentStatusPayload>(
      `/api/v1/billing/payments/${paymentId}/status`,
    );
  } catch {
    return null;
  }
}

export default async function BillingPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ paymentId }, query] = await Promise.all([params, searchParams]);
  const initialStatus = await getPaymentStatus(paymentId);

  return (
    <PaymentStatusClient
      initialResult={query.status}
      initialStatus={initialStatus}
      paymentId={paymentId}
    />
  );
}
