import {
  BadgeCheckIcon,
  CheckIcon,
  SparklesIcon,
  TrophyIcon,
  ZapIcon,
} from "lucide-react";

import { startCheckoutAction } from "@/app/(dashboard)/billing/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type PlanVisual = {
  featured: boolean;
  eyebrow: string;
  badge: string;
  cta: string;
  resultLabel: string;
  resultSubtext: string;
  proof: string;
};

const subscriptionTypeLabels: Record<string, string> = {
  starter: "Старт",
  pro: "Про",
  max: "Макс",
  custom: "Персональный",
};

const fallbackDescriptions: Record<string, string> = {
  starter:
    "Базовый набор возможностей для аккуратной работы с резюме и первыми откликами.",
  pro:
    "Оптимальный план для активного поиска: больше анализа, правок и рабочих сценариев.",
  max:
    "Максимальный набор возможностей для сильной упаковки резюме и быстрого результата.",
  custom:
    "Гибкий тариф под нестандартные задачи и индивидуальный сценарий использования.",
};

function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDuration(days: number) {
  if (days === 30) {
    return "мес";
  }

  if (days === 365) {
    return "год";
  }

  return `${days.toLocaleString("ru-RU")} дн.`;
}

function normalizeType(type: string) {
  return type.trim().toLowerCase();
}

function formatSubscriptionType(type: string) {
  const normalizedType = normalizeType(type);

  return (
    subscriptionTypeLabels[normalizedType] ??
    normalizedType.replaceAll(/[-_]+/g, " ")
  );
}

function getDescription(plan: BillingPlanCard) {
  const normalizedType = normalizeType(plan.subscriptionType);
  const trimmedDescription = plan.description?.trim();

  return (
    trimmedDescription ||
    fallbackDescriptions[normalizedType] ||
    fallbackDescriptions.custom
  );
}

function getPlanVisual(
  plan: BillingPlanCard,
  index: number,
  total: number,
): PlanVisual {
  const normalizedType = normalizeType(plan.subscriptionType);
  const featured =
    normalizedType === "max" ||
    normalizedType === "pro" && total === 2 ||
    index === total - 1;

  if (featured) {
    return {
      featured: true,
      eyebrow: "Лучший результат",
      badge: "Доказанная ценность",
      cta: "Получить результат",
      resultLabel: "Всё для результата",
      resultSubtext: "сильная упаковка и понятные следующие шаги",
      proof: "Клиенты быстрее доходят до оффера после настройки профиля",
    };
  }

  return {
    featured: false,
    eyebrow: index === 0 ? "Самый популярный" : "Полная автоматизация",
    badge: formatSubscriptionType(plan.subscriptionType),
    cta: "Выбрать тариф",
    resultLabel: "Меньше рутины",
    resultSubtext: "больше времени на сильные отклики и подготовку",
    proof: "Экономит время на повторяющихся действиях",
  };
}

function getFeatureList(plan: BillingPlanCard, description: string) {
  const descriptionItems = description
    .split(/\n|;|•|-/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 12)
    .slice(0, 4);

  if (descriptionItems.length >= 2) {
    return descriptionItems;
  }

  return [
    `${formatSubscriptionType(plan.subscriptionType)}-доступ ко всем возможностям тарифа`,
    `Период действия — ${formatDuration(plan.durationDays)}`,
    "Анализ резюме и рекомендации по улучшению",
    "Работа с сохранёнными резюме в личном кабинете",
  ];
}

