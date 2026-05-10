import { proxyApi } from "../../_lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyApi("/api/v1/vacancies/filters");
}
