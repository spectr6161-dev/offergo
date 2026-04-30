import { headers } from "next/headers";
import { env } from "@offergo/shared";

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

async function getForwardHeaders(init?: HeadersInit) {
  const incomingHeaders = await headers();
  const requestHeaders = new Headers(init);
  const cookie = incomingHeaders.get("cookie");
  const authorization = incomingHeaders.get("authorization");
  const accept = incomingHeaders.get("accept");

  if (cookie && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", cookie);
  }

  if (authorization && !requestHeaders.has("authorization")) {
    requestHeaders.set("authorization", authorization);
  }

  if (accept && !requestHeaders.has("accept")) {
    requestHeaders.set("accept", accept);
  }

  return requestHeaders;
}

export async function proxyApi(path: string, init: RequestInit = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: await getForwardHeaders(init.headers),
    cache: "no-store",
  });
  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
