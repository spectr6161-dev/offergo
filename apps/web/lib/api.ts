import { headers } from "next/headers";
import { env } from "@offergo/shared";

export class ApiFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
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

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 204) {
    return undefined;
  }

  const bodyText = await response.text();

  if (!bodyText) {
    return undefined;
  }

  if (!contentType.includes("application/json")) {
    return bodyText;
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return bodyText;
  }
}

function getResponseMessage(body: unknown, fallback: string) {
  if (typeof body === "string") {
    return body || fallback;
  }

  if (body && typeof body === "object") {
    if (
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }

    if ("error" in body) {
      const error = (body as { error?: unknown }).error;

      if (typeof error === "string") {
        return error;
      }

      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        return (error as { message: string }).message;
      }
    }
  }

  return fallback;
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
    const body = await readResponseBody(response);
    const fallback = `API request failed: ${response.status} ${response.statusText}`;

    throw new ApiFetchError(
      getResponseMessage(body, fallback),
      response.status,
      body,
    );
  }

  return (await readResponseBody(response)) as T;
}

export function getApiErrorStatus(error: unknown) {
  return error instanceof ApiFetchError ? error.status : null;
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiFetchError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "API временно недоступен.";
}
