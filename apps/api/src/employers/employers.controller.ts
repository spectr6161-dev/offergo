import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { prisma, Prisma } from "@offergo/db";
import { z } from "zod";

import { ApiAuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import {
  createCategorySlug,
  normalizeEmployerName,
  normalizeEmployerNameKey,
  normalizeEmployerWebsite,
} from "./employer-utils";

function parseCategoriesQuery(value: unknown) {
  if (value === undefined || value === null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const categoriesQuerySchema = z.preprocess(
  parseCategoriesQuery,
  z.array(z.string().trim().min(1).max(160)).max(80),
);

const publicEmployersQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  category: z.string().trim().max(160).optional(),
  categories: categoriesQuerySchema.optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

const adminEmployersQuerySchema = publicEmployersQuerySchema.extend({
  status: z.enum(["all", "published", "hidden"]).default("all"),
});

const employerMutationSchema = z.object({
  name: z.string().trim().min(1).max(180),
  website: z.string().trim().max(300).nullable().optional(),
  status: z.enum(["published", "hidden"]).default("published"),
  categoryNames: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
});

const employerPatchSchema = employerMutationSchema.partial();

type EmployerWithCategories = Prisma.EmployerGetPayload<{
  include: {
    categories: {
      include: {
        category: true;
      };
      orderBy: {
        category: {
          name: "asc";
        };
      };
    };
  };
}>;

function serializeEmployer(employer: EmployerWithCategories) {
  return {
    id: employer.id,
    name: employer.name,
    website: employer.website,
    status: employer.status,
    source: employer.source,
    createdAt: employer.createdAt,
    updatedAt: employer.updatedAt,
    categories: employer.categories.map((link) => ({
      id: link.category.id,
      name: link.category.name,
      slug: link.category.slug,
    })),
  };
}

function buildPublicWhere(
  parsed: z.infer<typeof publicEmployersQuerySchema>,
): Prisma.EmployerWhereInput {
  const where: Prisma.EmployerWhereInput = {
    status: "published",
  };

  if (parsed.q) {
    where.OR = [
      {
        name: {
          contains: parsed.q,
          mode: "insensitive",
        },
      },
      {
        website: {
          contains: parsed.q,
          mode: "insensitive",
        },
      },
      {
        categories: {
          some: {
            category: {
              name: {
                contains: parsed.q,
                mode: "insensitive",
              },
            },
          },
        },
      },
    ];
  }

  const categoryFilters = Array.from(
    new Set(
      [
        ...(parsed.category && parsed.category !== "all"
          ? [parsed.category]
          : []),
        ...(parsed.categories ?? []),
      ].filter((category) => category !== "all"),
    ),
  );

  if (categoryFilters.length > 0) {
    where.categories = {
      some: {
        category: {
          OR: categoryFilters.flatMap((category) => [
            {
              slug: category,
            },
            {
              id: category,
            },
            {
              name: category,
            },
          ]),
        },
      },
    };
  }

  return where;
}

async function ensureNoWebsiteConflict(
  normalizedWebsite: string | null,
  currentEmployerId?: string,
) {
  if (!normalizedWebsite) {
    return;
  }

  const existing = await prisma.employer.findUnique({
    where: {
      normalizedWebsite,
    },
    select: {
      id: true,
    },
  });

  if (existing && existing.id !== currentEmployerId) {
    throw new BadRequestException("Работодатель с таким сайтом уже существует.");
  }
}

async function upsertCategories(categoryNames: string[]) {
  const uniqueNames = Array.from(
    new Set(
      categoryNames
        .map((name) => normalizeEmployerName(name))
        .filter((name) => name.length > 0),
    ),
  );

  return Promise.all(
    uniqueNames.map((name) =>
      prisma.employerCategory.upsert({
        where: {
          slug: createCategorySlug(name),
        },
        update: {
          name,
        },
        create: {
          name,
          slug: createCategorySlug(name),
        },
      }),
    ),
  );
}

@ApiTags("employers")
@Controller()
export class EmployersController {
  @Get("employers")
  async listEmployers(@Query() query: unknown) {
    const parsed = publicEmployersQuerySchema.parse(query);
    const where = buildPublicWhere(parsed);
    const [items, total] = await Promise.all([
      prisma.employer.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: parsed.cursor,
        take: parsed.limit + 1,
        include: {
          categories: {
            include: {
              category: true,
            },
            orderBy: {
              category: {
                name: "asc",
              },
            },
          },
        },
      }),
      prisma.employer.count({ where }),
    ]);
    const hasMore = items.length > parsed.limit;
    const pageItems = hasMore ? items.slice(0, parsed.limit) : items;

    return {
      items: pageItems.map(serializeEmployer),
      total,
      nextCursor: hasMore ? parsed.cursor + parsed.limit : null,
    };
  }

  @Get("employers/categories")
  async listEmployerCategories() {
    const categories = await prisma.employerCategory.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            employers: true,
          },
        },
      },
    });

    return {
      items: categories
        .filter((category) => category._count.employers > 0)
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          employersCount: category._count.employers,
        })),
    };
  }

  @Get("admin/employers")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiUnauthorizedResponse({ description: "Authentication required." })
  @ApiForbiddenResponse({ description: "Admin or support role required." })
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async listAdminEmployers(@Query() query: unknown) {
    const parsed = adminEmployersQuerySchema.parse(query);
    const where = buildPublicWhere(parsed);

    if (parsed.status === "all") {
      delete where.status;
    } else {
      where.status = parsed.status;
    }

    const [items, total] = await Promise.all([
      prisma.employer.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: parsed.cursor,
        take: parsed.limit + 1,
        include: {
          categories: {
            include: {
              category: true,
            },
            orderBy: {
              category: {
                name: "asc",
              },
            },
          },
        },
      }),
      prisma.employer.count({ where }),
    ]);
    const hasMore = items.length > parsed.limit;
    const pageItems = hasMore ? items.slice(0, parsed.limit) : items;

    return {
      items: pageItems.map(serializeEmployer),
      total,
      nextCursor: hasMore ? parsed.cursor + parsed.limit : null,
    };
  }

  @Post("admin/employers")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async createEmployer(@Body() body: unknown) {
    const parsed = employerMutationSchema.parse(body);
    const name = normalizeEmployerName(parsed.name);
    const website = normalizeEmployerWebsite(parsed.website);

    await ensureNoWebsiteConflict(website.normalizedWebsite);

    const categories = await upsertCategories(parsed.categoryNames);
    const employer = await prisma.employer.create({
      data: {
        name,
        normalizedName: normalizeEmployerNameKey(name),
        website: website.website,
        normalizedWebsite: website.normalizedWebsite,
        status: parsed.status,
        source: "admin",
        ...(categories.length > 0
          ? {
              categories: {
                createMany: {
                  data: categories.map((category) => ({
                    categoryId: category.id,
                  })),
                  skipDuplicates: true,
                },
              },
            }
          : {}),
      },
      include: {
        categories: {
          include: {
            category: true,
          },
          orderBy: {
            category: {
              name: "asc",
            },
          },
        },
      },
    });

    return {
      item: serializeEmployer(employer),
    };
  }

  @Patch("admin/employers/:employerId")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async updateEmployer(
    @Param("employerId") employerId: string,
    @Body() body: unknown,
  ) {
    const parsed = employerPatchSchema.parse(body);
    const current = await prisma.employer.findUnique({
      where: {
        id: employerId,
      },
      select: {
        id: true,
      },
    });

    if (!current) {
      throw new BadRequestException("Работодатель не найден.");
    }

    const data: Prisma.EmployerUpdateInput = {};

    if (parsed.name !== undefined) {
      const name = normalizeEmployerName(parsed.name);
      data.name = name;
      data.normalizedName = normalizeEmployerNameKey(name);
    }

    if (parsed.website !== undefined) {
      const website = normalizeEmployerWebsite(parsed.website);
      await ensureNoWebsiteConflict(website.normalizedWebsite, employerId);
      data.website = website.website;
      data.normalizedWebsite = website.normalizedWebsite;
    }

    if (parsed.status !== undefined) {
      data.status = parsed.status;
    }

    const categories =
      parsed.categoryNames !== undefined
        ? await upsertCategories(parsed.categoryNames)
        : null;

    const employer = await prisma.$transaction(async (tx) => {
      await tx.employer.update({
        where: {
          id: employerId,
        },
        data,
      });

      if (categories) {
        await tx.employerCategoryLink.deleteMany({
          where: {
            employerId,
          },
        });
        if (categories.length > 0) {
          await tx.employerCategoryLink.createMany({
            data: categories.map((category) => ({
              employerId,
              categoryId: category.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.employer.findUniqueOrThrow({
        where: {
          id: employerId,
        },
        include: {
          categories: {
            include: {
              category: true,
            },
            orderBy: {
              category: {
                name: "asc",
              },
            },
          },
        },
      });
    });

    return {
      item: serializeEmployer(employer),
    };
  }

  @Delete("admin/employers/:employerId")
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  async hideEmployer(@Param("employerId") employerId: string) {
    await prisma.employer.update({
      where: {
        id: employerId,
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
