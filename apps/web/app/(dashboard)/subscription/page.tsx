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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

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

type ApiEntitlement = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  plan: ApiPlan;
  payment?: ApiPayment | null;
};

type ApiListResponse<T> = {
  items: T[];
};

type UsageMetric = {
  label: string;
  valueLabel: string;
  percent: number;
  Icon: LucideIcon;
  accent?: boolean;
};

const usageProfiles: Record<string, UsageMetric[]> = {
  "starter-monthly": [
    {
      label: "Хранилище",
      valueLabel: "18.2 из 50 ГБ",
      percent: 36,
      Icon: HardDriveIcon,
    },
    {
      label: "AI-запросы",
      valueLabel: "64K из 100K",
      percent: 64,
      Icon: ZapIcon,
      accent: true,
    },
    {
      label: "Места",
      valueLabel: "1 из 3",
      percent: 33,
      Icon: UsersIcon,
    },
  ],
  "pro-monthly": [
    {
      label: "Хранилище",
      valueLabel: "38.2 из 100 ГБ",
      percent: 38,
      Icon: HardDriveIcon,
    },
    {
      label: "AI-запросы",
      valueLabel: "847K из 1M",
      percent: 85,
      Icon: ZapIcon,
      accent: true,
    },
    {
      label: "Места",
      valueLabel: "8 из 15",
      percent: 53,
      Icon: UsersIcon,
    },
  ],
  "max-monthly": [
    {
      label: "Хранилище",
      valueLabel: "124 из 300 ГБ",
      percent: 41,
      Icon: HardDriveIcon,
    },
    {
      label: "AI-запросы",
      valueLabel: "2.4M из 3M",
      percent: 80,
      Icon: ZapIcon,
      accent: true,
    },
    {
      label: "Места",
      valueLabel: "18 из 30",
      percent: 60,
      Icon: UsersIcon,
    },
  ],
};

const emptyUsage: UsageMetric[] = [
  {
    label: "Хранилище",
    valueLabel: "0 из 0 ГБ",
    percent: 0,
    Icon: HardDriveIcon,
  },
  {
    label: "AI-запросы",
    valueLabel: "0 из 0",
    percent: 0,
    Icon: ZapIcon,
    accent: true,
  },
  {
    label: "Места",
    valueLabel: "0 из 0",
    percent: 0,
    Icon: UsersIcon,
  },
];

