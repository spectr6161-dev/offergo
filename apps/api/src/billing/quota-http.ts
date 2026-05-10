import { HttpException } from "@nestjs/common";
import { QuotaExceededError } from "@offergo/billing";

export function throwIfQuotaExceeded(error: unknown): never {
  if (error instanceof QuotaExceededError) {
    throw new HttpException(error.toResponse(), error.statusCode);
  }

  throw error;
}

export function toQuotaExceededPayload(error: QuotaExceededError) {
  return error.toResponse();
}
