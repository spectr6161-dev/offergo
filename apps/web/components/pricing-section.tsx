import { startCheckoutAction } from "@/app/(dashboard)/billing/actions";
import * as PricingCard from "@/components/pricing-card";
import { Button } from "@/components/ui/button";

export type BillingPlanCard = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceRub: number;
  subscriptionType: string;
  durationDays: number;
  planId: string;
};

const subscriptionTypeLabels: Record<string, string> = {
  starter: "Старт",
  pro: "Про",
  max: "Макс",
  custom: "Пользовательский",
};

function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDuration(days: number) {
  if (days === 30) {
    return "месяц";
  }

  if (days === 365) {
    return "год";
  }

  return `${days.toLocaleString("ru-RU")} дн.`;
}

function formatSubscriptionType(type: string) {
  const normalizedType = type.trim().toLowerCase();

  return (
    subscriptionTypeLabels[normalizedType] ??
    normalizedType.replaceAll(/[-_]+/g, " ")
  );
}

export function PricingSection({ plans }: { plans: BillingPlanCard[] }) {
  return (
    <section className="w-full">
      <div className="mx-auto mb-7 flex max-w-md flex-col items-center gap-2 text-center">
        <div className="rounded-md border px-4 py-1 text-sm font-medium">
          Тарифы
        </div>
        <h2 className="font-heading text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl lg:font-extrabold">
          Планы под ваш рост
        </h2>
      </div>

      {plans.length === 0 ? (
        <div className="mx-auto max-w-md rounded-xl border p-6 text-center text-muted-foreground text-sm">
          Тарифы пока не настроены
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard.Card className="max-w-full" key={plan.id}>
              <PricingCard.Header>
                <PricingCard.Plan>
                  <PricingCard.PlanName>
                    <span>{plan.name}</span>
                  </PricingCard.PlanName>
                  <PricingCard.Badge>
                    {formatSubscriptionType(plan.subscriptionType)}
                  </PricingCard.Badge>
                </PricingCard.Plan>
                <PricingCard.Price>
                  <PricingCard.MainPrice>
                    {formatPrice(plan.priceRub)}
                  </PricingCard.MainPrice>
                  <PricingCard.Period>
                    / {formatDuration(plan.durationDays)}
                  </PricingCard.Period>
                </PricingCard.Price>
                <form action={startCheckoutAction}>
                  <input name="planId" type="hidden" value={plan.planId} />
                  <Button className="h-8 w-full font-semibold" type="submit">
                    Оплатить
                  </Button>
                </form>
              </PricingCard.Header>

              {plan.description ? (
                <PricingCard.Body>
                  <PricingCard.Description>
                    {plan.description}
                  </PricingCard.Description>
                </PricingCard.Body>
              ) : null}
            </PricingCard.Card>
          ))}
        </div>
      )}
    </section>
  );
}
