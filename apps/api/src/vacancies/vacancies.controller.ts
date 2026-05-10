import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Prisma, prisma, type Vacancy } from "@offergo/db";
import type { AuthenticatedAppUser } from "@offergo/auth/session";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiAuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

const pageSizeMax = 60;

const publicVacanciesQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  category: z.string().trim().max(120).optional(),
  level: z.string().trim().max(80).optional(),
  workFormat: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  minSalary: z.coerce.number().int().min(0).optional(),
  maxSalary: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["recent", "salary"]).default("recent"),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(pageSizeMax).default(30),
});

const adminVacanciesQuerySchema = publicVacanciesQuerySchema.extend({
  status: z.enum(["all", "published", "hidden"]).default("all"),
});

const vacancyEventSchema = z.object({
  type: z.enum([
    "view_detail",
    "open_source",
    "cover_letter_start",
    "application_confirmed",
  ]),
  source: z.string().trim().min(1).max(80).default("web").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(4_000).nullable().optional(),
);

const nullableLongText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(40_000).nullable().optional(),
);

const nullableUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().url().max(2_000).nullable().optional(),
);

const vacancyMutationSchema = z.object({
  externalId: z.string().trim().max(160).optional(),
  title: z.string().trim().min(1).max(300),
  companyName: z.string().trim().min(1).max(220),
  categoryName: z.string().trim().min(1).max(160),
  categorySlug: z.string().trim().min(1).max(160),
  level: z.string().trim().min(1).max(80),
  salaryText: nullableText,
  salaryValue: z.coerce.number().int().min(0).nullable().optional(),
  salaryCurrency: z.string().trim().max(20).nullable().optional(),
  workFormat: nullableText,
  location: nullableText,
  datePosted: z.coerce.date().nullable().optional(),
  employmentType: z.string().trim().max(80).nullable().optional(),
  directApply: z.boolean().default(false),
  applyButtonLabel: nullableText,
  applyDirectKind: nullableText,
  description: z.string().trim().max(40_000).default(""),
  skillsText: nullableLongText,
  qualificationsText: nullableLongText,
  benefitsText: nullableLongText,
  url: nullableUrl,
  status: z.enum(["published", "hidden"]).default("published"),
});

const vacancyPatchSchema = vacancyMutationSchema.partial();

function serializeVacancy(vacancy: Vacancy) {
  return {
    id: vacancy.id,
    externalId: vacancy.externalId,
    source: vacancy.source,
    title: vacancy.title,
    companyName: vacancy.companyName,
    categoryName: vacancy.categoryName,
    categorySlug: vacancy.categorySlug,
    level: vacancy.level,
    salaryText: vacancy.salaryText,
    salaryValue: vacancy.salaryValue,
    salaryCurrency: vacancy.salaryCurrency,
    workFormat: vacancy.workFormat,
    location: vacancy.location,
    datePosted: vacancy.datePosted,
    employmentType: vacancy.employmentType,
    directApply: vacancy.directApply,
    applyButtonLabel: vacancy.applyButtonLabel,
    applyDirectKind: vacancy.applyDirectKind,
    description: vacancy.description,
    skillsText: vacancy.skillsText,
    qualificationsText: vacancy.qualificationsText,
    benefitsText: vacancy.benefitsText,
    url: vacancy.url,
    status: vacancy.status,
    createdAt: vacancy.createdAt,
    updatedAt: vacancy.updatedAt,
  };
}

function parseListFilter(value: string | undefined) {
  if (!value || value === "all") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "all");
}

