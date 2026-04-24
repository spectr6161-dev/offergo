import { headers } from "next/headers";
import { env } from "@offergo/shared";

export class ApiFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiFetchError";
  }
}

function getApiBaseUrl() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? env.API_URL;
}

function buildApiUrl(path: string) {
  const normalizedBaseUrl = getApiBaseUrl().endsWith("/")
    ? getApiBaseUrl()
    : `${getApiBaseUrl()}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBaseUrl).toString();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}) {
  const incomingHeaders = await headers();
  const requestHeaders = new Headers(init.headers);
  const cookie = incomingHeaders.get("cookie");
  const authorization = incomingHeaders.get("authorization");

  if (cookie && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", cookie);
  }

  if (authorization && !requestHeaders.has("authorization")) {
    requestHeaders.set("authorization", authorization);
  }

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !requestHeaders.has("content-type")
  ) {
    requestHeaders.set("content-type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: requestHeaders,
    cache: init.cache ?? "no-store",
  });

  if (!response.ok) {
    throw new ApiFetchError(
      `API request failed: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export function getApiErrorStatus(error: unknown) {
  return error instanceof ApiFetchError ? error.status : null;
}
