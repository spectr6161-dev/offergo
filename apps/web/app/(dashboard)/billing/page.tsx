import { PricingSection } from "@/components/pricing-section";
import type { BillingPlanCard } from "@/components/pricing-section";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

type ApiPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceRub: number;
  subscriptionType: string;
  durationDays: number;
};

type ApiListResponse<T> = {
  items: T[];
};

type BillingPageProps = {
  searchParams: Promise<{
    paymentId?: string;
    status?: string;
  }>;
};

async function getBillingPlans() {
  try {
    const response = await apiFetch<ApiListResponse<ApiPlan>>(
      "/api/v1/billing/plans",
    );

    return {
      items: response.items,
    };
  } catch (error) {
    return {
      items: [],
      error: getApiErrorMessage(error),
    };
  }
}

function buildPricingCards(apiPlans: ApiPlan[]): BillingPlanCard[] {
  return apiPlans.map((plan) => ({
    ...plan,
    planId: plan.id,
  }));
}

async function syncReturnedPayment(paymentId?: string) {
  if (!paymentId) {
    return;
  }

  try {
    await apiFetch(`/api/v1/billing/payments/${paymentId}/status`);
  } catch {
    // Payment status sync is opportunistic; the subscription table still shows pending.
  }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const query = await searchParams;
  const [plansResult] = await Promise.all([
    getBillingPlans(),
    syncReturnedPayment(query.paymentId),
  ]);
  const pricingCards = buildPricingCards(plansResult.items);

  return (
    <main className="flex min-h-[calc(100vh-var(--header-height))] items-start justify-center px-4 py-12 md:px-6 md:py-16">
      {plansResult.error ? (
        <div
          className="w-full max-w-2xl rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
          role="alert"
        >
          Не удалось загрузить тарифы: {plansResult.error}
        </div>
      ) : (
        <PricingSection plans={pricingCards} />
      )}
    </main>
  );
}
