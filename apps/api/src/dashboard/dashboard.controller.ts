import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { getUsageOverview } from "@offergo/billing";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { prisma } from "@offergo/db";

import { ApiAuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

const chartDays = 30;
const oneDayMs = 24 * 60 * 60 * 1000;

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getChartWindow(now = new Date()) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(today.getTime() - (chartDays - 1) * oneDayMs);
  const end = new Date(today.getTime() + oneDayMs);

  return { start, end };
}

function createChartBuckets(start: Date) {
  return Array.from({ length: chartDays }).map((_, index) => {
    const date = new Date(start.getTime() + index * oneDayMs);
    const key = toDateKey(date);

    return {
      date: key,
      label: new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }).format(date),
      vacancyViews: 0,
      responses: 0,
      autoResponses: 0,
      applications: 0,
      analyses: 0,
    };
  });
}

function incrementBucket(
  buckets: ReturnType<typeof createChartBuckets>,
  date: Date,
  field: keyof Omit<(typeof buckets)[number], "date" | "label">,
) {
  const key = toDateKey(date);
  const bucket = buckets.find((item) => item.date === key);

  if (bucket) {
    bucket[field] += 1;
  }
}

function countByStatus(
  rows: Array<{ status: string; _count: { _all: number } }>,
  status: string,
) {
  return rows.find((item) => item.status === status)?._count._all ?? 0;
}

function buildActivityHref(type: string, payload?: { resumeId?: string | null }) {
  if (type === "resume_updated" && payload?.resumeId) {
    return `/resumes/${payload.resumeId}`;
  }

  if (type === "resume_updated") {
    return "/resumes";
  }

  if (type === "response_generated") {
    return "/cover-materials/individual-responses";
  }

  if (type === "auto_response_generated") {
    return "/cover-materials/auto-responses";
  }

  if (type === "resume_analysis") {
    return "/resumes";
  }

  return "/vacancies";
}

