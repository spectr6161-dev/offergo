import type { NextRequest } from "next/server";
import { env } from "@offergo/shared";

export const runtime = "nodejs";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const telegramProxyTimeoutMs = 10 * 1000;

function getApiBaseUrl() {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? env.API_URL;
}

function buildApiCallbackUrl(request: NextRequest) {
  const target = new URL("/api/auth/telegram/callback", getApiBaseUrl());
  target.search = request.nextUrl.search;
  return target;
}

function copyProxyHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete("host");
  return nextHeaders;
}

function copyResponseHeaders(headers: Headers) {
  const nextHeaders = new Headers();

  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      nextHeaders.append(key, value);
    }
  });

  return nextHeaders;
}

export async function GET(request: NextRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramProxyTimeoutMs);

  let response: Response;

  try {
    response = await fetch(buildApiCallbackUrl(request), {
      method: "GET",
      headers: copyProxyHeaders(request.headers),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Telegram auth proxy timeout"
        : "Telegram auth proxy failed";

    return Response.json({ error: { message } }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  return new Response(response.body, {
    status: response.status,
    headers: copyResponseHeaders(response.headers),
  });
}
