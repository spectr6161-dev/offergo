export function getAuthClientErrorMessage(
  error: unknown,
  fallback = "Сервис авторизации временно недоступен.",
) {
  if (error instanceof Error && error.message) {
    return error.message === "Failed to fetch"
      ? "Сервер авторизации недоступен. Попробуйте позже."
      : error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}
