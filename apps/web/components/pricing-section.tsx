import { CheckIcon, LockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type BillingPlanCard = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceRub: number;
  subscriptionType: string;
  durationDays: number;
  rank: number;
  displayOrder: number;
  checkoutEnabled: boolean;
  planId?: string;
  limits?: Array<{
    feature: string;
    limit: number | null;
    fairUseLimit: number | null;
  }>;
};

export type BillingUsageLimit = {
  feature: string;
  label: string;
  used: number;
  reserved: number;
  limit: number | null;
  fairUseLimit: number | null;
  enforcementLimit: number | null;
  unlimited: boolean;
  resetAt: string;
};

export type BillingSubscriptionSummary = {
  currentPlan: BillingPlanCard;
  periodStart: string;
  periodEnd: string;
  limits: BillingUsageLimit[];
};

type PlanKind = "basic" | "comfort" | "unlimited";

type PlanCopy = {
  title: string;
  shortTitle: string;
  subtitle: string;
  badge: string | null;
  cta: string;
  iconSrc: string;
  featuresIntro: string;
  features: string[];
};

const checkoutDisabledMessage = "Функция пока недоступна";

const planCopyByKind: Record<PlanKind, PlanCopy> = {
  basic: {
    title: "Базовый",
    shortTitle: "базового",
    subtitle: "Для уверенного старта",
    badge: null,
    cta: "Начать с базового",
    iconSrc: "/icon/seedling.svg",
    featuresIntro: "В тариф входит:",
    features: [
      "Аудиораспознавание: 3 часа",
      "Анализ скриншотов: 25 запросов",
      "Анализ текстовых запросов: 500 запросов",
      "Резюме: до 5 вариантов",
      "ИИ-анализ резюме: 2 проверки",
      "Индивидуальные отклики: 50 откликов",
    ],
  },
  comfort: {
    title: "Комфортный",
    shortTitle: "комфортного",
    subtitle: "Оптимальный тариф для поиска",
    badge: "Оптимальный выбор",
    cta: "Выбрать комфортный",
    iconSrc: "/icon/plant.svg",
    featuresIntro: "Все из Базового, плюс:",
    features: [
      "Аудиораспознавание: 10 часов",
      "Анализ скриншотов: 150 запросов",
      "Анализ текстовых запросов: 2 000 запросов",
      "Резюме: до 15 вариантов",
      "ИИ-анализ резюме: 7 проверок",
      "Индивидуальные отклики: 200 откликов",
    ],
  },
  unlimited: {
    title: "Безлимитный",
    shortTitle: "безлимитного",
    subtitle: "Максимум возможностей",
    badge: "Максимум",
    cta: "Получить максимум",
    iconSrc: "/icon/growth.svg",
    featuresIntro: "Все из Комфортного, плюс:",
    features: [
      "Аудио: безлимитно, до 50 часов",
      "Скриншоты: безлимитно, до 1 000",
      "Текстовые запросы: безлимитно, до 10 000",
      "Резюме: безлимитно, до 100",
      "ИИ-анализ резюме: 20 проверок",
      "Отклики: безлимитно, до 2 000",
    ],
  },
};

function getPlanKind(plan: BillingPlanCard): PlanKind {
  if (plan.subscriptionType === "comfort" || plan.code.includes("comfort")) {
    return "comfort";
  }

  if (
    plan.subscriptionType === "unlimited" ||
    plan.code.includes("unlimited")
  ) {
    return "unlimited";
  }

  return "basic";
}

function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function isFreePlan(plan: BillingPlanCard) {
  return plan.code === "free" || plan.priceRub <= 0;
}

function isCurrentPlan(plan: BillingPlanCard, currentPlan: BillingPlanCard) {
  return plan.code === currentPlan.code || plan.id === currentPlan.id;
}

function isPaidCurrentPlan(subscription: BillingSubscriptionSummary) {
  return !isFreePlan(subscription.currentPlan);
}

function getCheckoutAmount(
  plan: BillingPlanCard,
  subscription: BillingSubscriptionSummary,
) {
  if (
    isPaidCurrentPlan(subscription) &&
    plan.rank > subscription.currentPlan.rank &&
    plan.priceRub > subscription.currentPlan.priceRub
  ) {
    return plan.priceRub - subscription.currentPlan.priceRub;
  }

  return plan.priceRub;
}

function getPriceCaption(
  plan: BillingPlanCard,
  subscription: BillingSubscriptionSummary,
) {
  if (
    isPaidCurrentPlan(subscription) &&
    plan.rank > subscription.currentPlan.rank &&
    plan.priceRub > subscription.currentPlan.priceRub
  ) {
    return "доплата за переход";
  }

  return "в месяц";
}

