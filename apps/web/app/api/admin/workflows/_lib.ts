import { headers } from "next/headers";
import { env } from "@offergo/shared";

import { apiFetch, getApiErrorStatus } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  if (cookie && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", cookie);
  }

  if (authorization && !requestHeaders.has("authorization")) {
    requestHeaders.set("authorization", authorization);
  }

  return requestHeaders;
}

export async function requireAdminApiAccess() {
  try {
    await apiFetch("/api/v1/auth/admin/ping");
    return null;
  } catch (error) {
    const status = getApiErrorStatus(error);

    if (status === 401) {
      return Response.json({ error: "Требуется авторизация." }, { status });
    }

    if (status === 403) {
      return Response.json(
        { error: "Требуется роль администратора." },
        { status },
      );
    }

    throw error;
  }
}

export async function proxyWorkflowJson(path: string, init: RequestInit = {}) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: await getForwardHeaders(init.headers),
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type");
  const headers = new Headers();

  if (contentType) {
    headers.set("content-type", contentType);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function proxyWorkflowSse(path: string) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const response = await fetch(buildApiUrl(path), {
    headers: await getForwardHeaders({
      accept: "text/event-stream",
    }),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
