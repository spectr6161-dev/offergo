import type { ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheckIcon,
  ExternalLinkIcon,
  FingerprintIcon,
  MailIcon,
  PencilIcon,
  SendIcon,
} from "lucide-react";

import {
  SettingsLogoutIconButton,
  SettingsThemeToggleCompact,
} from "@/components/settings-inline-controls";
import { SettingsPrivacyControls } from "@/components/settings-privacy-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import { requireUser, type WebAppUser } from "@/lib/auth";
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
  createdAt: string;
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

type ProviderBinding = {
  providerId: string;
  accountId: string;
};

const providerLabels: Record<string, string> = {
  credential: "Email",
  email: "Email",
  google: "Google",
  telegram: "Telegram",
  github: "GitHub",
  yandex: "Yandex",
};

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

function getUserInitials(user: Pick<WebAppUser, "email" | "name">) {
  const source = user.name || user.email || "OfferGO";
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "OG";
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
    pending: "Ожидает",
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

function getProviderLabel(providerId: string) {
  return providerLabels[providerId] ?? providerId;
}

function getProviderButtonClass(providerId: string) {
  const normalized = providerId.toLowerCase();

  if (normalized === "google") {
    return "border-[#dadce0] bg-background text-[#3c4043] hover:bg-[#f8fafd] dark:border-border dark:text-foreground dark:hover:bg-muted";
  }

  if (normalized === "telegram") {
    return "border-[#2AABEE]/30 bg-[#2AABEE]/5 text-[#2AABEE] hover:bg-[#2AABEE]/10";
  }

  if (normalized === "github") {
    return "border-foreground/15 bg-muted/70 hover:bg-muted";
  }

  if (normalized === "credential" || normalized === "email") {
    return "border-primary/15 bg-primary/5 hover:bg-primary/10";
  }

  return "border-border bg-background hover:bg-muted";
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 18 18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.94v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.71A5.41 5.41 0 0 1 3.67 9c0-.59.1-1.16.28-1.71V4.96H.94A9 9 0 0 0 0 9c0 1.45.35 2.82.94 4.04l3.01-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .94 4.96l3.01 2.33C4.66 5.16 6.65 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function ProviderMark({ providerId }: { providerId: string }) {
  const normalized = providerId.toLowerCase();

  if (normalized === "google") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background">
        <GoogleLogo />
      </span>
    );
  }

  if (normalized === "telegram") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2AABEE]/10 text-[#2AABEE]">
        <SendIcon />
      </span>
    );
  }

  if (normalized === "github") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold">
        GH
      </span>
    );
  }

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-primary">
      <MailIcon />
    </span>
  );
}

function ProviderButton({ provider }: { provider: ProviderBinding }) {
  return (
    <Button
      className={cn(
        "h-14 w-full justify-start rounded-[6px] border px-4 text-base shadow-none",
        getProviderButtonClass(provider.providerId),
      )}
      type="button"
      variant="outline"
    >
      <ProviderMark providerId={provider.providerId} />
      <span className="min-w-0 truncate text-left">
        {getProviderLabel(provider.providerId)}
      </span>
      <span className="ml-auto min-w-0 max-w-[55%] truncate text-sm text-muted-foreground">
        {maskAccountId(provider.accountId)}
      </span>
    </Button>
  );
}

function getProviderBindings(user: WebAppUser) {
  const bindings = user.accounts?.length
    ? user.accounts
    : user.email
      ? [{ providerId: "credential", accountId: user.email }]
      : [];

  const unique = new Map<string, ProviderBinding>();

  for (const binding of bindings) {
    unique.set(`${binding.providerId}:${binding.accountId}`, binding);
  }

  return [...unique.values()];
}

function getPrimaryLogin(user: WebAppUser, providers: ProviderBinding[]) {
  return user.email || providers[0]?.accountId || user.name || user.id;
}

