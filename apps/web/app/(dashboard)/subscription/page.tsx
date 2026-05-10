import Link from "next/link";
import {
  BadgeCheckIcon,
  CreditCardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  HardDriveIcon,
  UsersIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import type {
  BillingSubscriptionSummary,
  BillingUsageLimit,
} from "@/components/pricing-section";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

type ApiPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceRub: number;
  durationDays: number;
};

type ApiPayment = {
  id: string;
  provider: string;
  providerTransactionId: string | null;
  status: string;
  amountRub: number;
  currency: string;
  paymentUrl?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  confirmedAt?: string | null;
  canceledAt?: string | null;
  chargebackedAt?: string | null;
  plan?: ApiPlan;
};

type ApiListResponse<T> = {
  items: T[];
};

type SubscriptionResponse = BillingSubscriptionSummary & {
  entitlement: {
    id: string;
    startsAt: string;
    endsAt: string;
  } | null;
};

const featureIcons: Record<string, LucideIcon> = {
  wpf_audio_seconds: ZapIcon,
  wpf_screenshot: HardDriveIcon,
  wpf_text_request: ZapIcon,
  resume_slot: UsersIcon,
  resume_analysis: BadgeCheckIcon,
  individual_response: CreditCardIcon,
};

async function getSubscription() {
  try {
    return await apiFetch<SubscriptionResponse>("/api/v1/billing/subscription");
  } catch (error) {
    return {
      error: getApiErrorMessage(error),
    };
  }
}

