import Link from "next/link";
import type { SVGProps } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  GaugeIcon,
  KeyboardIcon,
  ScanLineIcon,
  TimerIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

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

  return (
    <>
      <Item className="px-0 py-4" variant="default">
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="text-base">
            {featureLabels[feature] ?? item.label}
          </ItemTitle>
          <ItemDescription>
            Обновится {formatDate(item.resetAt)}
            {item.unlimited && item.fairUseLimit
              ? `, технический предел ${formatLimitValue(item.feature, item.fairUseLimit)}`
              : ""}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="basis-full justify-between sm:basis-auto sm:justify-end">
          <span className="text-sm font-semibold">
            {formatLimitValue(item.feature, used)} / {limitLabel}
          </span>
          {exhausted ? (
            <Badge variant="destructive">Исчерпан</Badge>
          ) : item.unlimited ? (
            <Badge variant="secondary">Безлимит</Badge>
          ) : null}
        </ItemActions>
        <ItemFooter className="mt-1 flex-col items-stretch gap-2">
          <Progress value={progress} />
        </ItemFooter>
      </Item>
      {!isLast ? <ItemSeparator className="my-0" /> : null}
    </>
  );
}

function DownloadSection() {
  return (
    <section className="flex w-full">
      <Button
        asChild
        className="h-16 w-full rounded-2xl bg-primary px-8 text-lg font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto sm:min-w-96"
        size="lg"
      >
        <a download href="/downloads/offergo-interview-assistant.exe">
          <WindowsIcon data-icon="inline-start" />
          Скачать для Windows
        </a>
      </Button>
    </section>
  );
}

function GuideSection() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Как начать работу
        </h2>
        <p className="text-sm text-muted-foreground">
          Пошаговая настройка занимает несколько минут.
        </p>
      </div>
      <Accordion
        className="w-full"
        defaultValue="install"
        type="single"
        collapsible
      >
        <AccordionItem value="install">
          <AccordionTrigger>1. Скачать приложение</AccordionTrigger>
          <AccordionContent>
            Скачайте exe-файл и запустите его на Windows. Сборка
            самодостаточная, отдельная установка .NET Desktop Runtime 8 не
            требуется.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="login">
          <AccordionTrigger>2. Подключить аккаунт</AccordionTrigger>
          <AccordionContent>
            В приложении нажмите вход, подтвердите подключение в браузере и
            дождитесь статуса успешного подключения. Токен хранится локально на
            компьютере.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="model">
          <AccordionTrigger>3. Выбрать модель ответов</AccordionTrigger>
          <AccordionContent>
            В настройках выберите Yandex или Gemini для текстовых подсказок.
            Аудиораспознавание live-сессии работает отдельно от выбора модели
            ответов.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="session">
          <AccordionTrigger>4. Запустить live-сессию</AccordionTrigger>
          <AccordionContent>
            Запустите сессию перед собеседованием. После старта начинают
            расходоваться минуты аудиораспознавания текущего периода.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="tools">
          <AccordionTrigger>5. Использовать запросы и скриншоты</AccordionTrigger>
          <AccordionContent>
            Отправляйте текстовые вопросы вручную или делайте скриншот задачи.
            Каждый текстовый запрос и каждый скриншот расходует отдельный лимит.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function TroubleshootingSection() {
  const items = [
    {
      title: "Приложение не запускается",
      description:
        "Проверьте, что Windows не заблокировала файл после скачивания. Если SmartScreen показывает предупреждение, подтвердите запуск приложения.",
    },
    {
      title: "Не получается войти",
      description:
        "Проверьте, что вход выполняется тем же аккаунтом OfferGO. Если токен устарел, выйдите из приложения и подключитесь заново.",
    },
    {
      title: "Не слышно собеседника",
      description:
        "Проверьте выбранный режим захвата аудио, устройство вывода и разрешения Windows для микрофона.",
    },
    {
      title: "Лимит закончился",
      description:
        "Откройте тарифы и увеличьте лимиты. До оплаты соответствующая функция в приложении будет недоступна.",
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <WrenchIcon />
        <h2 className="text-2xl font-semibold tracking-tight">
          Проблемы и решения
        </h2>
      </div>
      <ItemGroup className="gap-0">
        {items.map((item, index) => (
          <div key={item.title}>
            <Item className="px-0 py-4" variant="default">
              <ItemMedia variant="icon">
                <CheckCircle2Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{item.title}</ItemTitle>
                <ItemDescription>{item.description}</ItemDescription>
              </ItemContent>
            </Item>
            {index < items.length - 1 ? (
              <ItemSeparator className="my-0" />
            ) : null}
          </div>
        ))}
      </ItemGroup>
    </section>
  );
}

export default async function InterviewAssistantPage() {
  const result = await getSubscription();
  const subscription = "subscription" in result ? result.subscription : undefined;
  const limits = getAssistantLimits(subscription);
  const hasExhaustedLimit = limits.some((item) => {
    const total = item.enforcementLimit ?? item.limit;
    return total !== null && item.used + item.reserved >= total;
  });

  return (
    <main className="min-h-[calc(100svh-var(--shell-header-height))] w-full bg-background p-4 text-foreground md:p-6">
      <section className="flex w-full flex-col gap-8">
        <DownloadSection />
        <Separator />

        {result.error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Не удалось загрузить лимиты</AlertTitle>
            <AlertDescription>
              {result.error}. Скачать приложение и открыть инструкцию можно
              прямо сейчас.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Лимиты помощника
              </h2>
              <p className="text-sm text-muted-foreground">
                Текущий период:{" "}
                {subscription
                  ? `${formatDate(subscription.periodStart)} - ${formatDate(subscription.periodEnd)}`
                  : "данные временно недоступны"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/subscription">Посмотреть лимиты</Link>
              </Button>
              <Button asChild>
                <Link href="/billing">
                  {hasExhaustedLimit ? "Увеличить лимиты" : "Открыть тарифы"}
                  <CreditCardIcon data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </div>

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
          ) : result.error ? null : (
            <Alert>
              <GaugeIcon />
              <AlertTitle>Лимиты не найдены</AlertTitle>
              <AlertDescription>
                Данные по лимитам помощника появятся после обновления тарифов.
              </AlertDescription>
            </Alert>
          )}
        </section>

        <GuideSection />
        <TroubleshootingSection />
      </section>
    </main>
  );
}
