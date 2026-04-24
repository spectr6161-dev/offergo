import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
} from "@nestjs/swagger";
import { prisma } from "@offergo/db";
import { ApiAuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import {
  AdminSummaryResponseDto,
  AdminUsersResponseDto,
} from "../docs/swagger.models";

@ApiTags("admin")
@ApiBearerAuth("bearer")
@ApiCookieAuth("session")
@UseGuards(ApiAuthGuard, RolesGuard)
@Roles("admin", "support")
@Controller("admin")
export class AdminController {
  @Get("summary")
  @ApiOperation({
    summary: "Получение platform counters для админки",
  })
  @ApiOkResponse({
    description: "Операционные счётчики платформы для административного интерфейса.",
    type: AdminSummaryResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  @ApiForbiddenResponse({
    description: "У аутентифицированного пользователя нет роли admin/support.",
  })
  async getSummary() {
    const [users, payments, activeEntitlements, jobs] = await Promise.all([
      prisma.user.count(),
      prisma.payment.count(),
      prisma.entitlement.count({
        where: {
          status: "active",
        },
      }),
      prisma.job.count(),
    ]);

    return {
      users,
      payments,
      activeEntitlements,
      jobs,
    };
  }

  @Get("users")
  @ApiOperation({
    summary: "Получение списка пользователей для админки",
  })
  @ApiOkResponse({
    description:
      "Список пользователей платформы для админки с уже развёрнутыми глобальными ролями.",
    type: AdminUsersResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  @ApiForbiddenResponse({
    description: "У аутентифицированного пользователя нет роли admin/support.",
  })
  async getUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        roleAssignments: {
          select: {
            role: true,
          },
          orderBy: {
            role: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return {
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        roles:
          user.roleAssignments.length > 0
            ? user.roleAssignments.map((assignment) => assignment.role)
            : ["user"],
      })),
    };
  }
}