async function getPayments() {
  try {
    const response = await apiFetch<ApiListResponse<ApiPayment>>(
      "/api/v1/billing/payments",
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

function formatMoney(value: number) {
  return value === 0 ? "0 ₽" : `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatLimitValue(feature: string, value: number | null) {
  if (value === null) {
    return "Безлимит";
  }

  if (feature === "wpf_audio_seconds") {
    const minutes = Math.floor(value / 60);

    if (minutes >= 60) {
      return `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ""}`;
    }

    return `${minutes} мин`;
  }

  return value.toLocaleString("ru-RU");
}

function getUsageProgress(item: BillingUsageLimit) {
  const total = item.enforcementLimit ?? item.limit;

  if (total === null || total <= 0) {
    return item.unlimited ? 0 : 100;
  }

  return Math.min(100, Math.round(((item.used + item.reserved) / total) * 100));
}

function getPaymentDate(payment: ApiPayment) {
  return payment.confirmedAt ?? payment.createdAt;
}

function getPaymentRows(payments: ApiPayment[]) {
  return [...payments].sort(
    (left, right) =>
      new Date(getPaymentDate(right)).getTime() -
      new Date(getPaymentDate(left)).getTime(),
  );
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Ожидание",
    confirmed: "Оплачен",
    canceled: "Отменён",
    chargebacked: "Возврат",
    expired: "Истёк",
  };

  return labels[status] ?? status;
}

function getStatusVariant(status: string) {
  if (status === "confirmed") return "default" as const;
  if (status === "pending") return "secondary" as const;
  if (status === "canceled" || status === "chargebacked") {
    return "destructive" as const;
  }

  return "outline" as const;
}

function getInvoiceNumber(payment: ApiPayment, index: number) {
  const year = new Date(getPaymentDate(payment)).getFullYear();
  return `INV-${year}-${String(index + 1).padStart(3, "0")}`;
}

function UsageItem({
  item,
  isLast,
}: {
  item: BillingUsageLimit;
  isLast: boolean;
}) {
  const Icon = featureIcons[item.feature] ?? ZapIcon;
  const used = item.used + item.reserved;
  const progress = getUsageProgress(item);
  const enforcementLimit = item.enforcementLimit ?? item.limit;
  const isExhausted = enforcementLimit !== null && used >= enforcementLimit;
  const limitLabel = item.unlimited
    ? "Безлимит"
    : formatLimitValue(item.feature, item.limit);

  return (
    <>
      <Item className="px-0 py-4" variant="default">
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="text-base">{item.label}</ItemTitle>
          {item.unlimited && item.fairUseLimit ? (
            <div className="text-xs text-muted-foreground">
              Fair use: {formatLimitValue(item.feature, item.fairUseLimit)}
            </div>
          ) : null}
        </ItemContent>
        <ItemActions className="basis-full justify-between sm:basis-auto sm:justify-end">
          <span className="text-sm font-semibold">
            {formatLimitValue(item.feature, used)} / {limitLabel}
          </span>
          {isExhausted ? (
            <Badge variant="destructive">Исчерпан</Badge>
          ) : item.unlimited ? (
            <Badge variant="secondary">Безлимит</Badge>
          ) : null}
        </ItemActions>
        <ItemFooter className="mt-1 flex-col items-stretch gap-2">
          <Progress
            className="bg-sidebar-primary/10 [&_[data-slot=progress-indicator]]:bg-sidebar-primary"
            value={progress}
          />
        </ItemFooter>
      </Item>
      {!isLast ? <ItemSeparator className="my-0" /> : null}
    </>
  );
}

export default async function SubscriptionPage() {
  const [subscriptionResult, paymentsResult] = await Promise.all([
    getSubscription(),
    getPayments(),
  ]);
  const errorMessage =
    "error" in subscriptionResult
      ? subscriptionResult.error
      : paymentsResult.error;

  if (errorMessage || "error" in subscriptionResult) {
    return (
      <main className="min-h-[calc(100svh-var(--shell-header-height))] w-full bg-background p-4 text-foreground md:p-6">
        <div
          className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
          role="alert"
        >
          Не удалось загрузить подписку: {errorMessage}
        </div>
      </main>
    );
  }

  const subscription = subscriptionResult;
  const paymentRows = getPaymentRows(paymentsResult.items);
  const activePrice = subscription.currentPlan.priceRub;
  const isFreePlan =
    subscription.currentPlan.code === "free" || activePrice === 0;

  return (
    <main className="min-h-[calc(100svh-var(--shell-header-height))] w-full bg-background p-4 text-foreground [--primary-foreground:#ffffff] [--primary:#3045f5] [--ring:#3045f5] md:p-6">
      <section className="flex w-full flex-col gap-6">
        <ItemGroup className="gap-0">
          <Item className="p-5" variant="outline">
            <ItemMedia variant="icon">
              <BadgeCheckIcon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ItemTitle className="text-2xl font-black tracking-tight">
                  {subscription.currentPlan.name}
                </ItemTitle>
                {subscription.entitlement ? (
                  <Badge className="gap-1">
                    <BadgeCheckIcon />
                    Активна
                  </Badge>
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">
                Период лимитов: {formatDate(subscription.periodStart)} -{" "}
                {formatDate(subscription.periodEnd)}
              </div>
            </ItemContent>
            <ItemActions className="basis-full justify-start sm:basis-auto sm:justify-end">
              {isFreePlan ? (
                <form action="/billing">
                  <Button size="lg" type="submit">
                    Увеличить лимиты
                  </Button>
                </form>
              ) : (
                <div className="sm:text-right">
                  <div className="text-4xl font-black tracking-tight">
                    {formatMoney(activePrice)}
                  </div>
                  <div className="text-sm text-muted-foreground">в месяц</div>
                </div>
              )}
            </ItemActions>
          </Item>
        </ItemGroup>

        <section className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold">Использование лимитов</h2>
            <form action="/billing" className="w-fit">
              <Button type="submit">Изменить тариф</Button>
            </form>
          </div>
          <ItemGroup className="gap-0">
            {subscription.limits.map((item, index) => (
              <UsageItem
                item={item}
                isLast={index === subscription.limits.length - 1}
                key={item.feature}
              />
            ))}
          </ItemGroup>
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Платежи</CardTitle>
              <p className="text-sm text-muted-foreground">
                Последние операции по подписке.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/billing">
                Перейти к тарифам
                <ExternalLinkIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Счёт</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тариф</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRows.length > 0 ? (
                    paymentRows.slice(0, 6).map((payment, index) => {
                      const canContinuePayment =
                        payment.status === "pending" && payment.paymentUrl;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {getInvoiceNumber(payment, index)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(getPaymentDate(payment))}
                          </TableCell>
                          <TableCell>{payment.plan?.name ?? "Подписка"}</TableCell>
                          <TableCell className="font-semibold">
                            {formatMoney(payment.amountRub)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(payment.status)}>
                              {getStatusLabel(payment.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canContinuePayment ? (
                              <Button asChild size="sm" variant="outline">
                                <a href={payment.paymentUrl ?? undefined}>
                                  Оплатить
                                  <ExternalLinkIcon
                                    aria-hidden="true"
                                    data-icon="inline-end"
                                  />
                                </a>
                              </Button>
                            ) : (
                              <Button disabled size="icon-sm" variant="ghost">
                                <DownloadIcon aria-hidden="true" />
                                <span className="sr-only">Скачать счёт</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={6}
                      >
                        Платежей пока нет
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
