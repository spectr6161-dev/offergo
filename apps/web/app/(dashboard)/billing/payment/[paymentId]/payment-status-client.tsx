"use client";

import Link from "next/link";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type PaymentPlan = {
  id: string;
  name: string;
  priceRub: number;
  durationDays: number;
};

export type PaymentStatusPayload = {
  status: "pending" | "confirmed" | "canceled" | "chargebacked" | "expired";
  payment: {
    id: string;
    amountRub: number;
    currency: string;
    paymentUrl: string | null;
    expiresAt: string | null;
    createdAt: string;
  };
  plan: PaymentPlan;
  paymentUrl: string | null;
  expiresAt: string | null;
};

type PaymentStatusClientProps = {
  initialStatus: PaymentStatusPayload | null;
  initialResult?: string;
  paymentId: string;
};

const finalStatuses = new Set([
  "confirmed",
  "canceled",
  "chargebacked",
  "expired",
]);

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

function buildStatusUrl(paymentId: string) {
  const baseUrl = getApiBaseUrl().endsWith("/")
    ? getApiBaseUrl()
    : `${getApiBaseUrl()}/`;

  return new URL(`api/v1/billing/payments/${paymentId}/status`, baseUrl);
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStateCopy(
  status?: PaymentStatusPayload["status"],
  result?: string,
) {
  if (status === "confirmed") {
    return {
      title: "Оплата прошла",
      description: "Подписка активирована. Можно перейти на страницу подписки.",
      Icon: CheckCircle2Icon,
      progress: 100,
      tone: "success",
    };
  }

  if (status === "canceled") {
    return {
      title: "Оплата отменена",
      description: "Платёж не был завершён. Можно выбрать тариф ещё раз.",
      Icon: XCircleIcon,
      progress: 100,
      tone: "error",
    };
  }

  if (status === "chargebacked") {
    return {
      title: "Платёж возвращён",
      description: "Доступ по этому платежу отозван.",
      Icon: XCircleIcon,
      progress: 100,
      tone: "error",
    };
  }

  if (status === "expired") {
    return {
      title: "Время оплаты истекло",
      description: "Ссылка на оплату больше не активна. Создайте новый платёж.",
      Icon: ClockIcon,
      progress: 100,
      tone: "warning",
    };
  }

  return {
    title: result === "success" ? "Проверяем оплату" : "Ожидаем оплату",
    description: "Статус обновится автоматически после подтверждения Platega.",
    Icon: ClockIcon,
    progress: 45,
    tone: "pending",
  };
}

async function fetchStatus(paymentId: string) {
  const response = await fetch(buildStatusUrl(paymentId), {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Не удалось проверить статус платежа");
  }

  return (await response.json()) as PaymentStatusPayload;
}

export function PaymentStatusClient({
  initialStatus,
  initialResult,
  paymentId,
}: PaymentStatusClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const copy = getStateCopy(status?.status, initialResult);
  const Icon = copy.Icon;
  const isFinal = status ? finalStatuses.has(status.status) : false;

  useEffect(() => {
    if (isFinal) {
      return;
    }

    let isActive = true;

    async function poll() {
      try {
        const nextStatus = await fetchStatus(paymentId);

        if (!isActive) {
          return;
        }

        startTransition(() => {
          setStatus(nextStatus);
          setError(null);
        });
      } catch {
        if (!isActive) {
          return;
        }

        startTransition(() => {
          setError("Не удалось обновить статус. Попробуйте проверить вручную.");
        });
      }
    }

    const timer = window.setInterval(poll, 3000);
    void poll();

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, [isFinal, paymentId]);

  async function handleManualRefresh() {
    setIsRefreshing(true);

    try {
      const nextStatus = await fetchStatus(paymentId);

      startTransition(() => {
        setStatus(nextStatus);
        setError(null);
      });
    } catch {
      startTransition(() => {
        setError("Не удалось обновить статус. Попробуйте ещё раз.");
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground",
                copy.tone === "success" && "bg-emerald-50 text-emerald-700",
                copy.tone === "error" && "bg-destructive/10 text-destructive",
              )}
            >
              <Icon aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle>{copy.title}</CardTitle>
              <p className="mt-1 text-muted-foreground text-sm">
                {copy.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {status ? (
            <div className="grid gap-3 rounded-lg border p-3 text-sm md:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Тариф</div>
                <div className="font-medium">{status.plan.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Сумма</div>
                <div className="font-medium">
                  {formatMoney(status.payment.amountRub)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Платёж</div>
                <div className="truncate font-medium">{status.payment.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Истекает</div>
                <div className="font-medium">
                  {formatDateTime(status.expiresAt)}
                </div>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>Платёж не найден</AlertTitle>
              <AlertDescription>
                Вернитесь к тарифам и создайте новый платёж.
              </AlertDescription>
            </Alert>
          )}

          {!isFinal ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Автоматическая проверка
                </span>
                <span>{copy.progress}%</span>
              </div>
              <Progress value={copy.progress} />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircleIcon aria-hidden="true" />
              <AlertTitle>Ошибка проверки</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {status?.status === "confirmed" ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/subscription">Перейти к подписке</Link>
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-auto" variant="outline">
              <Link href="/billing">Выбрать тариф</Link>
            </Button>
          )}

          {!isFinal && status?.paymentUrl ? (
            <Button asChild className="w-full sm:w-auto" variant="outline">
              <a href={status.paymentUrl}>
                Открыть оплату
                <ExternalLinkIcon aria-hidden="true" data-icon="inline-end" />
              </a>
            </Button>
          ) : null}

          {!isFinal ? (
            <Button
              className="w-full sm:w-auto"
              disabled={isPending || isRefreshing}
              onClick={handleManualRefresh}
              variant="ghost"
            >
              <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
              Проверить
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  );
}
