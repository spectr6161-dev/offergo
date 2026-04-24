import { Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
} from "@nestjs/swagger";
import { ApiAuthGuard } from "./auth/auth.guard";
import { StorageUploadResponseDto } from "./docs/swagger.models";

@ApiTags("storage")
@Controller("storage")
export class StorageController {
  @Post("upload")
  @HttpCode(501)
  @UseGuards(ApiAuthGuard)
  @ApiOperation({
    summary: "Зарезервированный upload endpoint контракта",
  })
  @ApiBearerAuth("bearer")
  @ApiCookieAuth("session")
  @ApiOkResponse({
    description:
      "Зарезервированный upload endpoint. Контракт уже существует в API, но реализация намеренно отложена.",
    type: StorageUploadResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Отсутствуют или невалидны session/bearer credentials.",
  })
  @ApiForbiddenResponse({
    description: "Аутентифицированному пользователю запрещён доступ к storage-контракту.",
  })
  createUpload() {
    return {
      ok: false,
      message:
        "Storage upload endpoint scaffolded but intentionally left inactive in the API foundation phase.",
      acceptedPurpose: [
        "resume_source",
        "resume_export",
        "screenshot",
        "temp_ai_output",
      ],
    };
  }
}
