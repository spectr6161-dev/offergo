import { PricingSection } from "@/components/pricing-section";
import type { BillingPlanCard } from "@/components/pricing-section";
import { apiFetch } from "@/lib/api";

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

    return response.items;
  } catch {
    return [];
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
  const [plans] = await Promise.all([
    getBillingPlans(),
    syncReturnedPayment(query.paymentId),
  ]);
  const pricingCards = buildPricingCards(plans);

  return (
    <main className="flex min-h-[calc(100vh-var(--header-height))] items-start justify-center px-4 py-12 md:px-6 md:py-16">
      <PricingSection plans={pricingCards} />
    </main>
  );
}
