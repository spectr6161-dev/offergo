import { proxyResumeAnalysisJson } from "../../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await params;

  return proxyResumeAnalysisJson(
    `/api/v1/resume-analysis/saved/${analysisId}/restore`,
    {
      method: "POST",
    },
  );
}
