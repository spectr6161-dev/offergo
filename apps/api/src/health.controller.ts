import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { env } from "@offergo/shared";
import { HealthResponseDto } from "./docs/swagger.models";

@ApiTags("platform")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({
    summary: "Проверка доступности API",
  })
  @ApiOkResponse({
    description: "Health-check платформенного API.",
    type: HealthResponseDto,
  })
  getHealth() {
    return {
      ok: true,
      app: "offergo-api",
      authModes: ["session", "bearer", "jwt"],
      billingProvider: "platega",
      timestamp: new Date().toISOString(),
      apiUrl: env.API_URL,
    };
  }
}
