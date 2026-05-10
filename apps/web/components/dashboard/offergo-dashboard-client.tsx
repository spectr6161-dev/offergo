"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ActivityIcon,
  BotIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  ChevronRightIcon,
  CreditCardIcon,
  FilePlus2Icon,
  FileSearchIcon,
  FileTextIcon,
  MailPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type DashboardLimit = {
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

type DashboardActivity = {
  id: string;
  type: string;
  title: string;
  description: string;
  href: string;
  createdAt: string;
};

type DashboardChartPoint = {
  date: string;
  label: string;
  vacancyViews: number;
  responses: number;
  autoResponses: number;
  applications: number;
  analyses: number;
};

type ChartRange = "7d" | "14d" | "30d";

export type DashboardSummary = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  period: {
    startsAt: string;
    endsAt: string;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    rank: number;
  };
  limits: DashboardLimit[];
  metrics: {
    resumes: {
      active: number;
      draft: number;
      completed: number;
    };
    responses: {
      individual: number;
      auto: number;
      total: number;
    };
    resumeAnalyses: number;
    vacancies: {
      views: number;
      applications: number;
    };
  };
  chart: DashboardChartPoint[];
  recentActivity: DashboardActivity[];
};

const chartConfig = {
  vacancyViews: {
    label: "Просмотры вакансий",
    color: "var(--chart-1)",
  },
  responses: {
    label: "Отклики",
    color: "var(--chart-2)",
  },
  applications: {
    label: "Отправлено",
    color: "var(--chart-3)",
  },
  analyses: {
    label: "Анализы резюме",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const rangeLabels: Record<ChartRange, string> = {
  "7d": "7 дней",
  "14d": "14 дней",
  "30d": "30 дней",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return value.toLocaleString("ru-RU");
}

function getLimit(summary: DashboardSummary, feature: string) {
  return summary.limits.find((item) => item.feature === feature) ?? null;
}

function getRemaining(limit: DashboardLimit | null) {
  if (!limit) {
    return null;
  }

  const total = limit.enforcementLimit ?? limit.limit;

  if (total === null) {
    return null;
  }

  return Math.max(0, total - limit.used - limit.reserved);
}

function getLimitProgress(limit: DashboardLimit | null) {
  if (!limit) {
    return null;
  }

  const total = limit.enforcementLimit ?? limit.limit;

  if (!total || total <= 0) {
    return limit.unlimited ? null : 100;
  }

  return Math.min(100, Math.round(((limit.used + limit.reserved) / total) * 100));
}

function filterChartData(chart: DashboardChartPoint[], range: ChartRange) {
  const days = Number.parseInt(range, 10);
  return chart.slice(-days);
}

function getChartTotals(chart: DashboardChartPoint[]) {
  return chart.reduce(
    (acc, item) => ({
      vacancyViews: acc.vacancyViews + item.vacancyViews,
      responses: acc.responses + item.responses,
      applications: acc.applications + item.applications,
      analyses: acc.analyses + item.analyses,
    }),
    { vacancyViews: 0, responses: 0, applications: 0, analyses: 0 },
  );
}

function MetricCard({
  title,
  value,
  footerTitle,
  footerDescription,
}: {
  title: string;
  value: string;
  footerTitle: string;
  footerDescription: string;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 font-medium">{footerTitle}</div>
        <div className="text-muted-foreground">{footerDescription}</div>
      </CardFooter>
    </Card>
  );
}

function SectionCards({ summary }: { summary: DashboardSummary }) {
  const responseLimit = getLimit(summary, "individual_response");
  const responseRemaining = getRemaining(responseLimit);
  const responseProgress = getLimitProgress(responseLimit);
  const limitText =
    responseRemaining === null
      ? summary.plan.name
      : formatNumber(responseRemaining);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <MetricCard
        title="Резюме"
        value={formatNumber(summary.metrics.resumes.active)}
        footerTitle={`${summary.metrics.resumes.completed} завершено`}
        footerDescription={`${summary.metrics.resumes.draft} черновиков в работе`}
      />
      <MetricCard
        title="Отклики"
        value={formatNumber(summary.metrics.responses.total)}
        footerTitle={`${summary.metrics.responses.individual} индивидуальных`}
        footerDescription={`${summary.metrics.responses.auto} автооткликов через расширение`}
      />
      <MetricCard
        title="Вакансии"
        value={formatNumber(summary.metrics.vacancies.views)}
        footerTitle={`${summary.metrics.vacancies.applications} отправлено`}
        footerDescription="Подтверждённые отклики учитываются отдельно"
      />
      <MetricCard
        title="Лимиты"
        value={limitText}
        footerTitle={
          responseProgress === null
            ? "Без ограничений"
            : `${responseProgress}% использовано`
        }
        footerDescription="Индивидуальные отклики текущего периода"
      />
    </div>
  );
}

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

function QuickActionItem({
  action,
  secondary = false,
}: {
  action: QuickAction;
  secondary?: boolean;
}) {
  const Icon = action.icon;

  return (
    <Item asChild className="py-3 hover:bg-muted/50">
      <Link href={action.href}>
        <ItemMedia
          className={cn(
            "size-9 rounded-md",
            secondary
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary",
          )}
          variant="icon"
        >
          <Icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{action.title}</ItemTitle>
          <ItemDescription>{action.description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <ChevronRightIcon />
        </ItemActions>
      </Link>
    </Item>
  );
}

function QuickActions() {
  const groups: Array<{
    title: string;
    actions: QuickAction[];
  }> = [
    {
      title: "Резюме",
      actions: [
        {
          href: "/resumes/create",
          title: "Создать резюме",
          description: "Заполнить анкету и собрать новое резюме",
          icon: FilePlus2Icon,
        },
        {
          href: "/resumes",
          title: "Мои резюме",
          description: "Открыть библиотеку резюме и файлов",
          icon: FileTextIcon,
        },
        {
          href: "/resumes",
          title: "Анализировать резюме",
          description: "Выберите резюме и запустите проверку",
          icon: FileSearchIcon,
        },
      ],
    },
    {
      title: "Отклики",
      actions: [
        {
          href: "/cover-materials/individual-responses",
          title: "Сформировать письмо",
          description: "Отклик под конкретную вакансию",
          icon: MailPlusIcon,
        },
        {
          href: "/cover-materials/auto-responses",
          title: "Автоотклики",
          description: "Подключение расширения и история",
          icon: BotIcon,
        },
      ],
    },
    {
      title: "Работа",
      actions: [
        {
          href: "/vacancies",
          title: "Вакансии",
          description: "Открыть список вакансий и фильтры",
          icon: BriefcaseBusinessIcon,
        },
        {
          href: "/employers-bank",
          title: "Работодатели",
          description: "Список компаний и переходы",
          icon: Building2Icon,
        },
      ],
    },
  ];
  const accountAction: QuickAction = {
    href: "/subscription",
    title: "Тариф и лимиты",
    description: "Посмотреть текущий тариф, лимиты и остатки",
    icon: CreditCardIcon,
  };

  return (
    <section className="px-4 lg:px-6">
      <div className="flex flex-col gap-4">
        <div className="grid gap-5 lg:grid-cols-3">
          {groups.map((group) => (
            <div className="flex min-w-0 flex-col gap-2" key={group.title}>
              <h2 className="px-3 text-sm font-medium text-muted-foreground">
                {group.title}
              </h2>
              <ItemGroup className="gap-1">
                {group.actions.map((action) => (
                  <QuickActionItem
                    action={action}
                    key={`${action.href}:${action.title}`}
                  />
                ))}
              </ItemGroup>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-2">
            <ItemGroup className="gap-1">
              <QuickActionItem action={accountAction} secondary />
            </ItemGroup>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChartLegendItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-none tabular-nums">
          {formatNumber(value)}
        </div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ActivityChart({ summary }: { summary: DashboardSummary }) {
  const [range, setRange] = useState<ChartRange>("14d");
  const chartData = useMemo(
    () => filterChartData(summary.chart, range),
    [range, summary.chart],
  );
  const totals = useMemo(() => getChartTotals(chartData), [chartData]);

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Динамика активности</CardTitle>
        <CardDescription>
          Что пользователь делал в продукте за выбранный период
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(value) => {
              if (value) {
                setRange(value as ChartRange);
              }
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4 @[767px]/card:flex"
          >
            {(Object.keys(rangeLabels) as ChartRange[]).map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {rangeLabels[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="grid gap-2 px-2 sm:grid-cols-2 lg:grid-cols-4 sm:px-0">
          <ChartLegendItem
            color="var(--color-vacancyViews)"
            label="Просмотры вакансий"
            value={totals.vacancyViews}
          />
          <ChartLegendItem
            color="var(--color-responses)"
            label="Сформированные отклики"
            value={totals.responses}
          />
          <ChartLegendItem
            color="var(--color-applications)"
            label="Подтверждённые отправки"
            value={totals.applications}
          />
          <ChartLegendItem
            color="var(--color-analyses)"
            label="ИИ-анализы резюме"
            value={totals.analyses}
          />
        </div>

        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[280px] w-full"
          initialDimension={{ width: 720, height: 280 }}
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillVacancyViews" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-vacancyViews)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-vacancyViews)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillResponses" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-responses)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-responses)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillApplications" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-applications)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-applications)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillAnalyses" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-analyses)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-analyses)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="vacancyViews"
              type="natural"
              fill="url(#fillVacancyViews)"
              stroke="var(--color-vacancyViews)"
              stackId="a"
            />
            <Area
              dataKey="responses"
              type="natural"
              fill="url(#fillResponses)"
              stroke="var(--color-responses)"
              stackId="a"
            />
            <Area
              dataKey="applications"
              type="natural"
              fill="url(#fillApplications)"
              stroke="var(--color-applications)"
              stackId="a"
            />
            <Area
              dataKey="analyses"
              type="natural"
              fill="url(#fillAnalyses)"
              stroke="var(--color-analyses)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ActivityTable({ items }: { items: DashboardActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние действия</CardTitle>
        <CardDescription>
          Резюме, отклики, вакансии и анализы, которые недавно менялись
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Событие</TableHead>
              <TableHead>Контекст</TableHead>
              <TableHead className="hidden md:table-cell">Дата</TableHead>
              <TableHead className="text-right">Переход</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={4}
                >
                  Действий пока нет. Создайте резюме или сформируйте отклик.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <ActivityIcon />
                      <span className="max-w-[260px] truncate">{item.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate text-muted-foreground">
                    {item.description}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDateTime(item.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={item.href}>Открыть</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function OffergoDashboardClient({
  summary,
}: {
  summary: DashboardSummary;
}) {
  return (
    <main className="@container/main flex w-full flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards summary={summary} />
        <QuickActions />
        <div className="px-4 lg:px-6">
          <ActivityChart summary={summary} />
        </div>
        <div className="px-4 lg:px-6">
          <ActivityTable items={summary.recentActivity} />
        </div>
      </div>
    </main>
  );
}
