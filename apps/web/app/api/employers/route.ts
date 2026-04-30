import { proxyApi } from "../_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return proxyApi(`/api/v1/employers${url.search}`);
}