async function getEntitlements() {
  try {
    const response = await apiFetch<ApiListResponse<ApiEntitlement>>(
      "/api/v1/billing/entitlements",
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
  return `${value.toLocaleString("ru-RU")} ₽`;
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

function getPaymentDate(payment: ApiPayment) {
  return payment.confirmedAt ?? payment.createdAt;
}

function getActiveEntitlement(entitlements: ApiEntitlement[]) {
  const now = Date.now();

  return entitlements.find(
    (entitlement) =>
      entitlement.status === "active" &&
      new Date(entitlement.endsAt).getTime() > now,
  );
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
  if (status === "confirmed") {
    return "default" as const;
  }

  if (status === "pending") {
    return "secondary" as const;
  }

  if (status === "canceled" || status === "chargebacked") {
    return "destructive" as const;
  }

  return "outline" as const;
}

function getInvoiceNumber(payment: ApiPayment, index: number) {
  const year = new Date(getPaymentDate(payment)).getFullYear();
  return `INV-${year}-${String(index + 1).padStart(3, "0")}`;
}

function getYearToDateSpend(payments: ApiPayment[]) {
  const currentYear = new Date().getFullYear();

  return payments
    .filter((payment) => payment.status === "confirmed")
    .filter(
      (payment) =>
        new Date(getPaymentDate(payment)).getFullYear() === currentYear,
    )
    .reduce((total, payment) => total + payment.amountRub, 0);
}

function UsageItem({ metric }: { metric: UsageMetric }) {
  const { Icon } = metric;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="truncate">{metric.label}</span>
        </div>
        <span
          className={cn(
            "text-xs text-muted-foreground",
            metric.accent && "text-orange-600",
          )}
        >
          {metric.percent}%
        </span>
      </div>
      <Progress className="h-1 bg-border" value={metric.percent} />
      <div className="mt-2 text-xs text-muted-foreground">
        {metric.valueLabel}
      </div>
    </div>
  );
}

export default async function SubscriptionPage() {
  const [entitlementsResult, paymentsResult] = await Promise.all([
    getEntitlements(),
    getPayments(),
  ]);
  const errorMessage = entitlementsResult.error ?? paymentsResult.error;

  if (errorMessage) {
    return (
      <main className="w-full p-4 md:p-6">
        <div
          className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
          role="alert"
        >
          Не удалось загрузить подписку: {errorMessage}
        </div>
      </main>
    );
  }

  const entitlements = entitlementsResult.items;
  const payments = paymentsResult.items;
  const activeEntitlement = getActiveEntitlement(entitlements);
  const paymentRows = getPaymentRows(payments);
  const confirmedPayments = paymentRows.filter(
    (payment) => payment.status === "confirmed",
  );
  const ytdSpend = getYearToDateSpend(confirmedPayments);
  const activePrice = activeEntitlement?.plan.priceRub ?? 0;
  const usage = usageProfiles[activeEntitlement?.plan.code ?? ""] ?? emptyUsage;

  return (
    <main className="w-full p-4 md:p-6">
      <section className="w-full overflow-hidden bg-background">
        <div className="flex flex-col gap-4 px-4 py-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold">
                {activeEntitlement?.plan.name ?? "Нет активной подписки"}
              </h1>
              <span
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
                  activeEntitlement
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <BadgeCheckIcon aria-hidden="true" className="size-3.5" />
                {activeEntitlement ? "Активна" : "Нет доступа"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeEntitlement
                ? `Доступ до ${formatDate(activeEntitlement.endsAt)}`
                : "Выберите тариф, чтобы открыть доступ"}
            </p>
          </div>

          <div className="shrink-0 text-left md:text-right">
            <span className="text-3xl font-semibold tracking-tight">
              {formatMoney(activePrice)}
            </span>
            <span className="text-sm text-muted-foreground">/мес</span>
          </div>
        </div>

        <div className="grid gap-3 px-4 pb-4 text-sm md:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Продление: </span>
            <span className="font-semibold">{formatMoney(activePrice)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">За год: </span>
            <span className="font-semibold">{formatMoney(ytdSpend)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Оценка за год: </span>
            <span className="font-semibold">
              {formatMoney(activePrice * 12)}
            </span>
          </div>
        </div>

        <div className="border-t px-4 py-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Использование за период
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {usage.map((metric) => (
              <UsageItem key={metric.label} metric={metric} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <CreditCardIcon
              aria-hidden="true"
              className="mt-1 size-5 text-muted-foreground"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold">Platega</div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  По умолчанию
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Платёжная ссылка создаётся при продлении
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/billing">Изменить</Link>
          </Button>
        </div>

        <div className="border-t px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Последние счета
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/billing">
                Добавить ручной платеж
                <ExternalLinkIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11 px-3">Счёт</TableHead>
                  <TableHead className="h-11 px-3">Дата</TableHead>
                  <TableHead className="h-11 px-3">Сумма</TableHead>
                  <TableHead className="h-11 px-3">Статус</TableHead>
                  <TableHead className="h-11 px-3 text-right">
                    Действие
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.length > 0 ? (
                  paymentRows.slice(0, 5).map((payment, index) => {
                    const canContinuePayment =
                      payment.status === "pending" && payment.paymentUrl;

                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="px-3 py-3 font-medium">
                          {getInvoiceNumber(payment, index)}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-muted-foreground">
                          {formatDate(getPaymentDate(payment))}
                        </TableCell>
                        <TableCell className="px-3 py-3 font-semibold">
                          {formatMoney(payment.amountRub)}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <Badge variant={getStatusVariant(payment.status)}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
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
                              <span className="sr-only">Скачать PDF</span>
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
                      colSpan={5}
                    >
                      Платежей пока нет
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </main>
  );
}