export function PricingSection({ plans }: { plans: BillingPlanCard[] }) {
  return (
    <section className="w-full">
      {plans.length === 0 ? (
        <div className="mx-auto max-w-md rounded-xl border p-6 text-center text-sm text-muted-foreground">
          Тарифы пока не настроены
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan, index) => {
            const description = getDescription(plan);
            const visual = getPlanVisual(plan, index, plans.length);
            const features = getFeatureList(plan, description);

            return (
              <article
                className={cn(
                  "flex min-h-[660px] flex-col rounded-[26px] p-1.5 shadow-sm",
                  visual.featured
                    ? "bg-[#caff3d] text-[#061041]"
                    : "bg-[#dfe4ff] text-[#020617]"
                )}
                key={plan.id}
              >
                <div
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-3 px-4 text-sm font-semibold",
                    visual.featured ? "text-[#061041]" : "text-[#020617]"
                  )}
                >
                  {visual.featured ? (
                    <TrophyIcon data-icon="inline-start" />
                  ) : (
                    <ZapIcon data-icon="inline-start" />
                  )}
                  <span>{visual.eyebrow}</span>
                  <span
                    className={cn(
                      "rounded-full px-4 py-1 text-xs font-bold uppercase",
                      visual.featured
                        ? "bg-[#061041] text-white"
                        : "bg-white text-[#020617]"
                    )}
                  >
                    {visual.badge}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex flex-1 flex-col rounded-[22px] p-6 md:p-7",
                    visual.featured
                      ? "bg-[#111a50] text-white"
                      : "bg-white text-[#020617]"
                  )}
                >
                  <div className="flex flex-col gap-3">
                    <h2 className="text-[28px] font-bold leading-[1.05] tracking-[-0.035em]">
                      {plan.name}
                    </h2>
                    <p
                      className={cn(
                        "min-h-12 text-[15px] font-medium leading-snug",
                        visual.featured ? "text-white" : "text-[#020617]"
                      )}
                    >
                      {description}
                    </p>
                  </div>

                  <div className="mt-7 flex items-end gap-2">
                    <span className="text-[42px] font-extrabold leading-none tracking-[-0.04em]">
                      {formatPrice(plan.priceRub)}
                    </span>
                    <span
                      className={cn(
                        "pb-1 text-sm font-semibold",
                        visual.featured ? "text-white/80" : "text-[#020617]/70"
                      )}
                    >
                      /{formatDuration(plan.durationDays)}
                    </span>
                  </div>

                  <form action={startCheckoutAction} className="mt-5">
                    <input name="planId" type="hidden" value={plan.planId} />
                    <Button
                      className={cn(
                        "h-[52px] w-full rounded-[12px] text-[20px] font-bold",
                        visual.featured
                          ? "bg-white text-[#020617] hover:bg-white/90"
                          : "bg-[#050916] text-white hover:bg-[#050916]/90"
                      )}
                      type="submit"
                    >
                      {visual.cta}
                    </Button>
                  </form>

                  <div
                    className={cn(
                      "mt-7 rounded-[12px] p-4",
                      visual.featured
                        ? "bg-white/15 text-[#caff3d]"
                        : "bg-[#f4f6ff] text-[#1f4dff]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <SparklesIcon data-icon="inline-start" />
                      <div>
                        <div className="font-bold">{visual.resultLabel}</div>
                        <div
                          className={cn(
                            "mt-1 text-sm font-medium",
                            visual.featured ? "text-white/75" : "text-[#7b8190]"
                          )}
                        >
                          {visual.resultSubtext}
                        </div>
                      </div>
                    </div>
                  </div>

                  <ul
                    className={cn(
                      "mt-4 flex flex-col gap-4 rounded-[12px] p-4 text-[15px] font-semibold leading-snug",
                      visual.featured
                        ? "bg-white/18 text-white"
                        : "bg-[#f4f6ff] text-[#020617]"
                    )}
                  >
                    {features.map((feature) => (
                      <li className="flex items-start gap-3" key={feature}>
                        <CheckIcon
                          className={cn(
                            "mt-0.5 shrink-0",
                            visual.featured ? "text-[#caff3d]" : "text-[#050916]"
                          )}
                          data-icon="inline-start"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className={cn(
                      "mt-auto flex items-center justify-center gap-2 pt-7 text-center text-sm font-bold",
                      visual.featured ? "text-white/55" : "text-[#8a8f9b]"
                    )}
                  >
                    <BadgeCheckIcon data-icon="inline-start" />
                    <span>{visual.proof}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