@ApiTags("dashboard")
@ApiBearerAuth("bearer")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({ description: "Authentication required." })
@UseGuards(ApiAuthGuard)
@Controller("dashboard")
export class DashboardController {
  @Get("summary")
  async getSummary(@CurrentUser() user: AuthenticatedAppUser) {
    const now = new Date();
    const usageOverview = await getUsageOverview(user.id, now);
    const periodStart = usageOverview.periodStart;
    const periodEnd = usageOverview.periodEnd;
    const chartWindow = getChartWindow(now);
    const chartBuckets = createChartBuckets(chartWindow.start);

    const [
      resumeStatusCounts,
      periodResponses,
      periodAutoResponses,
      periodAnalyses,
      periodVacancyViews,
      periodApplications,
      chartResponses,
      chartAnalyses,
      chartVacancyEvents,
      recentResponses,
      recentAnalyses,
      recentResumes,
      recentVacancyEvents,
    ] = await Promise.all([
      prisma.resume.groupBy({
        by: ["status"],
        where: {
          userId: user.id,
          deletedAt: null,
        },
        _count: { _all: true },
      }),
      prisma.individualResponseArtifact.count({
        where: {
          userId: user.id,
          deletedAt: null,
          source: "manual",
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.individualResponseArtifact.count({
        where: {
          userId: user.id,
          deletedAt: null,
          source: "hh_browser_copilot",
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.resumeAnalysisArtifact.count({
        where: {
          userId: user.id,
          deletedAt: null,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.vacancyUserEvent.count({
        where: {
          userId: user.id,
          type: "view_detail",
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.vacancyUserEvent.count({
        where: {
          userId: user.id,
          type: "application_confirmed",
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.individualResponseArtifact.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          createdAt: { gte: chartWindow.start, lt: chartWindow.end },
        },
        select: { createdAt: true, source: true },
      }),
      prisma.resumeAnalysisArtifact.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          createdAt: { gte: chartWindow.start, lt: chartWindow.end },
        },
        select: { createdAt: true },
      }),
      prisma.vacancyUserEvent.findMany({
        where: {
          userId: user.id,
          type: { in: ["view_detail", "application_confirmed"] },
          createdAt: { gte: chartWindow.start, lt: chartWindow.end },
        },
        select: { createdAt: true, type: true },
      }),
      prisma.individualResponseArtifact.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          source: true,
          resumeTitle: true,
          vacancyTitle: true,
          employerName: true,
          decision: true,
          createdAt: true,
        },
      }),
      prisma.resumeAnalysisArtifact.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      }),
      prisma.resume.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.vacancyUserEvent.findMany({
        where: {
          userId: user.id,
          type: { in: ["view_detail", "application_confirmed"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          createdAt: true,
          vacancy: {
            select: {
              title: true,
              companyName: true,
            },
          },
        },
      }),
    ]);

    for (const item of chartResponses) {
      incrementBucket(chartBuckets, item.createdAt, "responses");

      if (item.source === "hh_browser_copilot") {
        incrementBucket(chartBuckets, item.createdAt, "autoResponses");
      }
    }

    for (const item of chartAnalyses) {
      incrementBucket(chartBuckets, item.createdAt, "analyses");
    }

    for (const item of chartVacancyEvents) {
      incrementBucket(
        chartBuckets,
        item.createdAt,
        item.type === "application_confirmed" ? "applications" : "vacancyViews",
      );
    }

    const recentActivity = [
      ...recentResponses.map((item) => ({
        id: `response-${item.id}`,
        type:
          item.source === "hh_browser_copilot"
            ? "auto_response_generated"
            : "response_generated",
        title:
          item.vacancyTitle ??
          (item.source === "hh_browser_copilot"
            ? "Автоотклик сформирован"
            : "Индивидуальный отклик сформирован"),
        description:
          [item.employerName, item.resumeTitle].filter(Boolean).join(" · ") ||
          item.decision,
        href: buildActivityHref(
          item.source === "hh_browser_copilot"
            ? "auto_response_generated"
            : "response_generated",
        ),
        createdAt: item.createdAt,
      })),
      ...recentAnalyses.map((item) => ({
        id: `analysis-${item.id}`,
        type: "resume_analysis",
        title: "ИИ-анализ резюме",
        description: item.title,
        href: buildActivityHref("resume_analysis"),
        createdAt: item.createdAt,
      })),
      ...recentResumes.map((item) => ({
        id: `resume-${item.id}`,
        type: "resume_updated",
        title: item.title,
        description: item.status === "draft" ? "Черновик резюме" : "Резюме обновлено",
        href: buildActivityHref("resume_updated", { resumeId: item.id }),
        createdAt: item.updatedAt,
      })),
      ...recentVacancyEvents.map((item) => ({
        id: `vacancy-${item.id}`,
        type:
          item.type === "application_confirmed"
            ? "application_confirmed"
            : "vacancy_viewed",
        title: item.vacancy.title,
        description:
          item.type === "application_confirmed"
            ? `Отклик подтверждён · ${item.vacancy.companyName}`
            : `Просмотр вакансии · ${item.vacancy.companyName}`,
        href: buildActivityHref("vacancy_viewed"),
        createdAt: item.createdAt,
      })),
    ]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 8);

    const activeResumes = resumeStatusCounts.reduce(
      (sum, item) => sum + item._count._all,
      0,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      period: {
        startsAt: periodStart,
        endsAt: periodEnd,
      },
      plan: {
        id: usageOverview.plan.id,
        code: usageOverview.plan.code,
        name: usageOverview.plan.name,
        rank: usageOverview.plan.rank,
      },
      limits: usageOverview.items,
      metrics: {
        resumes: {
          active: activeResumes,
          draft: countByStatus(resumeStatusCounts, "draft"),
          completed: activeResumes - countByStatus(resumeStatusCounts, "draft"),
        },
        responses: {
          individual: periodResponses,
          auto: periodAutoResponses,
          total: periodResponses + periodAutoResponses,
        },
        resumeAnalyses: periodAnalyses,
        vacancies: {
          views: periodVacancyViews,
          applications: periodApplications,
        },
      },
      chart: chartBuckets,
      recentActivity,
    };
  }
}
