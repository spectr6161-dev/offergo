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
  const acceptedContentTypes = incomingHeaders.get("accept");
  const range = incomingHeaders.get("range");
  const ifRange = incomingHeaders.get("if-range");

  if (cookie && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", cookie);
  }

  if (authorization && !requestHeaders.has("authorization")) {
    requestHeaders.set("authorization", authorization);
  }

  if (acceptedContentTypes && !requestHeaders.has("accept")) {
    requestHeaders.set("accept", acceptedContentTypes);
  }

  if (range && !requestHeaders.has("range")) {
    requestHeaders.set("range", range);
  }

  if (ifRange && !requestHeaders.has("if-range")) {
    requestHeaders.set("if-range", ifRange);
  }

  return requestHeaders;
}

export async function proxyResumeLibrary(
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: await getForwardHeaders(init.headers),
    cache: "no-store",
  });
  const responseHeaders = new Headers();

  for (const headerName of [
    "content-type",
    "content-disposition",
    "content-length",
    "accept-ranges",
    "content-range",
  ]) {
    const value = response.headers.get(headerName);

    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
