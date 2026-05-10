import { proxyApi } from "../../_lib/proxy";

export async function POST(request: Request) {
  return proxyApi("/api/v1/legal/privacy-requests", {
    method: "POST",
    body: await request.text(),
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
  });
}
