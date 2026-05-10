import { proxyApi } from "@/app/api/_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return proxyApi("/api/v1/auth/extension/browser/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{}",
  });
}
