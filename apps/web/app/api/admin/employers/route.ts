import { proxyApi } from "../../_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return proxyApi(`/api/v1/admin/employers${url.search}`);
}

export async function POST(request: Request) {
  return proxyApi("/api/v1/admin/employers", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
