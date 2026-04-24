import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
} from "@nestjs/swagger";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import {
  handleProviderWebhook,
  listActivePlans,
  listUserEntitlements,
  startCheckout,
} from "@offergo/billing";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiAuthGuard } from "../auth/auth.guard";
import {
  CheckoutResponseDto,
  EntitlementsResponseDto,
  PlansResponseDto,
  PlategaWebhookBodyDto,
  PlategaWebhookResponseDto,
  StartCheckoutBodyDto,
} from "../docs/swagger.models";

const startCheckoutSchema = z.object({
  planId: z.string().cuid(),
});

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

  @Post("checkout")
  @UseGuards(ApiAuthGuard)
  @ApiOperation({
    summary: "Запуск checkout через Platega",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiBody({
    type: StartCheckoutBodyDto,
  })
  @ApiCreatedResponse({
    description:
      "Запускает checkout с ручным продлением и возвращает платёжную ссылку Platega.",
    type: CheckoutResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  @ApiForbiddenResponse({
    description: "Аутентифицированному пользователю запрещено запускать checkout.",
  })
  async createCheckout(
    @CurrentUser() user: { id: string },
    @Body() body: StartCheckoutBodyDto,
  ) {
    const parsed = startCheckoutSchema.parse(body);
    const checkout = await startCheckout(user.id, parsed.planId);

    return {
      payment: checkout.payment,
      paymentUrl: checkout.paymentUrl,
    };
  }

  @Post("platega")
  @HttpCode(200)
  @ApiOperation({
    summary: "Обработка webhook callback от Platega",
  })
  @ApiBody({
    type: PlategaWebhookBodyDto,
  })
  @ApiOkResponse({
    description:
      "Обрабатывает webhook callback от Platega и обновляет внутреннее состояние платежа.",
    type: PlategaWebhookResponseDto,
  })
  async handlePlategaWebhook(
    @Req() request: Request,
    @Body() payload: unknown,
  ) {
    const callback = await handleProviderWebhook(
      payload,
      fromNodeHeaders(request.headers),
    );

    return {
      ok: true,
      transactionId: callback.id,
      status: callback.status,
    };
  }
}
