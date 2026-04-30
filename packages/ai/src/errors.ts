export type NormalizedAiError = {
  code: string;
  message: string;
  status?: number;
  retryable: boolean;
};

type ErrorWithStatus = {
  status?: unknown;
  statusCode?: unknown;
  response?: {
    status?: unknown;
  };
  cause?: unknown;
};

export function normalizeAiError(error: unknown): NormalizedAiError {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  const code = getErrorCode(error, status, message);

  return {
    code,
    message,
    status,
    retryable: isRetryable(status, code),
  };
}

export function serializeAiError(error: unknown) {
  return JSON.stringify(normalizeAiError(error));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return redactSensitiveText(error.message);
  }

  if (typeof error === "string") {
    return redactSensitiveText(error);
  }

  return "Unknown AI error.";
}

function getErrorStatus(error: unknown): number | undefined {
  const value = error as ErrorWithStatus;
  const candidates = [
    value.status,
    value.statusCode,
    value.response?.status,
    value.cause && typeof value.cause === "object"
      ? (value.cause as ErrorWithStatus).status
      : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return candidate;
    }
  }

  return undefined;
}

function getErrorCode(
  error: unknown,
  status: number | undefined,
  message: string,
) {
  if (status === 401 || status === 403) {
    return "auth";
  }

  if (status === 404 || /not found|model.*not.*found/i.test(message)) {
    return "model_not_found";
  }

  if (status === 408) {
    return "timeout";
  }

  if (status === 429 || /rate limit|quota|too many requests/i.test(message)) {
    return "rate_limit";
  }

  if (status && status >= 500) {
    return "provider_error";
  }

  if (error instanceof Error && error.name) {
    return error.name;
  }

  return "ai_error";
}

function isRetryable(status: number | undefined, code: string) {
  return (
    status === 408 ||
    status === 429 ||
    Boolean(status && status >= 500) ||
    code === "timeout" ||
    code === "provider_error" ||
    code === "rate_limit"
  );
}

function redactSensitiveText(value: string) {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_GEMINI_API_KEY]")
    .replace(/AQVN[0-9A-Za-z_-]{20,}/g, "[REDACTED_YANDEX_API_KEY]")
    .replace(/t1\.[0-9A-Za-z_-]{20,}/g, "[REDACTED_YANDEX_IAM_TOKEN]")
    .replace(
      /x-goog-api-key['":=\s]+[0-9A-Za-z_-]+/gi,
      "x-goog-api-key [REDACTED]",
    )
    .replace(
      /Authorization['":=\s]+(Api-Key|Bearer)\s+[0-9A-Za-z_.-]+/gi,
      "Authorization [REDACTED]",
    )
    .slice(0, 2_000);
}
