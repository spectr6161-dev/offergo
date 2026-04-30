import { proxyResumeAnalysisJson } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  return proxyResumeAnalysisJson(`/api/v1/resume-analysis/runs/${runId}`);
}
