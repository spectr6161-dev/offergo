import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import {
  AlertCircleIcon,
  CreditCardIcon,
  GaugeIcon,
  KeyboardIcon,
  PlayCircleIcon,
  ScanLineIcon,
  ShieldAlertIcon,
  TimerIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

import { AssistantSettingsPanel } from "@/components/interview-assistant/assistant-settings-panel";
import type {
  BillingSubscriptionSummary,
  BillingUsageLimit,
} from "@/components/pricing-section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { apiFetch, getApiErrorMessage } from "@/lib/api";

type SubscriptionResult =
  | {
      subscription: BillingSubscriptionSummary;
      error?: never;
    }
  | {
      subscription?: never;
      error: string;
    };

type AssistantFeature =
  | "wpf_audio_seconds"
  | "wpf_screenshot"
  | "wpf_text_request";

const assistantFeatures: AssistantFeature[] = [
  "wpf_audio_seconds",
  "wpf_screenshot",
  "wpf_text_request",
];

const featureIcons: Record<AssistantFeature, LucideIcon> = {
  wpf_audio_seconds: TimerIcon,
  wpf_screenshot: ScanLineIcon,
  wpf_text_request: KeyboardIcon,
};

const featureLabels: Record<AssistantFeature, string> = {
  wpf_audio_seconds: "Аудиораспознавание на собеседовании",
  wpf_screenshot: "Анализ скриншотов",
  wpf_text_request: "Анализ текстовых запросов",
};

function WindowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        d="M3 5.1 10.8 4v7.4H3V5.1Zm9-1.25L21 2.6v8.8h-9V3.85ZM3 12.6h7.8V20L3 18.9v-6.3Zm9 0h9v8.8l-9-1.25V12.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

async function getSubscription(): Promise<SubscriptionResult> {
  try {
    const subscription = await apiFetch<BillingSubscriptionSummary>(
      "/api/v1/billing/subscription",
    );

    return { subscription };
  } catch (error) {
    return { error: getApiErrorMessage(error) };
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatAudioSeconds(value: number) {
  const minutes = Math.floor(value / 60);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes ? `${hours} ч ${restMinutes} мин` : `${hours} ч`;
  }

  return `${minutes} мин`;
}

function formatLimitValue(feature: string, value: number | null) {
  if (value === null) {
    return "Безлимит";
  }

  if (feature === "wpf_audio_seconds") {
    return formatAudioSeconds(value);
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

function getAssistantLimits(subscription?: BillingSubscriptionSummary) {
  if (!subscription) {
    return [];
  }

  return assistantFeatures
    .map((feature) =>
      subscription.limits.find((item) => item.feature === feature),
    )
    .filter((item): item is BillingUsageLimit => Boolean(item));
}

function DownloadSection() {
  return (
    <section className="flex w-full">
      <Button
        asChild
        className="h-16 w-full rounded-2xl bg-sky-600 px-8 text-lg font-semibold text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-white dark:hover:bg-sky-600 sm:w-auto sm:min-w-96"
        size="lg"
      >
        <Link href="/interview-assistant/install">
          <WindowsIcon data-icon="inline-start" />
          Скачать для Windows
        </Link>
      </Button>
    </section>
  );
}

function UsageLimitItem({
  item,
  isLast,
}: {
  item: BillingUsageLimit;
  isLast: boolean;
}) {
  const feature = item.feature as AssistantFeature;
  const Icon = featureIcons[feature] ?? GaugeIcon;
  const used = item.used + item.reserved;
  const enforcementLimit = item.enforcementLimit ?? item.limit;
  const exhausted = enforcementLimit !== null && used >= enforcementLimit;
  const progress = getUsageProgress(item);
  const limitLabel = item.unlimited
    ? "Безлимит"
    : formatLimitValue(item.feature, item.limit);
  const remaining =
    enforcementLimit === null ? null : Math.max(0, enforcementLimit - used);

  return (
    <>
      <Item className="px-0 py-5" variant="default">
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full text-base">
            {featureLabels[feature] ?? item.label}
          </ItemTitle>
          <ItemDescription>
            Использовано {formatLimitValue(item.feature, used)} из {limitLabel}.
            Обновится {formatDate(item.resetAt)}.
          </ItemDescription>
          {item.unlimited && item.fairUseLimit ? (
            <ItemDescription>
              Технический предел:{" "}
              {formatLimitValue(item.feature, item.fairUseLimit)}.
            </ItemDescription>
          ) : null}
        </ItemContent>
        <ItemActions className="basis-full justify-between sm:basis-auto sm:justify-end">
          <span className="text-sm font-semibold">
            {remaining === null
              ? "Безлимит"
              : `Осталось ${formatLimitValue(item.feature, remaining)}`}
          </span>
          {exhausted ? (
            <Badge variant="destructive">Исчерпан</Badge>
          ) : item.unlimited ? (
            <Badge variant="secondary">Безлимит</Badge>
          ) : null}
        </ItemActions>
        <ItemFooter className="mt-2 flex-col items-stretch gap-2">
          <Progress value={progress} />
        </ItemFooter>
      </Item>
      {!isLast ? <ItemSeparator className="my-0" /> : null}
    </>
  );
}

function LimitsSection({
  error,
  limits,
  periodEnd,
  periodStart,
}: {
  error?: string;
  limits: BillingUsageLimit[];
  periodEnd?: string;
  periodStart?: string;
}) {
  const hasExhaustedLimit = limits.some((item) => {
    const total = item.enforcementLimit ?? item.limit;
    return total !== null && item.used + item.reserved >= total;
  });

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Лимиты помощника
          </h2>
          <p className="text-sm text-muted-foreground">
            {periodStart && periodEnd
              ? `Текущий период: ${formatDate(periodStart)} - ${formatDate(periodEnd)}`
              : "Данные по текущему периоду временно недоступны."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/subscription">Посмотреть все лимиты</Link>
          </Button>
          <Button
            asChild
            className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-white dark:hover:bg-sky-600"
          >
            <Link href="/billing">
              {hasExhaustedLimit ? "Увеличить лимиты" : "Расширить лимиты"}
              <CreditCardIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Не удалось загрузить лимиты</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {limits.length > 0 ? (
        <ItemGroup className="gap-0">
          {limits.map((item, index) => (
            <UsageLimitItem
              isLast={index === limits.length - 1}
              item={item}
              key={item.feature}
            />
          ))}
        </ItemGroup>
      ) : error ? null : (
        <Alert>
          <GaugeIcon />
          <AlertTitle>Лимиты не найдены</AlertTitle>
          <AlertDescription>
            Данные по лимитам помощника появятся после обновления тарифов.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function VisualStep({
  children,
  label,
  title,
}: {
  children: ReactNode;
  label: string;
  title: string;
}) {
  return (
    <Item className="items-start px-0 py-4" variant="default">
      <ItemMedia>
        <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {label}
        </div>
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="w-full text-base">{title}</ItemTitle>
        <ItemDescription className="line-clamp-none">{children}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function MockImage({ title }: { title: string }) {
  return (
    <div className="mt-3 rounded-2xl bg-muted/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <PlayCircleIcon />
        {title}
      </div>
      <div className="grid gap-2">
        <div className="h-3 w-2/3 rounded-full bg-background" />
        <div className="h-3 w-5/6 rounded-full bg-background" />
        <div className="h-16 rounded-xl bg-background" />
      </div>
    </div>
  );
}

function TrainingSection() {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Обучение работе
        </h2>
        <p className="text-sm text-muted-foreground">
          Видео и визуальные шаги вместо длинной текстовой инструкции.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-3xl bg-muted/50">
          <video
            className="aspect-video w-full bg-muted"
            controls
            preload="metadata"
            src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
          />
        </div>
        <ItemGroup className="gap-0">
          <VisualStep label="1" title="Скачайте ZIP">
            Откройте страницу установки, дождитесь автоматической загрузки или
            нажмите кнопку “Скачать сейчас”.
            <MockImage title="Экран загрузки" />
          </VisualStep>
          <ItemSeparator className="my-0" />
          <VisualStep label="2" title="Распакуйте архив">
            Перенесите папку в удобное место, например в документы или на диск с
            программами.
            <MockImage title="Папка с приложением" />
          </VisualStep>
          <ItemSeparator className="my-0" />
          <VisualStep label="3" title="Запустите приложение">
            Нажмите <code>TutorOverlay.Client.exe</code>, войдите в аккаунт и
            запустите live-сессию.
            <MockImage title="Окно входа" />
          </VisualStep>
        </ItemGroup>
      </div>
    </section>
  );
}

function TroubleshootingSection() {
  const items = [
    {
      title: "Браузер пишет, что файл небезопасный",
      description:
        "Такое бывает у новых приложений без широкой истории скачиваний. На странице установки есть пошаговая инструкция, как сохранить файл вручную.",
      media: "Предупреждение браузера",
    },
    {
      title: "Windows показывает SmartScreen",
      description:
        "Откройте подробности и подтвердите запуск, если скачивали файл с offergo.ru.",
      media: "SmartScreen",
    },
    {
      title: "Не получается войти",
      description:
        "Проверьте, что вход выполняется тем же аккаунтом OfferGO. Если токен устарел, выйдите из приложения и подключитесь заново.",
      media: "Окно подключения",
    },
    {
      title: "Лимит закончился",
      description:
        "Откройте тарифы и увеличьте лимиты. До оплаты соответствующая функция будет недоступна.",
      media: "Лимиты тарифа",
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <WrenchIcon />
        <h2 className="text-2xl font-semibold tracking-tight">
          Проблемы и решения
        </h2>
      </div>
      <Accordion collapsible type="single">
        {items.map((item, index) => (
          <AccordionItem key={item.title} value={`problem-${index}`}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
                <MockImage title={item.media} />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export default async function InterviewAssistantPage() {
  const result = await getSubscription();
  const subscription = "subscription" in result ? result.subscription : undefined;
  const limits = getAssistantLimits(subscription);

  return (
    <main className="min-h-[calc(100svh-var(--shell-header-height))] w-full bg-background p-4 text-foreground md:p-6">
      <section className="flex w-full flex-col gap-10">
        <DownloadSection />
        <AssistantSettingsPanel />
        <Separator />
        <LimitsSection
          error={"error" in result ? result.error : undefined}
          limits={limits}
          periodEnd={subscription?.periodEnd}
          periodStart={subscription?.periodStart}
        />
        <Separator />
        <TrainingSection />
        <Separator />
        <TroubleshootingSection />
        <Alert>
          <ShieldAlertIcon />
          <AlertTitle>Поддержка</AlertTitle>
          <AlertDescription>
            По вопросам работы программы можно круглосуточно писать в службу
            технической поддержки{" "}
            <a href="https://t.me/offergo_bot" rel="noreferrer" target="_blank">
              @offergo_bot
            </a>
            .
          </AlertDescription>
        </Alert>
      </section>
    </main>
  );
}
