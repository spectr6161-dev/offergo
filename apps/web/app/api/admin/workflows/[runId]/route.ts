import { proxyWorkflowJson } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyWorkflowJson(`/api/v1/admin/workflows/${runId}`);
}
