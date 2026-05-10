import { proxyApi } from "../../_lib/proxy";

export async function GET() {
  return proxyApi("/api/v1/legal/data-export");
}
