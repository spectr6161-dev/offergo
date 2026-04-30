import { proxyWorkflowJson } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyWorkflowJson("/api/v1/admin/workflows");
}