function getDaysLeft(endsAt?: string | null) {
  if (!endsAt) {
    return 0;
  }

  const diff = new Date(endsAt).getTime() - Date.now();

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function maskAccountId(value: string) {
  if (value.includes("@")) {
    return value;
  }

  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function SectionHeader({ children }: { children: ReactNode }) {
  return <div className="text-xl font-semibold tracking-tight">{children}</div>;
}

function MiniTile({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-24 rounded-3xl border bg-muted/50 p-4 transition-colors",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const [entitlementsResult, paymentsResult] = await Promise.all([
    getEntitlements(),
    getPayments(),
  ]);
  const providers = getProviderBindings(user);
  const primaryLogin = getPrimaryLogin(user, providers);
  const activeEntitlement = getActiveEntitlement(entitlementsResult.items);
  const paymentRows = getPaymentRows(paymentsResult.items);
  const recentPayments = paymentRows.slice(0, 4);
  const userInitials = getUserInitials(user);
  const planName = activeEntitlement?.plan.name ?? "Нет тарифа";
  const daysLeft = getDaysLeft(activeEntitlement?.endsAt);

  return (
    <main className="relative min-h-svh bg-background px-4 py-8 md:py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2 md:right-8 md:top-6">
        <SettingsThemeToggleCompact />
        <SettingsLogoutIconButton />
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-9">
        <section className="flex flex-col items-center text-center">
          <div className="relative mb-[14px] size-[128px]">
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_210deg,#ff5f6d,#d946ef,#4361ee,#ff5f6d)] p-[3px]">
              <div className="flex size-full items-center justify-center rounded-full bg-background p-[6px]">
                <div className="flex size-[110px] items-center justify-center overflow-hidden rounded-full bg-sky-100 text-3xl font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                  {user.image ? (
                    <img
                      alt={user.name || "OfferGO avatar"}
                      className="size-full object-cover"
                      src={user.image}
                    />
                  ) : (
                    <span aria-hidden="true">{userInitials}</span>
                  )}
                </div>
              </div>
            </div>
            <span className="absolute right-[1px] bottom-[3px] flex size-[46px] items-center justify-center rounded-full border-[5px] border-background bg-muted-foreground text-background shadow-lg [&_svg]:size-[24px]">
              <BadgeCheckIcon />
            </span>
          </div>

          <div className="flex items-center justify-center gap-[4px]">
            <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em]">
              {user.name || "Пользователь OfferGO"}
            </h1>
            <Button
              aria-label="Редактировать профиль"
              className="size-5 rounded-md p-0 text-muted-foreground hover:bg-transparent hover:text-foreground [&_svg]:size-[14px]"
              size="icon-xs"
              variant="ghost"
            >
              <PencilIcon />
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader>Данные аккаунта</SectionHeader>
          <ItemGroup>
            <Item size="xs">
              <ItemContent>
                <ItemTitle>Email</ItemTitle>
                <ItemDescription>{user.email || primaryLogin}</ItemDescription>
              </ItemContent>
            </Item>
            <ItemSeparator />
            <Item size="xs">
              <ItemContent>
                <ItemTitle>ID</ItemTitle>
                <ItemDescription>{user.id}</ItemDescription>
              </ItemContent>
            </Item>
          </ItemGroup>
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <SectionHeader>Персональные данные</SectionHeader>
          <SettingsPrivacyControls />
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <SectionHeader>Способы входа</SectionHeader>
          <div className="flex flex-col gap-2">
            {providers.length > 0 ? (
              providers.map((provider) => (
                <ProviderButton
                  key={`${provider.providerId}:${provider.accountId}`}
                  provider={provider}
                />
              ))
            ) : (
              <Alert>
                <FingerprintIcon data-icon="inline-start" />
                <AlertTitle>Способ входа не определён</AlertTitle>
                <AlertDescription>
                  После следующего входа аккаунт появится в этом разделе.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <SectionHeader>Подписка</SectionHeader>
          <ItemGroup>
            <Item size="xs">
              <ItemContent>
                <ItemTitle>Тариф</ItemTitle>
                <ItemDescription>{planName}</ItemDescription>
              </ItemContent>
              {activeEntitlement ? (
                <ItemActions>
                  <Button asChild size="xs" variant="outline">
                    <Link href="/billing">Продлить тариф</Link>
                  </Button>
                </ItemActions>
              ) : null}
            </Item>
            <ItemSeparator />
            <Item size="xs">
              <ItemContent>
                <ItemTitle>Статус</ItemTitle>
                <ItemDescription>
                  {activeEntitlement ? "активна" : "подписка не активна"}
                </ItemDescription>
              </ItemContent>
            </Item>
            <ItemSeparator />
            <Item asChild size="xs">
              <Link href="/subscription">
                <ItemContent>
                  <ItemTitle>Период</ItemTitle>
                  <ItemDescription>
                    {activeEntitlement
                      ? `${formatDate(activeEntitlement.startsAt)} — ${formatDate(activeEntitlement.endsAt)}`
                      : "—"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ExternalLinkIcon className="size-4" />
                </ItemActions>
              </Link>
            </Item>
            <ItemSeparator />
            <Item asChild size="xs">
              <Link href="/subscription">
                <ItemContent>
                  <ItemTitle>Подписка</ItemTitle>
                  <ItemDescription>
                    {activeEntitlement ? `${daysLeft} дн.` : "—"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ExternalLinkIcon className="size-4" />
                </ItemActions>
              </Link>
            </Item>
          </ItemGroup>
          {entitlementsResult.error ? (
            <Alert variant="destructive">
              <AlertTitle>Подписка временно недоступна</AlertTitle>
              <AlertDescription>{entitlementsResult.error}</AlertDescription>
            </Alert>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader>Платежи</SectionHeader>
          {paymentsResult.error ? (
            <Alert variant="destructive">
              <AlertTitle>Платежи временно недоступны</AlertTitle>
              <AlertDescription>{paymentsResult.error}</AlertDescription>
            </Alert>
          ) : recentPayments.length > 0 ? (
            <ItemGroup>
              {recentPayments.map((payment, index) => (
                <div key={payment.id}>
                  <Item asChild size="xs">
                    <Link href={`/billing/payment/${payment.id}`}>
                      <ItemContent>
                        <ItemTitle>
                          {payment.plan?.name ?? payment.plan?.code ?? "Тариф"}
                        </ItemTitle>
                        <ItemDescription>
                          {formatDate(getPaymentDate(payment))}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Badge variant={getStatusVariant(payment.status)}>
                          {getStatusLabel(payment.status)}
                        </Badge>
                        <span className="text-sm font-medium">
                          {formatMoney(payment.amountRub)}
                        </span>
                        <ExternalLinkIcon className="size-4" />
                      </ItemActions>
                    </Link>
                  </Item>
                  {index < recentPayments.length - 1 ? <ItemSeparator /> : null}
                </div>
              ))}
            </ItemGroup>
          ) : (
            <MiniTile>
              <p className="font-medium">Платежей пока нет</p>
              <p className="mt-1 text-sm text-muted-foreground">
                После покупки тарифа операции появятся здесь.
              </p>
            </MiniTile>
          )}
        </section>
      </div>
    </main>
  );
}
