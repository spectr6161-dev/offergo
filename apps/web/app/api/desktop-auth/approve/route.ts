import { proxyApi } from "@/app/api/_lib/proxy";

export async function POST(request: Request) {
  return proxyApi("/api/v1/auth/app/browser/approve", {
    method: "POST",
    body: await request.text(),
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
  });
}
