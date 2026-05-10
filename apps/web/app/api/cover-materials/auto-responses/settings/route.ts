import { proxyApi } from "@/app/api/_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyApi("/api/v1/cover-materials/auto-responses/settings");
}

export async function PUT(request: Request) {
  return proxyApi("/api/v1/cover-materials/auto-responses/settings", {
    method: "PUT",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
