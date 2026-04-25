import { normalizeAiError } from "@offergo/ai";

import { apiFetch, getApiErrorStatus } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export function getLatencyMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

export function jsonAiError(error: unknown, latencyMs?: number) {
  return {
    error: normalizeAiError(error),
    latencyMs,
  };
}