function canCheckout(
  plan: BillingPlanCard,
  subscription: BillingSubscriptionSummary,
) {
  if (!plan.checkoutEnabled || plan.priceRub <= 0) {
    return false;
  }

  if (!isPaidCurrentPlan(subscription)) {
    return true;
  }

  return (
    plan.rank > subscription.currentPlan.rank &&
    plan.priceRub > subscription.currentPlan.priceRub
  );
}

function PlanIcon({ src }: { src: string }) {
  return (
    <span
      aria-hidden="true"
      className="block size-12 shrink-0 bg-foreground [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
      }}
    />
  );
}

function PlanAction({
  plan,
  subscription,
}: {
  plan: BillingPlanCard;
  subscription: BillingSubscriptionSummary;
}) {
  const isCurrentPaid =
    isPaidCurrentPlan(subscription) &&
    isCurrentPlan(plan, subscription.currentPlan);

  if (isCurrentPaid) {
    return (
      <Button
        className="h-12 w-full items-center justify-center text-base leading-none"
        disabled
        size="lg"
      >
        Текущий тариф
      </Button>
    );
  }

  if (!plan.checkoutEnabled && plan.priceRub > 0) {
    return (
      <Button
        className="h-12 w-full items-center justify-center text-base leading-none"
        disabled
        size="lg"
      >
        {checkoutDisabledMessage}
      </Button>
    );
  }

  if (!canCheckout(plan, subscription)) {
    return (
      <Button
        className="h-12 w-full items-center justify-center text-base leading-none"
        disabled
        size="lg"
      >
        <LockIcon data-icon="inline-start" />
        Недоступно
      </Button>
    );
  }

  return (
    <Button
      className="h-12 w-full items-center justify-center text-base leading-none"
      disabled
      size="lg"
    >
      {checkoutDisabledMessage}
    </Button>
  );
}

function PlanCard({
  plan,
  subscription,
}: {
  plan: BillingPlanCard;
  subscription: BillingSubscriptionSummary;
}) {
  const kind = getPlanKind(plan);
  const copy = planCopyByKind[kind];
  const isCurrentPaid =
    isPaidCurrentPlan(subscription) &&
    isCurrentPlan(plan, subscription.currentPlan);
  const badgeVariant = kind === "comfort" ? "default" : "secondary";
  const amount = getCheckoutAmount(plan, subscription);
  const priceCaption = getPriceCaption(plan, subscription);

  return (
    <article
      className={cn(
        "flex overflow-hidden rounded-[22px] border border-border bg-card text-card-foreground shadow-sm transition-colors",
        isCurrentPaid &&
          "border-primary/70 bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <div className="flex w-full flex-col">
        <div className="px-7 pt-5 pb-4">
          <div className="flex min-h-12 items-start justify-between gap-4">
            <PlanIcon src={copy.iconSrc} />
            <div className="flex flex-col items-end gap-2">
              {isCurrentPaid ? (
                <Badge className="rounded-full px-3 py-1 text-xs font-semibold">
                  Текущий тариф
                </Badge>
              ) : copy.badge ? (
                <Badge
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  variant={badgeVariant}
                >
                  {copy.badge}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <h2 className="text-2xl leading-tight font-bold tracking-tight">
              {copy.title}
            </h2>
            <p className="mt-0.5 text-[15px] leading-tight font-medium text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>

          <div className="mt-5 flex items-end gap-2.5">
            <span className="text-[32px] leading-none font-bold tracking-tight">
              {formatPrice(amount)}
            </span>
            <span className="pb-0.5 text-xs leading-tight font-semibold text-muted-foreground">
              {priceCaption}
            </span>
          </div>

          {amount !== plan.priceRub ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Полная цена тарифа: {formatPrice(plan.priceRub)} в месяц
            </p>
          ) : null}

          <div className="mt-5">
            <PlanAction plan={plan} subscription={subscription} />
          </div>
        </div>

        <Separator />

        <div className="px-7 py-4">
          <p className="mb-2.5 text-sm font-bold">{copy.featuresIntro}</p>
          <ul className="flex flex-col gap-1">
            {copy.features.map((feature) => (
              <li
                className="flex items-start gap-2 text-[13px] leading-snug font-medium text-muted-foreground"
                key={feature}
              >
                <CheckIcon className="mt-0.5 size-3 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function PricingSection({
  plans,
  subscription,
}: {
  plans: BillingPlanCard[];
  subscription: BillingSubscriptionSummary;
}) {
  const paidPlans = plans
    .filter((plan) => !isFreePlan(plan))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.priceRub - b.priceRub);

  return (
    <section className="mx-auto w-full max-w-[1704px] rounded-[24px] bg-background px-3 py-2.5 text-foreground sm:px-5 lg:px-6">
      <div className="grid w-full gap-6 lg:grid-cols-3">
        {paidPlans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} subscription={subscription} />
        ))}
      </div>
    </section>
  );
}