function buildVacancyWhere(
  parsed: z.infer<typeof publicVacanciesQuerySchema>,
): Prisma.VacancyWhereInput {
  const where: Prisma.VacancyWhereInput = {
    status: "published",
  };

  if (parsed.q) {
    where.OR = [
      { title: { contains: parsed.q, mode: "insensitive" } },
      { companyName: { contains: parsed.q, mode: "insensitive" } },
      { categoryName: { contains: parsed.q, mode: "insensitive" } },
      { description: { contains: parsed.q, mode: "insensitive" } },
      { skillsText: { contains: parsed.q, mode: "insensitive" } },
    ];
  }

  const categories = parseListFilter(parsed.category);
  const levels = parseListFilter(parsed.level);
  const workFormats = parseListFilter(parsed.workFormat);
  const locations = parseListFilter(parsed.location);

  if (categories.length === 1) {
    where.categorySlug = categories[0];
  } else if (categories.length > 1) {
    where.categorySlug = { in: categories };
  }

  if (levels.length === 1) {
    where.level = levels[0];
  } else if (levels.length > 1) {
    where.level = { in: levels };
  }

  if (workFormats.length === 1) {
    where.workFormat = workFormats[0];
  } else if (workFormats.length > 1) {
    where.workFormat = { in: workFormats };
  }

  if (locations.length === 1) {
    where.location = locations[0];
  } else if (locations.length > 1) {
    where.location = { in: locations };
  }

  if (parsed.minSalary !== undefined || parsed.maxSalary !== undefined) {
    where.salaryValue = {
      ...(parsed.minSalary !== undefined ? { gte: parsed.minSalary } : {}),
      ...(parsed.maxSalary !== undefined ? { lte: parsed.maxSalary } : {}),
    };
  }

  return where;
}

function vacancyOrderBy(sort: "recent" | "salary"): Prisma.VacancyOrderByWithRelationInput[] {
  if (sort === "salary") {
    return [{ salaryValue: "desc" }, { datePosted: "desc" }, { id: "asc" }];
  }

  return [{ datePosted: "desc" }, { updatedAt: "desc" }, { id: "asc" }];
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё_-]+/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function findVacancyOrThrow(vacancyId: string) {
  const vacancy = await prisma.vacancy.findUnique({
    where: {
      id: vacancyId,
    },
  });

  if (!vacancy) {
    throw new NotFoundException("Вакансия не найдена.");
  }

  return vacancy;
}

@ApiTags("vacancies")
@Controller()
export class VacanciesController {
  @Get("vacancies")
  async listVacancies(@Query() query: unknown) {
    const parsed = publicVacanciesQuerySchema.parse(query);
    const where = buildVacancyWhere(parsed);
    const [items, total] = await Promise.all([
      prisma.vacancy.findMany({
        where,
        orderBy: vacancyOrderBy(parsed.sort),
        skip: parsed.cursor,
        take: parsed.limit + 1,
      }),
      prisma.vacancy.count({ where }),
    ]);
    const hasMore = items.length > parsed.limit;
    const pageItems = hasMore ? items.slice(0, parsed.limit) : items;

    return {
      items: pageItems.map(serializeVacancy),
      total,
      nextCursor: hasMore ? parsed.cursor + parsed.limit : null,
    };
  }

  @Get("vacancies/filters")
  async listVacancyFilters() {
    const where = {
      status: "published" as const,
    };
    const [categories, levels, workFormats, locations] = await Promise.all([
      prisma.vacancy.groupBy({
        by: ["categorySlug", "categoryName"],
        where,
        _count: { _all: true },
        orderBy: { _count: { categorySlug: "desc" } },
      }),
      prisma.vacancy.groupBy({
        by: ["level"],
        where,
        _count: { _all: true },
        orderBy: { _count: { level: "desc" } },
      }),
      prisma.vacancy.groupBy({
        by: ["workFormat"],
        where: { ...where, workFormat: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { workFormat: "desc" } },
      }),
      prisma.vacancy.groupBy({
        by: ["location"],
        where: { ...where, location: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { location: "desc" } },
      }),
    ]);

    return {
      categories: categories.map((item) => ({
        name: item.categoryName,
        slug: item.categorySlug,
        count: item._count._all,
      })),
      levels: levels.map((item) => ({
        value: item.level,
        count: item._count._all,
      })),
      workFormats: workFormats.map((item) => ({
        value: item.workFormat,
        count: item._count._all,
      })),
      locations: locations.map((item) => ({
        value: item.location,
        count: item._count._all,
      })),
    };
  }

