import {
  PricingSection,
  type BillingPlanCard,
  type BillingSubscriptionSummary,
} from "@/components/pricing-section";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

type ApiPlan = Omit<BillingPlanCard, "planId">;

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
      items: response.items.map((plan) => ({
        ...plan,
        planId: plan.id,
      })),
    };
  } catch (error) {
    return {
      items: [],
      error: getApiErrorMessage(error),
    };
  }
}

async function getSubscription() {
  try {
    return await apiFetch<BillingSubscriptionSummary>(
      "/api/v1/billing/subscription",
    );
  } catch (error) {
    return {
      error: getApiErrorMessage(error),
    };
  }
}

async function syncReturnedPayment(paymentId?: string) {
  if (!paymentId) {
    return;
  }

  try {
    await apiFetch(`/api/v1/billing/payments/${paymentId}/status`);
  } catch {
    // Payment status sync is opportunistic; subscription data below still loads.
  }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const query = await searchParams;
  await syncReturnedPayment(query.paymentId);
  const checkoutUnavailable = query.status === "checkout_unavailable";

  const [plansResult, subscriptionResult] = await Promise.all([
    getBillingPlans(),
    getSubscription(),
  ]);
  const error =
    plansResult.error ||
    ("error" in subscriptionResult ? subscriptionResult.error : null);

  return (
    <main className="flex min-h-[calc(100svh-var(--shell-header-height))] w-full bg-background px-4 py-2 text-foreground md:px-6 lg:px-8">
      {error || "error" in subscriptionResult ? (
        <div
          className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
          role="alert"
        >
          Не удалось загрузить тарифы: {error}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4">
          {checkoutUnavailable ? (
            <div
              className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-medium text-foreground"
              role="status"
            >
              Функция покупки подписки пока недоступна.
            </div>
          ) : null}
          <PricingSection
            plans={plansResult.items}
            subscription={subscriptionResult}
          />
        </div>
      )}
    </main>
  );
}
