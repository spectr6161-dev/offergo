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
import { CurrentUser } from "./current-user.decorator";
import { ApiAuthGuard } from "./auth.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import {
  AdminPingResponseDto,
  AuthMeResponseDto,
} from "../docs/swagger.models";
import { prisma } from "@offergo/db";
import type { AuthenticatedAppUser } from "@offergo/auth/session";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  @Get("me")
  @UseGuards(ApiAuthGuard)
  @ApiOperation({
    summary: "Получение текущего аутентифицированного пользователя платформы",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiOkResponse({
    description:
      "Аутентифицированный пользователь, определённый по browser session cookie или bearer-токену.",
    type: AuthMeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  async getCurrentUser(@CurrentUser() user: AuthenticatedAppUser) {
    const profile = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        image: true,
        accounts: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            providerId: true,
            accountId: true,
          },
        },
      },
    });

    return {
      user: {
        ...user,
        image: profile?.image ?? user.image ?? null,
        accounts: profile?.accounts ?? [],
      },
    };
  }

  @Get("admin/ping")
  @UseGuards(ApiAuthGuard, RolesGuard)
  @Roles("admin", "support")
  @ApiOperation({
    summary: "Проверка admin-only доступа",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiOkResponse({
    description: "Тестовый admin-only endpoint, защищённый ролями.",
    type: AdminPingResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  @ApiForbiddenResponse({
    description: "У аутентифицированного пользователя нет роли admin/support.",
  })
  getAdminPing(@CurrentUser() user: unknown) {
    return {
      ok: true,
      scope: "admin",
      user,
    };
  }
}