  @Get("vacancies/:vacancyId")
  async getVacancy(@Param("vacancyId") vacancyId: string) {
    const vacancy = await findVacancyOrThrow(vacancyId);

    if (vacancy.status !== "published") {
      throw new NotFoundException("Вакансия не найдена.");
    }

    return {
      item: serializeVacancy(vacancy),
    };
  }

  @Post("vacancies/:vacancyId/events")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @UseGuards(ApiAuthGuard)
  async createVacancyEvent(
    @CurrentUser() user: AuthenticatedAppUser,
    @Param("vacancyId") vacancyId: string,
    @Body() body: unknown,
  ) {
    const parsed = vacancyEventSchema.parse(body);
    const vacancy = await findVacancyOrThrow(vacancyId);

    if (vacancy.status !== "published") {
      throw new NotFoundException("Вакансия не найдена.");
    }

    const event = await prisma.vacancyUserEvent.create({
      data: {
        userId: user.id,
        vacancyId: vacancy.id,
        type: parsed.type,
        source: parsed.source ?? "web",
        metadata: parsed.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return {
      item: {
        id: event.id,
        vacancyId: event.vacancyId,
        type: event.type,
        source: event.source,
        createdAt: event.createdAt,
      },
    };
  }

  @Get("admin/vacancies")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiForbiddenResponse({ description: "Admin or support role required." })
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async listAdminVacancies(@Query() query: unknown) {
    const parsed = adminVacanciesQuerySchema.parse(query);
    const where = buildVacancyWhere(parsed);

    if (parsed.status === "all") {
      delete where.status;
    } else {
      where.status = parsed.status;
    }

    const [items, total] = await Promise.all([
      prisma.vacancy.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: parsed.cursor,
        take: parsed.limit + 1,
      }),
      prisma.vacancy.count({ where }),
    ]);
    const hasMore = items.length > parsed.limit;
    const pageItems = hasMore ? items.slice(0, parsed.limit) : items;

    return {
      items: pageItems.map(serializeVacancy),
      total,
      nextCursor: hasMore ? parsed.cursor + parsed.limit : null,
    };
  }

  @Post("admin/vacancies")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async createVacancy(@Body() body: unknown) {
    const parsed = vacancyMutationSchema.parse(body);
    const externalId = parsed.externalId || randomUUID();
    const categorySlug = normalizeSlug(parsed.categorySlug);

    if (!categorySlug) {
      throw new BadRequestException("Некорректный slug категории.");
    }

    const vacancy = await prisma.vacancy.create({
      data: {
        ...parsed,
        externalId,
        source: "admin",
        categorySlug,
      },
    });

    return {
      item: serializeVacancy(vacancy),
    };
  }

  @Patch("admin/vacancies/:vacancyId")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async updateVacancy(
    @Param("vacancyId") vacancyId: string,
    @Body() body: unknown,
  ) {
    await findVacancyOrThrow(vacancyId);
    const parsed = vacancyPatchSchema.parse(body);
    const data: Prisma.VacancyUpdateInput = {
      ...parsed,
    };

    if (parsed.categorySlug !== undefined) {
      const categorySlug = normalizeSlug(parsed.categorySlug);

      if (!categorySlug) {
        throw new BadRequestException("Некорректный slug категории.");
      }

      data.categorySlug = categorySlug;
    }

    const vacancy = await prisma.vacancy.update({
      where: {
        id: vacancyId,
      },
      data,
    });

    return {
      item: serializeVacancy(vacancy),
    };
  }

  @Delete("admin/vacancies/:vacancyId")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async hideVacancy(@Param("vacancyId") vacancyId: string) {
    await findVacancyOrThrow(vacancyId);
    await prisma.vacancy.update({
      where: {
        id: vacancyId,
      },
      data: {
        status: "hidden",
      },
    });

    return {
      ok: true,
    };
  }
}
