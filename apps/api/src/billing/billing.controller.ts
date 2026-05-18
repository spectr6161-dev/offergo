import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";
import {
  getUserPaymentStatus,
  getUsageOverview,
  listActivePlans,
  listUserEntitlements,
  listUserPayments,
} from "@offergo/billing";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiAuthGuard } from "../auth/auth.guard";
import {
  EntitlementsResponseDto,
  PaymentsResponseDto,
  PaymentStatusResponseDto,
  PlansResponseDto,
  StartCheckoutBodyDto,
} from "../docs/swagger.models";

const startCheckoutSchema = z.object({
  planId: z.string().trim().min(1).max(128),
});

const paymentIdSchema = z.string().trim().min(1).max(128);

@ApiTags("billing")
@Controller("billing")
export class BillingController {
  @Get("plans")
  @ApiOperation({
    summary: "Получение списка активных тарифов",
  })
  @ApiOkResponse({
    description: "Список активных тарифов, доступных для checkout.",
    type: PlansResponseDto,
  })
  async getPlans() {
    const plans = await listActivePlans();

    return {
      items: plans,
    };
  }

  @Get("entitlements")
  @UseGuards(ApiAuthGuard)
  @ApiOperation({
    summary: "Получение активных entitlements текущего пользователя",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiOkResponse({
    description: "Список entitlements текущего пользователя.",
    type: EntitlementsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  async getEntitlements(@CurrentUser() user: { id: string }) {
    const entitlements = await listUserEntitlements(user.id);

    return {
      items: entitlements,
    };
  }

  @Get("subscription")
  @UseGuards(ApiAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  async getSubscription(@CurrentUser() user: { id: string }) {
    const [overview, plans] = await Promise.all([
      getUsageOverview(user.id),
      listActivePlans(),
    ]);

    return {
      currentPlan: overview.plan,
      entitlement: overview.entitlement,
      periodStart: overview.periodStart,
      periodEnd: overview.periodEnd,
      limits: overview.items,
      upgradeOptions: plans.filter(
        (plan) => plan.checkoutEnabled && plan.rank > overview.plan.rank,
      ),
    };
  }

  @Get("payments")
  @UseGuards(ApiAuthGuard)
  @ApiOperation({
    summary: "Получение платежей текущего пользователя",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiOkResponse({
    description:
      "Список платежей текущего пользователя, включая pending-платежи без активного entitlement.",
    type: PaymentsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  async getPayments(@CurrentUser() user: { id: string }) {
    const payments = await listUserPayments(user.id);

    return {
      items: payments,
    };
  }

  @Post("checkout")
  @UseGuards(ApiAuthGuard)
  @ApiOperation({
    summary: "Запуск покупки подписки",
    description:
      "Покупка подписки временно отключена до подключения нового банка.",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiBody({
    type: StartCheckoutBodyDto,
  })
  @ApiServiceUnavailableResponse({
    description: "Функция покупки подписки пока недоступна.",
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  @ApiForbiddenResponse({
    description:
      "Аутентифицированному пользователю запрещено запускать checkout.",
  })
  async createCheckout(
    @CurrentUser() user: { id: string },
    @Body() body: StartCheckoutBodyDto,
  ) {
    const parsed = startCheckoutSchema.parse(body);
    void user;
    void parsed;

    throw new ServiceUnavailableException({
      code: "checkout_unavailable",
      message: "Функция покупки подписки пока недоступна.",
    });
  }

  @Get("payments/:paymentId/status")
  @UseGuards(ApiAuthGuard)
  @ApiOperation({
    summary: "Проверка статуса платежа текущего пользователя",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiParam({
    name: "paymentId",
    type: String,
    description: "Внутренний идентификатор платежа.",
  })
  @ApiOkResponse({
    description:
      "Возвращает локальный статус платежа. Внешний платёжный провайдер временно отключён.",
    type: PaymentStatusResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  @ApiNotFoundResponse({
    description: "Платёж не найден или принадлежит другому пользователю.",
  })
  async getPaymentStatus(
    @CurrentUser() user: { id: string },
    @Param("paymentId") paymentIdParam: string,
  ) {
    const paymentId = paymentIdSchema.parse(paymentIdParam);

    const result = await getUserPaymentStatus(user.id, paymentId);
    const { payment, providerSyncError } = result;

    return {
      status: payment.status,
      payment,
      plan: payment.plan,
      paymentUrl: payment.paymentUrl,
      expiresAt: payment.expiresAt,
      providerSyncError,
    };
  }
}
